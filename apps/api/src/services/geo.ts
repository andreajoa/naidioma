import crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { config } from '../lib/config.js';

export interface ResolvedLocation {
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
  source: 'cloudflare' | 'ip' | null;
}

export interface ParsedUserAgent {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  isBot: boolean;
}

interface CachedGeo {
  value: ResolvedLocation;
  expiresAt: number;
}

const GEO_CACHE = new Map<string, CachedGeo>();
const GEO_CACHE_MAX = 2000;
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readHeader(req: FastifyRequest, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return null;
}

function safeDecodeGeoValue(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned || cleaned === 'XX' || cleaned === 'T1' || cleaned === 'unknown') return null;
  try {
    return decodeURIComponent(cleaned).slice(0, 80);
  } catch {
    return cleaned.slice(0, 80);
  }
}

export function extractClientIp(req: FastifyRequest): string {
  const cfIp = readHeader(req, 'cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwarded = readHeader(req, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = readHeader(req, 'x-real-ip');
  if (realIp) return realIp;

  return req.ip || '127.0.0.1';
}

export function hashClientIp(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}:${config.jwtSecret}`)
    .digest('hex')
    .slice(0, 16);
}

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/i, '');
  if (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('169.254.') ||
    clean.startsWith('fc') ||
    clean.startsWith('fd') ||
    clean.startsWith('fe80')
  ) {
    return true;
  }
  const match172 = clean.match(/^172\.(\d+)\./);
  if (match172) {
    const octet = Number(match172[1]);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
}

function setGeoCache(ip: string, value: ResolvedLocation): void {
  if (GEO_CACHE.size >= GEO_CACHE_MAX) {
    const firstKey = GEO_CACHE.keys().next().value;
    if (firstKey) GEO_CACHE.delete(firstKey);
  }
  GEO_CACHE.set(ip, { value, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
}

export async function resolveRequestLocation(
  req: FastifyRequest,
  clientTimezone?: string | null,
): Promise<ResolvedLocation> {
  // 1. Edge / Proxy headers (Cloudflare / NexaCloud / Vercel) — instant 0ms lookup
  const cfCity = safeDecodeGeoValue(
    readHeader(req, 'cf-ipcity') ??
      readHeader(req, 'x-vercel-ip-city') ??
      readHeader(req, 'x-geo-city'),
  );
  const cfRegion = safeDecodeGeoValue(
    readHeader(req, 'cf-region-code') ??
      readHeader(req, 'cf-region') ??
      readHeader(req, 'x-vercel-ip-country-region') ??
      readHeader(req, 'x-geo-region'),
  );
  const cfCountry = safeDecodeGeoValue(
    readHeader(req, 'cf-ipcountry') ??
      readHeader(req, 'x-vercel-ip-country') ??
      readHeader(req, 'x-geo-country'),
  );
  const cfTimezone = safeDecodeGeoValue(
    readHeader(req, 'cf-timezone') ?? readHeader(req, 'x-vercel-ip-timezone'),
  );

  if (cfCity || cfCountry) {
    return {
      city: cfCity,
      region: cfRegion,
      country: cfCountry?.toUpperCase() ?? null,
      timezone: cfTimezone ?? (clientTimezone?.trim().slice(0, 60) || null),
      source: 'cloudflare',
    };
  }

  // 2. Cached external GeoIP fallback (skipped in tests and private/local IPs)
  const ip = extractClientIp(req);
  if (process.env.NODE_ENV === 'test' || isPrivateOrLocalIp(ip)) {
    return {
      city: null,
      region: null,
      country: null,
      timezone: clientTimezone?.trim().slice(0, 60) || null,
      source: null,
    };
  }

  const cached = GEO_CACHE.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      timezone: cached.value.timezone ?? (clientTimezone?.trim().slice(0, 60) || null),
    };
  }

  try {
    const cleanIp = ip.replace(/^::ffff:/i, '');
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'NAidioma-Geo/1.0' },
      signal: AbortSignal.timeout(2200),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean;
        city?: string;
        region?: string;
        region_code?: string;
        country_code?: string;
        timezone?: { id?: string };
      };
      if (data.success !== false && (data.city || data.country_code)) {
        const resolved: ResolvedLocation = {
          city: data.city?.trim().slice(0, 80) || null,
          region: (data.region_code || data.region)?.trim().slice(0, 40) || null,
          country: data.country_code?.trim().toUpperCase().slice(0, 8) || null,
          timezone: data.timezone?.id?.trim().slice(0, 60) || clientTimezone?.trim().slice(0, 60) || null,
          source: 'ip',
        };
        setGeoCache(ip, resolved);
        return resolved;
      }
    }
  } catch {
    // Non-blocking fallback
  }

  const empty: ResolvedLocation = {
    city: null,
    region: null,
    country: null,
    timezone: clientTimezone?.trim().slice(0, 60) || null,
    source: null,
  };
  setGeoCache(ip, empty);
  return empty;
}

export function parseCityRegionInput(rawCity?: string | null, rawRegion?: string | null): {
  city: string | null;
  region: string | null;
} {
  const input = (rawCity ?? '').trim();
  const explicitRegion = (rawRegion ?? '').trim().slice(0, 40) || null;
  if (!input) {
    return { city: null, region: explicitRegion };
  }

  // Support "São Paulo - SP", "São Paulo, SP", "Sumé/PB"
  const splitMatch = input.match(/^(.+?)\s*[-,/]\s*([A-Za-zÀ-ÿ]{2,20})$/);
  if (splitMatch && splitMatch[1] && splitMatch[2]) {
    const parsedCity = splitMatch[1].trim().slice(0, 80);
    const parsedRegion =
      explicitRegion ??
      (splitMatch[2].trim().length <= 3
        ? splitMatch[2].trim().toUpperCase()
        : splitMatch[2].trim().slice(0, 40));
    return { city: parsedCity, region: parsedRegion };
  }

  return { city: input.slice(0, 80), region: explicitRegion };
}

export function parseUserAgent(uaRaw?: string | null): ParsedUserAgent {
  const ua = uaRaw ?? '';
  const lower = ua.toLowerCase();

  const isBot =
    /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|gptbot|claudebot|perplexitybot|applebot|google-extended|lighthouse|headlesschrome|curl\/|wget\//i.test(
      ua,
    );

  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|mobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  let os = 'Desconhecido';
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Outro';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('firefox/') || lower.includes('fxios')) browser = 'Firefox';
  else if (lower.includes('samsungbrowser')) browser = 'Samsung Internet';
  else if (lower.includes('chrome/') || lower.includes('crios')) browser = 'Chrome';
  else if (lower.includes('safari/')) browser = 'Safari';

  return { deviceType, os, browser, isBot };
}
