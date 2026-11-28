export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe < 60) return `${safe}s`;
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatDateTimeBr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDateBr(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

export function formatRelativeBr(iso?: string | null): string {
  if (!iso) return 'Nunca';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'Agora';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return 'Agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return formatShortDateBr(iso);
}

export const CEFR_BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A1: { bg: '#E2F7FB', text: '#0C6F84', border: '#1496B0' },
  A2: { bg: '#E2F9EB', text: '#1D8A45', border: '#2CB65E' },
  B1: { bg: '#FFF6D6', text: '#7A5200', border: '#E5A300' },
  B2: { bg: '#FFF0E6', text: '#A83A08', border: '#F26522' },
  C1: { bg: '#FFE8F0', text: '#7A1436', border: '#C12B5B' },
  C2: { bg: '#FCE4EC', text: '#570D27', border: '#8E1C43' },
};

export const SCREEN_LABEL_PT: Record<string, string> = {
  learn: 'Trilha de Estudos',
  lesson: 'Player de Lições',
  alphabet: 'Letras / Hangul',
  conversation: 'Chat Tutor IA',
  live_call: 'Chamada ao Vivo IA',
  review: 'Revisão FSRS',
  profile: 'Perfil & Config',
  auth: 'Tela Inicial / Cadastro',
};

export const EVENT_LABEL_PT: Record<string, string> = {
  signup_completed: 'Cadastro concluído',
  login_completed: 'Login realizado',
  onboarding_language_picked: 'Escolheu idioma no onboarding',
  signup_started: 'Iniciou cadastro',
  lesson_started: 'Iniciou lição',
  lesson_completed: 'Concluiu lição',
  lesson_abandoned: 'Saiu da lição antes de concluir',
  exam_passed: 'Aprovado no Exame Oficial',
  exam_failed: 'Tentou Exame Oficial',
  review_completed: 'Revisão FSRS',
  ai_chat_started: 'Abriu Chat Tutor IA',
  ai_chat_turn: 'Turno no Tutor IA',
  live_call_started: 'Iniciou Chamada ao Vivo IA',
  calm_mode_toggled: 'Alternou Modo Calmo',
  language_switched: 'Trocou de idioma',
  pwa_installed: 'Instalou App PWA',
};

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
