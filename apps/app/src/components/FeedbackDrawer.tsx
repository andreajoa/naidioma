import { useState, type FormEvent } from 'react';
import { ChatTeardropText, CheckCircle, X } from '@phosphor-icons/react';
import type { FeedbackCategory, LanguageCode } from '@naidioma/shared';
import { api } from '../lib/api';
import { hapticSuccess, hapticTap } from '../lib/native';

interface FeedbackDrawerProps {
  language: LanguageCode;
  route: string;
  onClose: () => void;
}

const CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'ux', label: 'Usabilidade' },
  { value: 'bug', label: 'Erro / Bug' },
  { value: 'translation', label: 'Tradução' },
  { value: 'audio', label: 'Áudio / Voz' },
  { value: 'idea', label: 'Sugestão' },
];

export function FeedbackDrawer({ language, route, onClose }: FeedbackDrawerProps) {
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    void hapticTap();
    try {
      await api.sendFeedback({ category, language, route, message });
      void hapticSuccess();
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar feedback.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="surface-card w-full sm:max-w-md rounded-b-none sm:rounded-[18px] p-6 space-y-4 safe-bottom">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-[var(--na-wine)]">
            <ChatTeardropText size={20} weight="duotone" />
            Enviar feedback do beta
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar feedback"
            className="w-11 h-11 rounded-[10px] border border-[var(--na-border)] flex items-center justify-center"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle size={40} weight="fill" className="mx-auto text-[var(--na-success)]" />
            <div className="font-display text-2xl">Obrigado pelo retorno!</div>
            <p className="text-xs text-[var(--na-muted)]">
              Sua observação foi registrada e será usada para atualizar Web, Android e iOS juntos.
            </p>
            <button type="button" onClick={onClose} className="btn-tactile-primary px-6 text-sm">
              Voltar ao estudo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    category === c.value
                      ? 'bg-[var(--na-wine)] text-[var(--na-ivory)] border-[var(--na-wine-deep)]'
                      : 'bg-[var(--na-cream)] text-[var(--na-ink)] border-[var(--na-border)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div>
              <label
                htmlFor="na-feedback-msg"
                className="block text-xs font-bold uppercase tracking-wider text-[var(--na-muted)] mb-1.5"
              >
                O que podemos melhorar?
              </label>
              <textarea
                id="na-feedback-msg"
                required
                minLength={4}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex.: Achei o áudio rápido demais nessa lição / Queria mais cenários de entrevista..."
                className="w-full p-3.5 rounded-[12px] bg-[var(--na-cream)] border border-[var(--na-border)] text-sm"
              />
            </div>

            {error && <div className="text-xs text-[var(--na-error)]">{error}</div>}

            <button
              type="submit"
              disabled={sending}
              className="btn-tactile-primary w-full text-sm"
            >
              {sending ? 'Enviando...' : 'Enviar para a equipe NAidioma'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
