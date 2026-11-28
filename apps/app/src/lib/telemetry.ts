import type { CefrLevel, LanguageCode } from '@naidioma/shared';
import { getAuthToken } from './api';
import { getPlatform } from './native';
import { isCalmModeEnabled, isSoundEnabled } from './sound';

const VISITOR_KEY = 'naidioma_visitor_id';
const SESSION_KEY = 'naidioma_session_id';
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export type TelemetryPlatform = 'web' | 'pwa' | 'android' | 'ios';

interface TelemetryState {
  started: boolean;
  sessionId: string | null;
  pendingSeconds: number;
  screen: string;
  language?: LanguageCode;
  pwaInstalled: boolean;
  calmModeEnabled: boolean;
  soundEnabled: boolean;
  tickTimer: number | null;
  flushTimer: number | null;
}

const state: TelemetryState = {
  started: false,
  sessionId: null,
  pendingSeconds: 0,
  screen: 'auth',
  language: undefined,
  pwaInstalled: false,
  calmModeEnabled: false,
  soundEnabled: true,
  tickTimer: null,
  flushTimer: null,
};

function isDashboardRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/dashboard');
}

export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `v_${crypto.randomUUID()}`
        : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_KEY, generated);
    return generated;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

export function getClientTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function isPwaStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  );
}

export function detectClientPlatform(): TelemetryPlatform {
  const native = getPlatform();
  if (native === 'android' || native === 'ios') return native;
  return isPwaStandaloneMode() ? 'pwa' : 'web';
}

async function postTelemetry(path: string, body: Record<string, unknown>, useBeacon = false) {
  if (typeof window === 'undefined' || isDashboardRoute()) return null;
  const url = `${API_BASE}${path}`;
  const payload = JSON.stringify(body);

  if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
      navigator.sendBeacon(url, blob);
      return null;
    } catch {
      // fall through to fetch keepalive
    }
  }

  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      keepalive: useBeacon,
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

export async function startTelemetrySession(opts?: {
  language?: LanguageCode;
  screen?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || isDashboardRoute()) return;

  const visitorId = getVisitorId();
  const cachedSession = (() => {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  })();

  const params = new URLSearchParams(window.location.search);
  const pwaInstalled = isPwaStandaloneMode();
  state.pwaInstalled = pwaInstalled;
  state.calmModeEnabled = isCalmModeEnabled();
  state.soundEnabled = isSoundEnabled();
  if (opts?.language) state.language = opts.language;
  if (opts?.screen) state.screen = opts.screen;

  const res = await postTelemetry('/api/telemetry/session/start', {
    visitorId,
    sessionId: state.sessionId ?? cachedSession,
    entryPath: window.location.pathname || '/',
    referrer: document.referrer || null,
    utmSource: params.get('utm_source') || params.get('ref') || null,
    utmMedium: params.get('utm_medium') || null,
    utmCampaign: params.get('utm_campaign') || null,
    platform: detectClientPlatform(),
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    pwaInstalled,
    calmModeEnabled: state.calmModeEnabled,
    soundEnabled: state.soundEnabled,
    timezone: getClientTimezone(),
    activeLanguage: state.language,
  });

  if (res && typeof res.sessionId === 'string') {
    state.sessionId = res.sessionId;
    try {
      window.sessionStorage.setItem(SESSION_KEY, res.sessionId);
    } catch {
      // ignore storage quota errors
    }
  }

  if (!state.started) {
    state.started = true;
    state.tickTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !isDashboardRoute()) {
        state.pendingSeconds += 1;
      }
    }, 1000);

    state.flushTimer = window.setInterval(() => {
      void flushTelemetryNow(false);
    }, 45_000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void flushTelemetryNow(true);
      }
    });

    window.addEventListener('pagehide', () => {
      void flushTelemetryNow(true);
    });
  }
}

export function setTelemetryContext(patch: {
  screen?: string;
  language?: LanguageCode;
  pwaInstalled?: boolean;
  calmModeEnabled?: boolean;
  soundEnabled?: boolean;
}): void {
  if (patch.screen && patch.screen !== state.screen && state.pendingSeconds >= 5) {
    void flushTelemetryNow(false);
  }
  if (patch.screen) state.screen = patch.screen;
  if (patch.language) state.language = patch.language;
  if (typeof patch.pwaInstalled === 'boolean') state.pwaInstalled = patch.pwaInstalled;
  if (typeof patch.calmModeEnabled === 'boolean') state.calmModeEnabled = patch.calmModeEnabled;
  if (typeof patch.soundEnabled === 'boolean') state.soundEnabled = patch.soundEnabled;
}

export async function flushTelemetryNow(useBeacon = false): Promise<void> {
  if (typeof window === 'undefined' || isDashboardRoute()) return;
  if (!state.sessionId || state.pendingSeconds < 1) return;

  const delta = Math.min(180, state.pendingSeconds);
  state.pendingSeconds = 0;

  await postTelemetry(
    '/api/telemetry/heartbeat',
    {
      visitorId: getVisitorId(),
      sessionId: state.sessionId,
      deltaSeconds: delta,
      screen: state.screen,
      path: window.location.pathname || '/',
      language: state.language,
      pwaInstalled: state.pwaInstalled || isPwaStandaloneMode(),
      calmModeEnabled: state.calmModeEnabled,
      soundEnabled: state.soundEnabled,
    },
    useBeacon,
  );
}

export function trackTelemetryEvent(
  eventType: string,
  details?: {
    language?: LanguageCode;
    cefr?: CefrLevel;
    lessonId?: string;
    screen?: string;
    valueNum?: number;
    meta?: Record<string, string | number | boolean | null>;
  },
): void {
  if (typeof window === 'undefined' || isDashboardRoute()) return;
  void postTelemetry('/api/telemetry/event', {
    visitorId: getVisitorId(),
    sessionId: state.sessionId ?? undefined,
    eventType,
    language: details?.language ?? state.language,
    cefr: details?.cefr,
    lessonId: details?.lessonId,
    screen: details?.screen ?? state.screen,
    valueNum: details?.valueNum,
    meta: details?.meta,
    platform: detectClientPlatform(),
  });
}
