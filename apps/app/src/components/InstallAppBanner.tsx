import { useEffect, useState } from 'react';
import {
  DeviceMobile,
  DownloadSimple,
  Export,
  PlusSquare,
  X,
} from '@phosphor-icons/react';
import { hapticSuccess, hapticTap, isNativeMobile } from '../lib/native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'naidioma_pwa_install_dismissed_at';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(nav.standalone) ||
    isNativeMobile()
  );
}

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [installedToast, setInstalledToast] = useState(false);

  useEffect(() => {
    setStandalone(isRunningStandalone());
    setIos(isIosDevice());

    const lastDismiss = localStorage.getItem(DISMISS_KEY);
    if (lastDismiss && Date.now() - Number(lastDismiss) < 3 * 86_400_000) {
      setDismissed(true);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setStandalone(true);
      setInstalledToast(true);
      void hapticSuccess();
      setTimeout(() => setInstalledToast(false), 4000);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installedToast) {
    return (
      <div className="bg-[var(--na-success)] text-white px-4 py-2.5 text-xs font-bold text-center">
        NAidioma instalado na sua tela inicial! Agora funciona até offline.
      </div>
    );
  }

  if (standalone || dismissed) return null;

  // Show on Android/Desktop when native 1-click prompt is ready, OR on iPhone/iPad Safari
  const canInstallOneClick = Boolean(deferredPrompt);
  if (!canInstallOneClick && !ios) return null;

  async function handleOneClickInstall() {
    void hapticTap();
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    if (ios) {
      setIosGuideOpen(true);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  return (
    <>
      <div className="bg-[var(--na-sand)] border-b border-[var(--na-sand-dark)] px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--na-wine)] text-[var(--na-cream)] flex items-center justify-center shrink-0">
              <DeviceMobile size={18} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[var(--na-wine)] leading-tight">
                Baixar app NAidioma (funciona offline)
              </div>
              <div className="text-[11px] text-[var(--na-muted)] truncate">
                {canInstallOneClick
                  ? 'Instale na tela inicial em 1 clique — grátis e sem ocupar espaço.'
                  : 'Adicione à tela inicial do iPhone em 2 toques rápidos.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleOneClickInstall()}
              className="min-h-[44px] px-4 rounded-full bg-[var(--na-burgundy)] text-[var(--na-ivory)] text-xs font-bold inline-flex items-center gap-1.5"
            >
              <DownloadSimple size={14} weight="bold" />
              {canInstallOneClick ? 'Instalar agora' : 'Instalar no iPhone'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dispensar aviso de instalação"
              className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--na-muted)]"
            >
              <X size={15} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* Ultra-simple visual 2-step guide specifically for iPhone Safari (Apple policy requires Share -> Add to Home Screen) */}
      {iosGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="surface-card w-full sm:max-w-md rounded-b-none sm:rounded-[20px] p-6 space-y-5 safe-bottom">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--na-burgundy)]">
                  Instalação rápida no iPhone
                </div>
                <h3 className="font-display text-2xl text-[var(--na-ink)] mt-0.5">
                  Coloque o NAidioma na sua tela inicial
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIosGuideOpen(false)}
                aria-label="Fechar"
                className="w-9 h-9 rounded-[10px] border border-[var(--na-border)] flex items-center justify-center"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-[14px] bg-[var(--na-cream)] border border-[var(--na-border)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-[12px] bg-[var(--na-teal)]/15 text-[var(--na-teal)] flex items-center justify-center shrink-0">
                  <Export size={22} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-ink)] text-sm">
                    1. Toque em Compartilhar
                  </div>
                  <div className="text-[var(--na-muted)]">
                    No ícone de quadradinho com seta para cima na barra inferior do Safari.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-[14px] bg-[var(--na-cream)] border border-[var(--na-border)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-[12px] bg-[var(--na-burgundy)]/15 text-[var(--na-burgundy)] flex items-center justify-center shrink-0">
                  <PlusSquare size={22} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-ink)] text-sm">
                    2. Toque em “Adicionar à Tela de Início”
                  </div>
                  <div className="text-[var(--na-muted)]">
                    Pronto! O ícone do NAidioma aparece como aplicativo real e funciona até offline.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIosGuideOpen(false)}
              className="btn-tactile-primary w-full text-sm"
            >
              Entendi, vou adicionar agora
            </button>
          </div>
        </div>
      )}
    </>
  );
}
