import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';

const SQLITE_MAGIC = 'SQLite format 3\0';
const CHUNK_CHAR_SIZE = 42_000; // safely below NexaCloud Cloudflare KV 64 KB per-key limit
const SYNC_UA = 'NAidioma-CloudSync/1.0';

interface SnapshotMeta {
  version: number;
  chunks: number;
  sha256: string;
  rawBytes: number;
  gzBytes: number;
  iv: string;
  tag: string;
  updatedAt: string;
}

let syncTimer: NodeJS.Timeout | null = null;
let syncInFlight = false;
let lastCloudSyncAt: string | null = null;
let lastCloudSyncError: string | null = null;

function getSyncConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (process.env.CLOUD_SYNC_URL ?? '').trim().replace(/\/+$/, '');
  const token = (process.env.CLOUD_SYNC_TOKEN ?? '').trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

export function resolveDbFilePath(): string {
  const raw = (process.env.DATABASE_URL ?? 'file:/app/data/naidioma.db').trim();
  if (raw.startsWith('file:')) {
    const filePart = raw.slice(5).split('?')[0] ?? '/app/data/naidioma.db';
    return path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), 'prisma', filePart);
  }
  return '/app/data/naidioma.db';
}

function deriveAesKey(): Buffer {
  return crypto.createHash('sha256').update(config.jwtSecret).digest();
}

async function kvPut(baseUrl: string, token: string, key: string, value: unknown): Promise<void> {
  const res = await fetch(`${baseUrl}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': SYNC_UA,
    },
    body: JSON.stringify({ value }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cloudflare KV PUT ${key} failed (${res.status}): ${body.slice(0, 120)}`);
  }
}

async function kvGet<T>(baseUrl: string, token: string, key: string): Promise<T | null> {
  const res = await fetch(`${baseUrl}/${encodeURIComponent(key)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': SYNC_UA,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Cloudflare KV GET ${key} failed (${res.status})`);
  }
  const data = (await res.json()) as { value?: T };
  return data.value ?? null;
}

export async function restoreDatabaseFromCloudflare(): Promise<{
  restored: boolean;
  reason?: string;
  bytes?: number;
  updatedAt?: string;
}> {
  const cfg = getSyncConfig();
  if (!cfg) return { restored: false, reason: 'cloud_sync_not_configured' };

  const targetPath = resolveDbFilePath();
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 16_384) {
    return { restored: false, reason: 'existing_db_present' };
  }

  const meta = await kvGet<SnapshotMeta>(cfg.baseUrl, cfg.token, 'db_meta');
  if (!meta || !meta.chunks || !meta.iv || !meta.tag) {
    return { restored: false, reason: 'no_remote_snapshot' };
  }

  const chunkParts: string[] = [];
  for (let i = 0; i < meta.chunks; i++) {
    const part = await kvGet<string>(cfg.baseUrl, cfg.token, `db_chunk_${i}`);
    if (typeof part !== 'string') {
      throw new Error(`Missing encrypted DB chunk ${i}/${meta.chunks}`);
    }
    chunkParts.push(part);
  }

  const ciphertext = Buffer.from(chunkParts.join(''), 'base64');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveAesKey(),
    Buffer.from(meta.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(meta.tag, 'base64'));
  const gz = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const raw = gunzipSync(gz);

  if (raw.subarray(0, 16).toString('utf8') !== SQLITE_MAGIC) {
    throw new Error('Invalid SQLite header after Cloudflare decrypt');
  }

  const actualSha = crypto.createHash('sha256').update(raw).digest('hex');
  if (actualSha !== meta.sha256) {
    throw new Error('Checksum mismatch restoring database from Cloudflare');
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.restore-${Date.now()}`;
  fs.writeFileSync(tmp, raw);
  fs.rmSync(`${targetPath}-wal`, { force: true });
  fs.rmSync(`${targetPath}-shm`, { force: true });
  fs.renameSync(tmp, targetPath);

  lastCloudSyncAt = meta.updatedAt;
  return { restored: true, bytes: raw.byteLength, updatedAt: meta.updatedAt };
}

export async function pushDatabaseToCloudflare(): Promise<{
  ok: boolean;
  synced: boolean;
  chunks?: number;
  gzBytes?: number;
  updatedAt?: string;
  error?: string;
}> {
  const cfg = getSyncConfig();
  if (!cfg) return { ok: true, synced: false };
  if (syncInFlight) return { ok: true, synced: false };

  syncInFlight = true;
  const snapPath = `/tmp/naidioma-snap-${Date.now()}.db`;

  try {
    fs.rmSync(snapPath, { force: true });
    await prisma.$executeRawUnsafe(`VACUUM INTO '${snapPath.replace(/'/g, "''")}'`);

    const raw = fs.readFileSync(snapPath);
    if (raw.subarray(0, 16).toString('utf8') !== SQLITE_MAGIC) {
      throw new Error('Hot SQLite snapshot failed header check');
    }

    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
    const gz = gzipSync(raw, { level: 9 });
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveAesKey(), iv);
    const encrypted = Buffer.concat([cipher.update(gz), cipher.final()]);
    const tag = cipher.getAuthTag();
    const b64 = encrypted.toString('base64');

    const chunks: string[] = [];
    for (let offset = 0; offset < b64.length; offset += CHUNK_CHAR_SIZE) {
      chunks.push(b64.slice(offset, offset + CHUNK_CHAR_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      await kvPut(cfg.baseUrl, cfg.token, `db_chunk_${i}`, chunks[i]);
    }

    const updatedAt = new Date().toISOString();
    const meta: SnapshotMeta = {
      version: 1,
      chunks: chunks.length,
      sha256,
      rawBytes: raw.byteLength,
      gzBytes: gz.byteLength,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      updatedAt,
    };
    await kvPut(cfg.baseUrl, cfg.token, 'db_meta', meta);

    lastCloudSyncAt = updatedAt;
    lastCloudSyncError = null;
    return { ok: true, synced: true, chunks: chunks.length, gzBytes: gz.byteLength, updatedAt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cloudflare sync error';
    lastCloudSyncError = msg;
    return { ok: false, synced: false, error: msg };
  } finally {
    fs.rmSync(snapPath, { force: true });
    syncInFlight = false;
  }
}

export function scheduleCloudSync(): void {
  if (!getSyncConfig()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushDatabaseToCloudflare();
  }, 2_500);
}

export function getCloudSyncStatus() {
  return {
    configured: Boolean(getSyncConfig()),
    storageBackend: getSyncConfig() ? 'cloudflare-nexacloud-kv-encrypted' : 'container-sqlite',
    lastCloudSyncAt,
    lastCloudSyncError,
  };
}
