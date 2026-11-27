import { useEffect, useState } from 'react';
import { BellRinging, BellSlash, CheckCircle, PaperPlaneTilt } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { hapticError, hapticSuccess, hapticTap } from '../lib/native';
import { playCorrectSound, playGentleRetrySound, playTapSound } from '../lib/sound';
import { PetSprite } from './PetBuddy';

interface ReminderCardProps {
  petName: string;
  compact?: boolean;
}

const HOUR_OPTIONS = [
  { hour: 9, label: '09h', tag: 'Manhã ☀️' },
  { hour: 15, label: '15h', tag: 'Tarde 🌤️' },
  { hour: 18, label: '18h', tag: 'Fim tarde 🌇' },
  { hour: 20, label: '20h', tag: 'Noite 🌙' },
];

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isIosNotStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone);
  return ios && !standalone;
}

export function ReminderCard({ petName, compact = false }: ReminderCardProps) {
  const [supported, setSupported] = useState(true);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(18);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const needsInstall = isIosNotStandalone();
    setIosNeedsInstall(needsInstall);
    const hasPush =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(hasPush);

    void api
      .getPushStatus()
      .then((res) => {
        setVapidPublicKey(res.vapidPublicKey);
        setEnabled(res.enabled);
        setReminderHour(res.reminderHour);
      })
      .catch(() => {});
  }, []);

  async function enablePush(targetHour = reminderHour) {
    setErrorMsg(null);
    setStatusMsg(null);
    void hapticTap();
    playTapSound();

    if (iosNeedsInstall) {
      setErrorMsg(
        'No iPhone, primeiro toque em Compartilhar → "Adicionar à Tela de Início" e abra o NAidioma pelo ícone do quebra-cabeça para ativar os avisos na tela!',
      );
      return;
    }

    if (!supported) {
      setErrorMsg('Este navegador não suporta avisos push na tela.');
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        void hapticError();
        playGentleRetrySound();
        setErrorMsg('Permissão de aviso bloqueada no celular. Libere notificações nas configurações.');
        return;
      }

      const key = vapidPublicKey || (await api.getPushStatus()).vapidPublicKey;
      setVapidPublicKey(key);

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Não foi possível obter a chave de notificação do aparelho.');
      }

      const tzOffsetHours = Math.round(-new Date().getTimezoneOffset() / 60);
      await api.subscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        reminderHour: targetHour,
        timezoneOffset: tzOffsetHours,
        petName,
      });

      setReminderHour(targetHour);
      setEnabled(true);
      void hapticSuccess();
      playCorrectSound(2);
      setStatusMsg(
        `Avisos ligados às ${String(targetHour).padStart(2, '0')}h! O Dino e ${petName} vão te motivar todo dia 🦕`,
      );
    } catch (err) {
      void hapticError();
      playGentleRetrySound();
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao ativar avisos na tela.');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe().catch(() => {});
      await api.unsubscribePush(endpoint);
      setEnabled(false);
      setStatusMsg('Avisos pausados. Você pode ligar de novo quando quiser.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTestPush() {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    playTapSound();
    try {
      const res = await api.sendTestPush();
      if (res.ok) {
        void hapticSuccess();
        playCorrectSound(2);
        setStatusMsg('Aviso motivacional enviado! Olhe a barra de notificações do aparelho 🦕🔔');
      } else {
        setErrorMsg('Não foi possível entregar agora — toque em Ativar Avisos novamente.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar teste.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`duo-card ${compact ? 'p-4' : 'p-5 sm:p-6'} space-y-3.5`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <PetSprite species="dino" mood={enabled ? 'super_happy' : 'happy'} size={compact ? 56 : 68} />
        </div>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--na-burgundy)]">
            <BellRinging size={14} weight="fill" />
            Avisos Motivacionais na Tela
          </div>
          <h3 className="font-display text-base sm:text-lg text-[var(--na-ink)] leading-snug">
            {enabled
              ? `Lembrete ligado às ${String(reminderHour).padStart(2, '0')}h!`
              : 'Lembrete diário do Dino na tela do celular 🦕'}
          </h3>
          <p className="text-xs font-semibold text-[var(--na-muted)]">
            Frases carinhosas que dão vontade de brincar e nunca deixam esquecer — só avisa se não estudou ainda!
          </p>
        </div>
      </div>

      {/* Escolha do horário do lembrete */}
      <div className="grid grid-cols-4 gap-2">
        {HOUR_OPTIONS.map((opt) => {
          const active = reminderHour === opt.hour;
          return (
            <button
              key={opt.hour}
              type="button"
              disabled={busy}
              onClick={() => {
                setReminderHour(opt.hour);
                if (enabled) {
                  void enablePush(opt.hour);
                } else {
                  playTapSound();
                }
              }}
              className={`py-2 px-1.5 rounded-2xl border-2 border-b-4 text-center transition-all ${
                active
                  ? 'bg-[var(--na-gold-soft)] border-[var(--na-gold)] text-[#5a3b00]'
                  : 'bg-[var(--na-cream)] border-[var(--na-border)] text-[var(--na-muted)]'
              }`}
            >
              <div className="text-xs font-extrabold">{opt.label}</div>
              <div className="text-[10px] font-bold truncate">{opt.tag}</div>
            </button>
          );
        })}
      </div>

      {statusMsg && (
        <div className="p-2.5 rounded-2xl bg-[var(--na-success-soft)] border border-[var(--na-success)]/40 text-xs font-extrabold text-[var(--na-success-dark)] flex items-center gap-1.5">
          <CheckCircle size={16} weight="fill" className="shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-2xl bg-[var(--na-error-soft)] border border-[var(--na-error)]/40 text-xs font-bold text-[var(--na-error)]">
          {errorMsg}
        </div>
      )}

      {!enabled ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enablePush(reminderHour)}
          className="duo-btn-wine w-full min-h-[46px] text-xs sm:text-sm uppercase tracking-wide flex items-center justify-center gap-2"
        >
          <BellRinging size={18} weight="fill" />
          {busy ? 'Ativando...' : 'ATIVAR AVISOS NA TELA 🔔'}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleTestPush()}
            className="duo-btn-teal flex-1 min-h-[44px] px-3 text-xs uppercase tracking-wide inline-flex items-center justify-center gap-1.5"
          >
            <PaperPlaneTilt size={16} weight="fill" />
            Testar aviso agora
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void disablePush()}
            className="duo-btn-white px-3 min-h-[44px] text-xs text-[var(--na-muted)] inline-flex items-center gap-1"
            title="Desativar lembretes"
          >
            <BellSlash size={15} weight="bold" /> Pausar
          </button>
        </div>
      )}
    </div>
  );
}
