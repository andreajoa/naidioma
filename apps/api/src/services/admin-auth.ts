import crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';
import { extractBearerToken, requireUser } from '../routes/auth.js';
import { extractClientIp, hashClientIp, resolveRequestLocation } from './geo.js';

const ADMIN_AUTH_CONFIG_KEY = 'naidioma_admin_auth';
const ADMIN_TOKEN_AUDIENCE = 'naidioma-admin-dashboard';
const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface StoredAdminAuthConfig {
  passwordHash?: string;
  sessionVersion: number;
  updatedAt?: string;
}

interface AdminDashboardTokenPayload {
  sub: 'owner-admin';
  aud: typeof ADMIN_TOKEN_AUDIENCE;
  ver: number;
  iat: number;
  exp: number;
}

interface FailedLoginBucket {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

const failedAttemptsByIp = new Map<string, FailedLoginBucket>();

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function deriveAdminSigningKey(): Buffer {
  return crypto
    .createHash('sha256')
    .update(`${config.jwtSecret}:admin-dashboard:${config.adminApiKey}`)
    .digest();
}

export function constantTimeEqualSecret(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function hashAdminPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = crypto.scryptSync(plainPassword, salt, 64, { N, r, p }).toString('hex');
  return `scrypt$${N}$${r}$${p}$${salt}$${derived}`;
}

export function verifyScryptPassword(plainPassword: string, encodedHash: string): boolean {
  try {
    const parts = encodedHash.trim().split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const expectedHex = parts[5];
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) {
      return false;
    }
    const derived = crypto.scryptSync(plainPassword, salt, 64, { N, r, p });
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

async function readStoredAdminConfig(): Promise<StoredAdminAuthConfig> {
  try {
    const row = await prisma.runtimeConfig.findUnique({
      where: { key: ADMIN_AUTH_CONFIG_KEY },
    });
    if (!row) return { sessionVersion: 1 };
    const parsed = JSON.parse(row.valueJson) as Partial<StoredAdminAuthConfig>;
    return {
      passwordHash: typeof parsed.passwordHash === 'string' ? parsed.passwordHash : undefined,
      sessionVersion:
        typeof parsed.sessionVersion === 'number' && parsed.sessionVersion >= 1
          ? parsed.sessionVersion
          : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return { sessionVersion: 1 };
  }
}

async function writeStoredAdminConfig(next: StoredAdminAuthConfig): Promise<void> {
  await prisma.runtimeConfig.upsert({
    where: { key: ADMIN_AUTH_CONFIG_KEY },
    create: { key: ADMIN_AUTH_CONFIG_KEY, valueJson: JSON.stringify(next) },
    update: { valueJson: JSON.stringify(next) },
  });
}

export async function getAdminAuthMetadata(): Promise<{
  source: 'database' | 'env_hash' | 'env_password' | 'admin_api_key_fallback';
  mustConfigurePassword: boolean;
  sessionVersion: number;
  passwordUpdatedAt: string | null;
}> {
  const stored = await readStoredAdminConfig();
  if (stored.passwordHash) {
    return {
      source: 'database',
      mustConfigurePassword: false,
      sessionVersion: stored.sessionVersion,
      passwordUpdatedAt: stored.updatedAt ?? null,
    };
  }
  if (config.adminDashboardPasswordHash) {
    return {
      source: 'env_hash',
      mustConfigurePassword: false,
      sessionVersion: stored.sessionVersion,
      passwordUpdatedAt: null,
    };
  }
  if (config.adminDashboardPassword) {
    return {
      source: 'env_password',
      mustConfigurePassword: false,
      sessionVersion: stored.sessionVersion,
      passwordUpdatedAt: null,
    };
  }
  return {
    source: 'admin_api_key_fallback',
    mustConfigurePassword: true,
    sessionVersion: stored.sessionVersion,
    passwordUpdatedAt: null,
  };
}

export async function verifyAdminCredential(password: string): Promise<{
  ok: boolean;
  mustConfigurePassword: boolean;
  sessionVersion: number;
}> {
  const stored = await readStoredAdminConfig();
  const clean = password.trim();
  if (!clean) {
    return { ok: false, mustConfigurePassword: false, sessionVersion: stored.sessionVersion };
  }

  if (stored.passwordHash) {
    return {
      ok: verifyScryptPassword(clean, stored.passwordHash),
      mustConfigurePassword: false,
      sessionVersion: stored.sessionVersion,
    };
  }

  if (config.adminDashboardPasswordHash) {
    return {
      ok: verifyScryptPassword(clean, config.adminDashboardPasswordHash),
      mustConfigurePassword: false,
      sessionVersion: stored.sessionVersion,
    };
  }

  if (config.adminDashboardPassword) {
    return {
      ok: constantTimeEqualSecret(clean, config.adminDashboardPassword),
      mustConfigurePassword: false,
      sessionVersion: stored.sessionVersion,
    };
  }

  // Fallback only when no dedicated dashboard password was configured yet:
  // still requires the private server ADMIN_API_KEY env var (never hardcoded!).
  return {
    ok: constantTimeEqualSecret(clean, config.adminApiKey),
    mustConfigurePassword: true,
    sessionVersion: stored.sessionVersion,
  };
}

export function signAdminDashboardToken(sessionVersion: number): {
  token: string;
  expiresAt: string;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + ADMIN_TOKEN_TTL_SECONDS;
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: AdminDashboardTokenPayload = {
    sub: 'owner-admin',
    aud: ADMIN_TOKEN_AUDIENCE,
    ver: sessionVersion,
    iat: nowSec,
    exp,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', deriveAdminSigningKey())
    .update(`${header}.${body}`)
    .digest();

  return {
    token: `${header}.${body}.${base64UrlEncode(sig)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export async function verifyAdminDashboardToken(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, body, sig] = parts;
    if (!header || !body || !sig) return false;

    const expectedSig = base64UrlEncode(
      crypto
        .createHmac('sha256', deriveAdminSigningKey())
        .update(`${header}.${body}`)
        .digest(),
    );

    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    const payload = JSON.parse(base64UrlDecode(body)) as Partial<AdminDashboardTokenPayload>;
    if (payload.sub !== 'owner-admin' || payload.aud !== ADMIN_TOKEN_AUDIENCE) return false;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return false;

    const stored = await readStoredAdminConfig();
    if (payload.ver !== stored.sessionVersion) return false;
    return true;
  } catch {
    return false;
  }
}

export async function isAuthorizedAdmin(req: FastifyRequest): Promise<boolean> {
  const headerKey = req.headers['x-admin-key'];
  if (typeof headerKey === 'string' && constantTimeEqualSecret(headerKey, config.adminApiKey)) {
    return true;
  }

  const bearer = extractBearerToken(req);
  if (bearer && (await verifyAdminDashboardToken(bearer))) {
    return true;
  }

  const user = await requireUser(req);
  return user?.role === 'admin';
}

export function checkAdminLoginRateLimit(ipHash: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const bucket = failedAttemptsByIp.get(ipHash);
  if (!bucket) return { allowed: true, retryAfterSeconds: 0 };

  const now = Date.now();
  if (bucket.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
    };
  }

  if (now - bucket.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    failedAttemptsByIp.delete(ipHash);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAdminLoginFailure(ipHash: string): {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const existing = failedAttemptsByIp.get(ipHash);
  if (!existing || now - existing.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    failedAttemptsByIp.set(ipHash, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
    });
    return {
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - 1,
      retryAfterSeconds: 0,
    };
  }

  const nextCount = existing.count + 1;
  const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : 0;
  failedAttemptsByIp.set(ipHash, {
    count: nextCount,
    firstAttemptAt: existing.firstAttemptAt,
    lockedUntil,
  });

  return {
    locked: lockedUntil > 0,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - nextCount),
    retryAfterSeconds: lockedUntil > 0 ? Math.ceil(LOCKOUT_WINDOW_MS / 1000) : 0,
  };
}

export function clearAdminLoginFailures(ipHash: string): void {
  failedAttemptsByIp.delete(ipHash);
}

export function resetAdminRateLimitsForTests(): void {
  failedAttemptsByIp.clear();
}

export async function recordAdminAudit(
  action: string,
  req: FastifyRequest,
  detail?: string,
): Promise<void> {
  try {
    const ip = extractClientIp(req);
    const ipHash = hashClientIp(ip);
    const loc = await resolveRequestLocation(req);
    const ua =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 220)
        : null;

    await prisma.adminAuditLog.create({
      data: {
        action,
        ipHash,
        city: loc.city,
        country: loc.country,
        userAgent: ua,
        detail: detail?.slice(0, 240) ?? null,
      },
    });
  } catch {
    // Audit logging should never crash admin operations
  }
}

export async function rotateAdminPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string; token?: string; expiresAt?: string }> {
  const verified = await verifyAdminCredential(currentPassword);
  if (!verified.ok) {
    return { ok: false, error: 'Senha atual incorreta.' };
  }

  if (newPassword.trim().length < 12) {
    return {
      ok: false,
      error: 'A nova senha de administrador precisa ter pelo menos 12 caracteres.',
    };
  }

  const stored = await readStoredAdminConfig();
  const nextVersion = stored.sessionVersion + 1;
  await writeStoredAdminConfig({
    passwordHash: hashAdminPassword(newPassword.trim()),
    sessionVersion: nextVersion,
    updatedAt: new Date().toISOString(),
  });

  const signed = signAdminDashboardToken(nextVersion);
  return { ok: true, token: signed.token, expiresAt: signed.expiresAt };
}
