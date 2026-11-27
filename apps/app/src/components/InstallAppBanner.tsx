import { useEffect, useState } from 'react';
import {
  Desktop,
  DotsThreeVertical,
  DownloadSimple,
  Export,
  PlusSquare,
  X,
} from '@phosphor-icons/react';
import { usePwaInstall } from '../lib/pwaInstall';

const DISMISS_KEY = 'naidioma_pwa_install_dismissed_at';

export function InstallAppBanner() {
  const {
    isStandalone,
    canInstallNative,
    platform,
    inAppBrowser,
    installingAndroid,
    installedToast,
    guideOpen,
    triggerInstall,
    closeGuide,
  } = usePwaInstall();

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const lastDismiss = localStorage.getItem(DISMISS_KEY);
    if (lastDismiss && Date.now() - Number(lastDismiss) < 3 * 86_400_000) {
      setDismissed(true);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  const showBanner = !isStandalone && !dismissed && !installingAndroid && !installedToast;

  return (
    <>
      {installingAndroid && (
        <div className="bg-[var(--na-teal)] text-white px-4 py-3 text-xs font-extrabold text-center leading-relaxed">
          ⏳ Instalando o app NAidioma no seu Android... mantenha esta página aberta por ~10 segundos até o Chrome finalizar!
        </div>
      )}

      {installedToast && (
        <div className="bg-[var(--na-success)] text-white px-4 py-3 text-xs font-extrabold text-center leading-relaxed">
          ✅ NAidioma instalado! Procure o ícone &quot;NAidioma&quot; na sua gaveta de apps instalados ou na última página da tela inicial.
        </div>
      )}

      {showBanner && (
        <div className="bg-[var(--na-gold-soft)] border-b-2 border-[var(--na-gold)] px-4 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[var(--na-burgundy)] text-white border-b-4 border-[var(--na-wine-deep)] flex items-center justify-center text-lg shrink-0">
                🧩
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[#5a3b00] leading-tight">
                  Instalar app NAidioma (funciona offline!)
                </div>
                <div className="text-[11px] font-bold text-[#8a6010] truncate">
                  {canInstallNative
                    ? 'Instale como aplicativo oficial em 1 toque.'
                    : platform === 'android' && inAppBrowser
                      ? 'Abra no Google Chrome para instalar nos seus apps.'
                      : platform === 'android'
                        ? 'Instale como app no Android em 2 toques (Chrome).'
                        : platform === 'ios'
                          ? 'Coloque no iPhone em 2 toques bem fáceis.'
                          : 'Instale no computador ou celular para acesso rápido.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void triggerInstall()}
                className="min-h-[42px] px-4 rounded-2xl bg-[var(--na-burgundy)] text-white border-2 border-[var(--na-wine-deep)] border-b-4 text-xs font-extrabold inline-flex items-center gap-1.5 active:translate-y-[2px]"
              >
                <DownloadSimple size={15} weight="bold" />
                {canInstallNative
                  ? 'Instalar'
                  : platform === 'ios'
                    ? 'Instalar no iPhone'
                    : 'Instalar App'}
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
      )}

      {guideOpen === 'ios' && (
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
                onClick={closeGuide}
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
              onClick={closeGuide}
              className="duo-btn-emerald w-full text-sm uppercase tracking-wide"
            >
              ENTENDI, VOU ADICIONAR AGORA!
            </button>
          </div>
        </div>
      )}

      {guideOpen === 'android' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="duo-card w-full sm:max-w-md rounded-b-none sm:rounded-[24px] p-6 space-y-5 safe-bottom">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-burgundy)]">
                  Instalar no Android (Gaveta de Apps)
                </div>
                <h3 className="font-display text-2xl text-[var(--na-ink)] mt-0.5">
                  Instale como App Oficial no Android 🧩
                </h3>
              </div>
              <button
                type="button"
                onClick={closeGuide}
                aria-label="Fechar"
                className="w-9 h-9 rounded-xl border-2 border-[var(--na-border)] flex items-center justify-center"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {inAppBrowser && (
              <div className="p-3.5 rounded-2xl bg-[var(--na-error-soft)] border-2 border-[var(--na-error)] text-xs font-extrabold text-[var(--na-error-dark)] leading-relaxed">
                ⚠️ Você abriu o link dentro do WhatsApp/Instagram. Toque nos 3 pontinhos (⋮) lá em cima e escolha <strong>“Abrir no Chrome”</strong> primeiro — senão o Android não instala na lista de apps!
              </div>
            )}

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--na-teal)] text-white flex items-center justify-center shrink-0">
                  <DotsThreeVertical size={24} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-teal-dark)] text-sm">
                    1. Abra no Google Chrome e toque nos 3 pontinhos (⋮)
                  </div>
                  <div className="font-semibold text-[var(--na-ink)]">
                    No canto superior direito da barra de endereço do Chrome.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--na-rose-soft)] border-2 border-[var(--na-burgundy)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--na-burgundy)] text-white flex items-center justify-center shrink-0">
                  <DownloadSimple size={22} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-wine-deep)] text-sm">
                    2. Toque em “Adicionar à tela inicial” → escolha “Instalar”
                  </div>
                  <div className="font-semibold text-[var(--na-ink)]">
                    Escolha <strong>Instalar</strong> (não “Criar atalho”) e aguarde ~10 segundos — ele vai aparecer junto com todos os seus apps instalados!
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeGuide}
              className="duo-btn-emerald w-full text-sm uppercase tracking-wide"
            >
              ENTENDI, VOU INSTALAR AGORA!
            </button>
          </div>
        </div>
      )}

      {guideOpen === 'desktop' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="duo-card w-full sm:max-w-md rounded-b-none sm:rounded-[24px] p-6 space-y-5 safe-bottom">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-burgundy)]">
                  Instalar no Computador
                </div>
                <h3 className="font-display text-2xl text-[var(--na-ink)] mt-0.5">
                  Use o NAidioma como App no PC / Mac 🧩
                </h3>
              </div>
              <button
                type="button"
                onClick={closeGuide}
                aria-label="Fechar"
                className="w-9 h-9 rounded-xl border-2 border-[var(--na-border)] flex items-center justify-center"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[var(--na-teal-soft)] border-2 border-[var(--na-teal)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--na-teal)] text-white flex items-center justify-center shrink-0">
                  <Desktop size={22} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-teal-dark)] text-sm">
                    Chrome ou Edge
                  </div>
                  <div className="font-semibold text-[var(--na-ink)]">
                    Clique no ícone de <strong>Instalar (monitor com setinha)</strong> no canto direito da barra de endereço ou no menu <strong>⋮ → Salvar e compartilhar → Instalar NAidioma</strong>.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--na-rose-soft)] border-2 border-[var(--na-burgundy)] flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--na-burgundy)] text-white flex items-center justify-center shrink-0">
                  <Export size={22} weight="bold" />
                </div>
                <div className="text-xs leading-relaxed">
                  <div className="font-extrabold text-[var(--na-wine-deep)] text-sm">
                    Safari no Mac
                  </div>
                  <div className="font-semibold text-[var(--na-ink)]">
                    Clique em <strong>Arquivo → Adicionar ao Dock</strong> para abrir o NAidioma como aplicativo dedicado.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeGuide}
              className="duo-btn-emerald w-full text-sm uppercase tracking-wide"
            >
              ENTENDI!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
