import { useEffect, useState } from 'react';
import { hapticSuccess, hapticTap, isNativeMobile } from './native';
import { playCorrectSound, playTapSound } from './sound';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';
export type InstallGuidePlatform = InstallPlatform | null;

export interface PwaInstallSnapshot {
  isStandalone: boolean;
  canInstallNative: boolean;
  platform: InstallPlatform;
  inAppBrowser: boolean;
  installingAndroid: boolean;
  installedToast: boolean;
  guideOpen: InstallGuidePlatform;
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function detectPlatform(): InstallPlatform {
  if (detectIos()) return 'ios';
  if (detectAndroid()) return 'android';
  return 'desktop';
}

function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|wv\)|; wv\)/i.test(navigator.userAgent);
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    Boolean(nav.standalone) ||
    isNativeMobile()
  );
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let androidFallbackTimer: number | null = null;
let toastHideTimer: number | null = null;
let initialized = false;

let snapshot: PwaInstallSnapshot = {
  isStandalone: false,
  canInstallNative: false,
  platform: 'desktop',
  inAppBrowser: false,
  installingAndroid: false,
  installedToast: false,
  guideOpen: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function updateSnapshot(patch: Partial<PwaInstallSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

function scheduleToastHide() {
  if (typeof window === 'undefined') return;
  if (toastHideTimer !== null) {
    window.clearTimeout(toastHideTimer);
  }
  toastHideTimer = window.setTimeout(() => {
    toastHideTimer = null;
    updateSnapshot({ installedToast: false });
  }, 9000);
}

function ensureInitialized() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  snapshot = {
    isStandalone: detectStandalone(),
    canInstallNative: Boolean(deferredPrompt),
    platform: detectPlatform(),
    inAppBrowser: detectInAppBrowser(),
    installingAndroid: false,
    installedToast: false,
    guideOpen: null,
  };

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    updateSnapshot({ canInstallNative: true });
  });

  window.addEventListener('appinstalled', () => {
    if (androidFallbackTimer !== null) {
      window.clearTimeout(androidFallbackTimer);
      androidFallbackTimer = null;
    }
    deferredPrompt = null;
    updateSnapshot({
      canInstallNative: false,
      installingAndroid: false,
      isStandalone: true,
      installedToast: true,
      guideOpen: null,
    });
    void hapticSuccess();
    playCorrectSound(2);
    scheduleToastHide();
  });

  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  const onDisplayModeChange = () => {
    updateSnapshot({ isStandalone: detectStandalone() });
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onDisplayModeChange);
  }
}

// Capture beforeinstallprompt immediately at module load so we never miss early browser events
ensureInitialized();

export async function triggerPwaInstall(): Promise<void> {
  ensureInitialized();
  void hapticTap();
  playTapSound();

  if (deferredPrompt) {
    const promptEvent = deferredPrompt;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        deferredPrompt = null;
        updateSnapshot({ canInstallNative: false, guideOpen: null });
        if (snapshot.platform === 'android') {
          updateSnapshot({ installingAndroid: true });
          if (androidFallbackTimer !== null) {
            window.clearTimeout(androidFallbackTimer);
          }
          androidFallbackTimer = window.setTimeout(() => {
            androidFallbackTimer = null;
            updateSnapshot({ installingAndroid: false, installedToast: true });
            scheduleToastHide();
          }, 16_000);
        }
      }
      return;
    } catch {
      deferredPrompt = null;
      updateSnapshot({ canInstallNative: false });
    }
  }

  updateSnapshot({ guideOpen: snapshot.platform });
}

export function closeInstallGuide(): void {
  updateSnapshot({ guideOpen: null });
}

export function usePwaInstall() {
  ensureInitialized();
  const [state, setState] = useState<PwaInstallSnapshot>(snapshot);

  useEffect(() => {
    setState(snapshot);
    const onChange = () => setState(snapshot);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return {
    ...state,
    triggerInstall: triggerPwaInstall,
    closeGuide: closeInstallGuide,
  };
}
