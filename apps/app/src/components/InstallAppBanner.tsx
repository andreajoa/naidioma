import { useEffect, useState } from 'react';
import { DownloadSimple, Export, PlusSquare, X } from '@phosphor-icons/react';
import { hapticSuccess, hapticTap, isNativeMobile } from '../lib/native';
import { playCorrectSound, playTapSound } from '../lib/sound';

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
      playCorrectSound(2);
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
      <div className="bg-[var(--na-success)] text-white px-4 py-2.5 text-xs font-extrabold text-center">
        🧩 NAidioma instalado na tela inicial! Agora funciona até sem internet.
      </div>
    );
  }

  if (standalone || dismissed) return null;

  const canInstallOneClick = Boolean(deferredPrompt);
  if (!canInstallOneClick && !ios) return null;

  async function handleOneClickInstall() {
    void hapticTap();
    playTapSound();
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
      <div className="bg-[var(--na-gold-soft)] border-b-2 border-[var(--na-gold)] px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--na-burgundy)] text-white border-b-4 border-[var(--na-wine-deep)] flex items-center justify-center text-lg shrink-0">
              🧩
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-[#5a3b00] leading-tight">
                Baixar app NAidioma (funciona offline!)
              </div>
              <div className="text-[11px] font-bold text-[#8a6010] truncate">
                {canInstallOneClick
                  ? 'Instale na tela inicial em 1 clique.'
                  : 'Coloque no iPhone em 2 toques bem fáceis.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleOneClickInstall()}
              className="min-h-[42px] px-4 rounded-2xl bg-[var(--na-burgundy)] text-white border-2 border-[var(--na-wine-deep)] border-b-4 text-xs font-extrabold inline-flex items-center gap-1.5 active:translate-y-[2px]"
            >
              <DownloadSimple size={15} weight="bold" />
              {canInstallOneClick ? 'Instalar' : 'Instalar no iPhone'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Fechar aviso"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#7a5200]"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {iosGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="duo-card w-full sm:max-w-md rounded-b-none sm:rounded-[24px] p-6 space-y-5 safe-bottom">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-burgundy)]">
                  Instalar no iPhone / iPad
                </div>
                <h3 className="font-display text-2xl text-[var(--na-ink)] mt-0.5">
                  Coloque o NAidioma na tela inicial 🧩
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIosGuideOpen(false)}
                aria-label="Fechar"
                className="w-9 h-9 rounded-xl border-2 border-[var(--na-border)] flex items-center justify-center"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--na-teal)] text-white flex items-center justify-center shrink-0">
                  <Export size={22} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-teal-dark)] text-sm">
                    1. Toque em Compartilhar
                  </div>
                  <div className="font-semibold text-[var(--na-ink)]">
                    No quadradinho com seta para cima na barra de baixo do Safari.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--na-rose-soft)] border-2 border-[var(--na-burgundy)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--na-burgundy)] text-white flex items-center justify-center shrink-0">
                  <PlusSquare size={22} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-wine-deep)] text-sm">
                    2. Toque em “Adicionar à Tela de Início”
                  </div>
                  <div className="font-semibold text-[var(--na-ink)]">
                    Pronto! O quebra-cabeça do NAidioma vira app e funciona offline.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIosGuideOpen(false)}
              className="duo-btn-emerald w-full text-sm uppercase tracking-wide"
            >
              ENTENDI, VOU ADICIONAR AGORA!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
