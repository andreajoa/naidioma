import { motion } from 'motion/react';
import type { LanguageCode } from '@naidioma/shared';
import { hapticTap } from '../lib/native';
import { playCharacterCheerSound } from '../lib/sound';
import { PuzzleMascot } from './Mascots';

/**
 * Bandeiras vetoriais nítidas (SVG) para a barra inferior estilo Duolingo,
 * garantindo visual uniforme e perfeito no iPhone, Android, Windows e Mac.
 */
export function FlagSvg({ code, className = 'w-9 h-6' }: { code: LanguageCode; className?: string }) {
  switch (code) {
    case 'ko':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="36" height="24" fill="#FFFFFF" />
          <circle cx="18" cy="12" r="5.5" fill="#CD2E3A" />
          <path d="M12.5 12 A5.5 5.5 0 0 0 23.5 12 A2.75 2.75 0 0 1 18 12 A2.75 2.75 0 0 0 12.5 12 Z" fill="#0047A0" />
          <g stroke="#242126" strokeWidth="1.2" strokeLinecap="round">
            <line x1="7" y1="6" x2="10" y2="4" />
            <line x1="8.2" y1="7.5" x2="11.2" y2="5.5" />
            <line x1="26" y1="4" x2="29" y2="6" />
            <line x1="24.8" y1="5.5" x2="27.8" y2="7.5" />
            <line x1="7" y1="18" x2="10" y2="20" />
            <line x1="26" y1="20" x2="29" y2="18" />
          </g>
        </svg>
      );
    case 'en':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="36" height="24" fill="#FFFFFF" />
          <rect y="0" width="36" height="3.4" fill="#D9363E" />
          <rect y="6.8" width="36" height="3.4" fill="#D9363E" />
          <rect y="13.6" width="36" height="3.4" fill="#D9363E" />
          <rect y="20.4" width="36" height="3.6" fill="#D9363E" />
          <rect width="16" height="13.6" fill="#1C5B9E" />
          <circle cx="4" cy="4" r="1.1" fill="#FFFFFF" />
          <circle cx="8" cy="4" r="1.1" fill="#FFFFFF" />
          <circle cx="12" cy="4" r="1.1" fill="#FFFFFF" />
          <circle cx="6" cy="7.5" r="1.1" fill="#FFFFFF" />
          <circle cx="10" cy="7.5" r="1.1" fill="#FFFFFF" />
          <circle cx="4" cy="10.5" r="1.1" fill="#FFFFFF" />
          <circle cx="8" cy="10.5" r="1.1" fill="#FFFFFF" />
          <circle cx="12" cy="10.5" r="1.1" fill="#FFFFFF" />
        </svg>
      );
    case 'es':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="36" height="24" fill="#F4B400" />
          <rect width="36" height="6" fill="#D9363E" />
          <rect y="18" width="36" height="6" fill="#D9363E" />
          <rect x="9" y="9" width="4" height="6" rx="1.5" fill="#C12B5B" />
        </svg>
      );
    case 'fr':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="12" height="24" fill="#1D63B8" />
          <rect x="12" width="12" height="24" fill="#FFFFFF" />
          <rect x="24" width="12" height="24" fill="#E04338" />
        </svg>
      );
    case 'de':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="36" height="8" fill="#242126" />
          <rect y="8" width="36" height="8" fill="#E04338" />
          <rect y="16" width="36" height="8" fill="#F4B400" />
        </svg>
      );
    case 'it':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="12" height="24" fill="#2CB65E" />
          <rect x="12" width="12" height="24" fill="#FFFFFF" />
          <rect x="24" width="12" height="24" fill="#E04338" />
        </svg>
      );
    case 'ja':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="36" height="24" fill="#FFFFFF" />
          <circle cx="18" cy="12" r="6" fill="#E04338" />
        </svg>
      );
    case 'zh':
      return (
        <svg viewBox="0 0 36 24" className={`rounded-[6px] border border-black/10 shrink-0 ${className}`} aria-hidden="true">
          <rect width="36" height="24" fill="#DE352B" />
          <polygon points="8,5 9.2,8.5 13,8.5 10,10.7 11.2,14.2 8,12 4.8,14.2 6,10.7 3,8.5 6.8,8.5" fill="#F4B400" />
          <circle cx="15" cy="5.5" r="1.2" fill="#F4B400" />
          <circle cx="17" cy="8.5" r="1.2" fill="#F4B400" />
          <circle cx="17" cy="12" r="1.2" fill="#F4B400" />
          <circle cx="15" cy="15" r="1.2" fill="#F4B400" />
        </svg>
      );
  }
}

function MiniPuzzlePiece({
  color,
  shade,
  size = 46,
}: {
  color: string;
  shade: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="overflow-visible">
      <path
        d="M24 28 H40 C39 18 44 12 52 12 C60 12 65 18 64 28 H78 C84 28 88 32 88 38 V49 C96 48 100 53 100 60 C100 67 96 72 88 71 V82 C88 88 84 92 78 92 H24 C18 92 14 88 14 82 V38 C14 32 18 28 24 28 Z"
        fill={shade}
        transform="translate(0, 4)"
      />
      <path
        d="M24 28 H40 C39 18 44 12 52 12 C60 12 65 18 64 28 H78 C84 28 88 32 88 38 V49 C96 48 100 53 100 60 C100 67 96 72 88 71 V82 C88 88 84 92 78 92 H24 C18 92 14 88 14 82 V38 C14 32 18 28 24 28 Z"
        fill={color}
      />
      <path d="M26 36 H40" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

/**
 * Cena animada de abertura inspirada exatamente na tela inicial do Duolingo:
 * Celular isométrico com trilha dourada + Puz (Quebra-Cabeça) + personagens inclusivos
 * (fones sensoriais, símbolo infinito da neurodiversidade, girassol, faísca de hiperfoco TDAH e peças flutuando).
 */
export function HeroAutismScene() {
  function cheer() {
    void hapticTap();
    playCharacterCheerSound();
  }

  return (
    <div
      className="relative w-[320px] h-[300px] sm:w-[410px] sm:h-[360px] mx-auto select-none cursor-pointer"
      onClick={cheer}
      role="img"
      aria-label="Cena animada do NAidioma com o mascote quebra-cabeça Puz, crianças com fones sensoriais, símbolo do autismo e TDAH flutuando ao redor do aplicativo"
    >
      {/* 1. CELULAR ISOMÉTRICO INCLINADO NA BASE (Trilha de bolinhas douradas igual ao Duolingo!) */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[22%] bottom-[6%] w-[46%] z-10"
      >
        <svg viewBox="0 0 210 170" className="w-full h-auto overflow-visible">
          {/* Sombra macia */}
          <ellipse cx="105" cy="148" rx="74" ry="14" fill="#7A1436" opacity="0.1" />
          {/* Base 3D bordô/esmeralda do celular inclinado */}
          <g transform="rotate(-24 105 90)">
            <rect x="34" y="24" width="136" height="122" rx="24" fill="#8E1C41" transform="translate(0, 10)" />
            <rect x="34" y="24" width="136" height="122" rx="24" fill="#C12B5B" />
            {/* Tela clara */}
            <rect x="44" y="34" width="116" height="100" rx="16" fill="#FFFDF9" />
            {/* Trilha pontilhada */}
            <path
              d="M74 58 C108 58 124 80 96 96 C76 108 112 118 128 116"
              stroke="#E6D7C4"
              strokeWidth="6"
              strokeDasharray="6 6"
              strokeLinecap="round"
              fill="none"
            />
            {/* Nós dourados 3D da trilha */}
            <circle cx="74" cy="58" r="15" fill="#C98A00" transform="translate(0, 3.5)" />
            <circle cx="74" cy="58" r="15" fill="#F4B400" />
            <circle cx="118" cy="84" r="16" fill="#0C6F84" transform="translate(0, 3.5)" />
            <circle cx="118" cy="84" r="16" fill="#1496B0" />
            <circle cx="84" cy="108" r="15" fill="#1D8A45" transform="translate(0, 3.5)" />
            <circle cx="84" cy="108" r="15" fill="#2CB65E" />
            <circle cx="132" cy="112" r="14" fill="#C98A00" transform="translate(0, 3.5)" />
            <circle cx="132" cy="112" r="14" fill="#F4B400" />
          </g>
        </svg>
      </motion.div>

      {/* 2. MASCOTE PRINCIPAL PUZ (QUEBRA-CABEÇA) — Posição exata da coruja do Duolingo (centro-direita)! */}
      <motion.div
        animate={{ y: [0, -11, 0], rotate: [-2, 3, -2] }}
        transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.08 }}
        className="absolute right-[2%] top-[28%] z-30"
      >
        <PuzzleMascot mood="wave" size={162} className="sm:scale-110" />
      </motion.div>

      {/* 3. MENINO LÉO FLUTUANDO COM FONES SENSORIAIS (Autismo & TDAH!) — Centro-esquerda */}
      <motion.div
        animate={{ y: [0, -9, 0], rotate: [-8, -2, -8] }}
        transition={{ duration: 3.6, delay: 0.2, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.1 }}
        className="absolute left-[14%] top-[34%] w-[28%] z-20"
      >
        <svg viewBox="0 0 130 130" className="w-full h-auto overflow-visible">
          {/* Braços abertos voando */}
          <path d="M36 74 L14 58" stroke="#1496B0" strokeWidth="13" strokeLinecap="round" />
          <path d="M94 74 L116 60" stroke="#1496B0" strokeWidth="13" strokeLinecap="round" />
          <circle cx="14" cy="58" r="7" fill="#FFD6B0" />
          <circle cx="116" cy="60" r="7" fill="#FFD6B0" />
          {/* Corpo camiseta azul-petróleo com pecinha dourada */}
          <rect x="38" y="64" width="54" height="44" rx="22" fill="#1496B0" stroke="#0C6F84" strokeWidth="3" />
          <circle cx="65" cy="86" r="7.5" fill="#F4B400" />
          {/* Arco do fone sensorial anti-ruído */}
          <path d="M29 44 C29 10 101 10 101 44" stroke="#C12B5B" strokeWidth="8" fill="none" strokeLinecap="round" />
          {/* Cabeça */}
          <circle cx="65" cy="46" r="28" fill="#FFD6B0" stroke="#DAA478" strokeWidth="2.5" />
          <path d="M39 38 C42 18 89 16 93 38 C82 28 52 28 39 38 Z" fill="#3B2B27" />
          {/* Abafadores sensoriais laterais */}
          <rect x="24" y="36" width="12" height="22" rx="6" fill="#C12B5B" />
          <rect x="94" y="36" width="12" height="22" rx="6" fill="#C12B5B" />
          {/* Olhos felizes */}
          <g className="animate-na-blink">
            <circle cx="55" cy="47" r="4.5" fill="#242126" />
            <circle cx="56.5" cy="45.5" r="1.6" fill="#FFFFFF" />
            <circle cx="75" cy="47" r="4.5" fill="#242126" />
            <circle cx="76.5" cy="45.5" r="1.6" fill="#FFFFFF" />
          </g>
          <path d="M56 58 Q65 67 74 58" stroke="#7A1436" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </svg>
      </motion.div>

      {/* 4. MENINA BIA FLUTUANDO NO TOPO COM GIRASSOL DA INCLUSÃO (Símbolo mundial neurodiversidade!) */}
      <motion.div
        animate={{ y: [0, -10, 0], rotate: [5, -3, 5] }}
        transition={{ duration: 3.9, delay: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.1 }}
        className="absolute left-[26%] top-[4%] w-[26%] z-20"
      >
        <svg viewBox="0 0 130 120" className="w-full h-auto overflow-visible">
          {/* Cabelo + gorro/capuz rosa Núcleo Afetar */}
          <circle cx="48" cy="46" r="27" fill="#E8628E" stroke="#C12B5B" strokeWidth="3" />
          <circle cx="48" cy="48" r="21" fill="#C8875E" />
          {/* Corpo voando alegre */}
          <path d="M62 62 C82 68 96 82 108 92" stroke="#E8628E" strokeWidth="22" strokeLinecap="round" />
          <path d="M54 68 L84 44" stroke="#E8628E" strokeWidth="12" strokeLinecap="round" />
          <circle cx="86" cy="42" r="6.5" fill="#C8875E" />
          {/* Girassol dourado no cabelo */}
          <g transform="translate(26, 22)">
            <circle cx="0" cy="-7" r="4" fill="#F4B400" />
            <circle cx="7" cy="-2" r="4" fill="#F4B400" />
            <circle cx="5" cy="6" r="4" fill="#F4B400" />
            <circle cx="-5" cy="6" r="4" fill="#F4B400" />
            <circle cx="-7" cy="-2" r="4" fill="#F4B400" />
            <circle cx="0" cy="0" r="4.5" fill="#6B3B1E" />
          </g>
          {/* Rostinho sorrindo */}
          <g className="animate-na-blink">
            <circle cx="41" cy="46" r="3.8" fill="#242126" />
            <circle cx="56" cy="46" r="3.8" fill="#242126" />
          </g>
          <path d="M41 55 Q48.5 64 56 55 Z" fill="#FFFFFF" stroke="#7A1436" strokeWidth="2" />
        </svg>
      </motion.div>

      {/* 5. GATINHO MOCHI ESMERALDA + FAÍSCA DE HIPERFOCO TDAH (Topo-direita) */}
      <motion.div
        animate={{ y: [0, -8, 0], rotate: [10, 18, 10] }}
        transition={{ duration: 3.3, delay: 0.7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-[14%] top-[4%] w-[24%] z-20"
      >
        <svg viewBox="0 0 120 110" className="w-full h-auto overflow-visible">
          {/* Orelhinhas */}
          <path d="M34 40 L30 16 L54 30 Z" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3" strokeLinejoin="round" />
          <path d="M84 40 L88 16 L64 30 Z" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3" strokeLinejoin="round" />
          <rect x="28" y="30" width="62" height="62" rx="30" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3" />
          {/* Faísca dourada TDAH super-foco */}
          <polygon
            points="100,12 90,30 98,30 92,46 110,25 101,25"
            fill="#F4B400"
            stroke="#C98A00"
            strokeWidth="2"
            strokeLinejoin="round"
            className="animate-na-sparkle"
          />
          <circle cx="48" cy="54" r="4.5" fill="#242126" />
          <circle cx="70" cy="54" r="4.5" fill="#242126" />
          <circle cx="50" cy="52" r="1.6" fill="#FFFFFF" />
          <circle cx="72" cy="52" r="1.6" fill="#FFFFFF" />
          <path d="M53 64 Q59 70 65 64" stroke="#FFF9F0" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      </motion.div>

      {/* 6. SÍMBOLO DO INFINITO DA NEURODIVERSIDADE (Autismo & TDAH — Cores Vivas Núcleo Afetar!) */}
      <motion.div
        animate={{ y: [0, -7, 0], rotate: [-6, 6, -6] }}
        transition={{ duration: 4.1, delay: 0.3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[2%] top-[16%] z-20"
      >
        <svg viewBox="0 0 110 64" width="84" height="50" aria-hidden="true" className="overflow-visible">
          <defs>
            <linearGradient id="naNeuroGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C12B5B" />
              <stop offset="35%" stopColor="#F26522" />
              <stop offset="68%" stopColor="#F4B400" />
              <stop offset="100%" stopColor="#1496B0" />
            </linearGradient>
          </defs>
          <path
            d="M32 16 C18 16 10 24 10 34 C10 44 18 52 32 52 C46 52 54 34 55 34 C56 34 64 16 78 16 C92 16 100 24 100 34 C100 44 92 52 78 52 C64 52 56 34 55 34 C54 34 46 16 32 16 Z"
            fill="none"
            stroke="#7A1436"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.16"
            transform="translate(0, 4)"
          />
          <path
            d="M32 16 C18 16 10 24 10 34 C10 44 18 52 32 52 C46 52 54 34 55 34 C56 34 64 16 78 16 C92 16 100 24 100 34 C100 44 92 52 78 52 C64 52 56 34 55 34 C54 34 46 16 32 16 Z"
            fill="none"
            stroke="url(#naNeuroGrad)"
            strokeWidth="11"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {/* 7. PEÇAS DE QUEBRA-CABEÇA ORBITANDO (Cores vivas: Ouro, Azul-Petróleo, Esmeralda, Coral!) */}
      <motion.div
        animate={{ y: [0, -10, 0], rotate: [-16, -4, -16] }}
        transition={{ duration: 3.5, delay: 0.1, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[4%] bottom-[22%] z-20"
      >
        <MiniPuzzlePiece color="#F4B400" shade="#C98A00" size={50} />
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0], rotate: [14, 26, 14] }}
        transition={{ duration: 3.8, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[50%] top-[18%] z-10"
      >
        <MiniPuzzlePiece color="#1496B0" shade="#0C6F84" size={38} />
      </motion.div>

      <motion.div
        animate={{ y: [0, -7, 0], rotate: [-12, 4, -12] }}
        transition={{ duration: 4.2, delay: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-[10%] bottom-[10%] z-20"
      >
        <MiniPuzzlePiece color="#2CB65E" shade="#1D8A45" size={44} />
      </motion.div>

      <motion.div
        animate={{ y: [0, -9, 0], rotate: [8, -8, 8] }}
        transition={{ duration: 3.2, delay: 0.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[18%] bottom-[4%] z-20"
      >
        <MiniPuzzlePiece color="#F26522" shade="#C24810" size={36} />
      </motion.div>
    </div>
  );
}
