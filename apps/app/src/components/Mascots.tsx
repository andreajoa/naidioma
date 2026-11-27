import { useState } from 'react';
import { motion } from 'motion/react';
import type { LanguageCode } from '@naidioma/shared';
import { hapticTap } from '../lib/native';
import { playCharacterCheerSound } from '../lib/sound';

export type MascotMood = 'idle' | 'wave' | 'happy' | 'celebrate' | 'encourage' | 'listening';
export type CastId = 'puz' | 'dino' | 'leo' | 'bia' | 'mochi';

interface PuzzleMascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
}

/**
 * PUZ — Mascote oficial do NAidioma (Peça de Quebra-Cabeça, símbolo de Autismo & TDAH).
 * Cores vivas ancoradas na paleta Núcleo Afetar (bordô vivo, azul-petróleo, ouro sol e esmeralda).
 */
export function PuzzleMascot({ mood = 'idle', size = 112, className = '' }: PuzzleMascotProps) {
  const isJumping = mood === 'happy' || mood === 'celebrate';
  const isWaving = mood === 'wave' || mood === 'happy' || mood === 'celebrate';
  const isEncourage = mood === 'encourage';
  const isListening = mood === 'listening';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 160 160"
        width={size}
        height={size}
        className={`overflow-visible ${isJumping ? 'animate-na-hop' : 'animate-na-float'}`}
      >
        {/* Sombra no chão */}
        <ellipse cx="80" cy="148" rx="38" ry="8" fill="#7a1436" opacity="0.16" />

        {/* Estrelinhas de comemoração */}
        {(mood === 'celebrate' || mood === 'happy' || mood === 'wave') && (
          <>
            <path
              d="M22 28 L25 20 L28 28 L36 31 L28 34 L25 42 L22 34 L14 31 Z"
              fill="#F4B400"
              className="animate-na-sparkle"
            />
            <path
              d="M134 22 L136.5 15 L139 22 L146 24.5 L139 27 L136.5 34 L134 27 L127 24.5 Z"
              fill="#1496B0"
              className="animate-na-sparkle"
            />
            <circle cx="142" cy="54" r="4.5" fill="#2CB65E" className="animate-na-sparkle" />
          </>
        )}

        {/* Ondinhas de áudio quando está ouvindo */}
        {isListening && (
          <g stroke="#1496B0" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M138 66 Q148 76 138 86" className="animate-na-sparkle" />
            <path d="M146 58 Q160 76 146 94" opacity="0.6" className="animate-na-sparkle" />
          </g>
        )}

        {/* Pezinhos fofos */}
        <rect x="54" y="126" width="18" height="17" rx="9" fill="#7A1436" />
        <rect x="88" y="126" width="18" height="17" rx="9" fill="#7A1436" />

        {/* Bracinho esquerdo */}
        <g className={isWaving ? 'animate-na-wave' : ''}>
          <path
            d={isWaving ? 'M34 84 C16 74 12 52 24 44' : 'M34 88 C20 92 18 106 27 110'}
            stroke="#A31F4A"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={isWaving ? 24 : 27} cy={isWaving ? 44 : 110} r="7" fill="#F4B400" />
        </g>

        {/* Bracinho direito */}
        <g className={mood === 'celebrate' ? 'animate-na-wave' : ''}>
          <path
            d={
              mood === 'celebrate'
                ? 'M126 84 C144 74 148 52 136 44'
                : 'M126 88 C140 92 142 106 133 110'
            }
            stroke="#A31F4A"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
          <circle
            cx={mood === 'celebrate' ? 136 : 133}
            cy={mood === 'celebrate' ? 44 : 110}
            r="7"
            fill="#1496B0"
          />
        </g>

        {/* Silhueta da Peça de Quebra-Cabeça (Autismo & TDAH) */}
        <g>
          {/* Contorno 3D inferior */}
          <path
            d="M44 46 H65 C63 32 69 20 80 20 C91 20 97 32 95 46 H116 C125 46 132 53 132 62 V75 C144 73 152 80 152 90 C152 100 144 107 132 105 V120 C132 129 125 136 116 136 H44 C35 136 28 129 28 120 V105 C16 107 8 100 8 90 C8 80 16 73 28 75 V62 C28 53 35 46 44 46 Z"
            fill="#7A1436"
            transform="translate(0, 4)"
          />
          {/* Corpo principal bordô vivo */}
          <path
            d="M44 46 H65 C63 32 69 20 80 20 C91 20 97 32 95 46 H116 C125 46 132 53 132 62 V75 C144 73 152 80 152 90 C152 100 144 107 132 105 V120 C132 129 125 136 116 136 H44 C35 136 28 129 28 120 V105 C16 107 8 100 8 90 C8 80 16 73 28 75 V62 C28 53 35 46 44 46 Z"
            fill="#C12B5B"
          />

          {/* Encaixes coloridos vibrantes (Autismo & TDAH — paleta Núcleo Afetar) */}
          <circle cx="80" cy="31" r="10.5" fill="#F4B400" />
          <circle cx="140" cy="90" r="8.5" fill="#1496B0" />
          <circle cx="20" cy="90" r="8.5" fill="#2CB65E" />

          {/* Brilho superior fofo */}
          <path
            d="M44 54 H64"
            stroke="#FF8EB0"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.55"
          />
          <circle cx="77" cy="27" r="3.2" fill="#FFF6D6" opacity="0.8" />
        </g>

        {/* Rostinho expressivo */}
        <g transform={isEncourage ? 'rotate(-4 80 86)' : undefined}>
          {/* Olho esquerdo */}
          <g className="animate-na-blink">
            <ellipse cx="62" cy="82" rx="11" ry="12.5" fill="#FFFFFF" />
            <circle cx={isListening ? 66 : 64} cy="83" r="6" fill="#242126" />
            <circle cx={isListening ? 68 : 66} cy="80" r="2.3" fill="#FFFFFF" />
          </g>

          {/* Olho direito */}
          <g className="animate-na-blink">
            <ellipse cx="98" cy="82" rx="11" ry="12.5" fill="#FFFFFF" />
            <circle cx={isListening ? 102 : 96} cy="83" r="6" fill="#242126" />
            <circle cx={isListening ? 104 : 98} cy="80" r="2.3" fill="#FFFFFF" />
          </g>

          {/* Bochechas rosadas */}
          <ellipse cx="46" cy="96" rx="7.5" ry="4.5" fill="#FF9EB8" opacity="0.85" />
          <ellipse cx="114" cy="96" rx="7.5" ry="4.5" fill="#FF9EB8" opacity="0.85" />

          {/* Boca por humor */}
          {mood === 'happy' || mood === 'celebrate' ? (
            <path
              d="M66 100 Q80 120 94 100 Z"
              fill="#7A1436"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          ) : isEncourage ? (
            <path
              d="M70 105 Q80 111 90 105"
              stroke="#FFFFFF"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <path
              d="M68 101 Q80 114 92 101"
              stroke="#FFFFFF"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>
      </svg>
    </div>
  );
}

/**
 * LÉO — Menino curioso de 9 anos com fones azul-petróleo (ama Coreano e música!).
 */
function LeoCharacter({ size = 96, excited = false }: { size?: number; excited?: boolean }) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={`overflow-visible ${excited ? 'animate-na-hop' : 'animate-na-float'}`}
      aria-hidden="true"
    >
      <ellipse cx="70" cy="130" rx="30" ry="7" fill="#0C6F84" opacity="0.16" />
      {/* Corpo camiseta azul-petróleo com peça de quebra-cabeça */}
      <rect x="42" y="88" width="56" height="38" rx="18" fill="#1496B0" stroke="#0C6F84" strokeWidth="3" />
      <circle cx="70" cy="107" r="7" fill="#F4B400" />
      {/* Arco do fone de ouvido */}
      <path d="M32 62 C32 24 108 24 108 62" stroke="#C12B5B" strokeWidth="8" fill="none" strokeLinecap="round" />
      {/* Cabeça */}
      <circle cx="70" cy="64" r="32" fill="#FFD9B8" stroke="#D9A87E" strokeWidth="2.5" />
      {/* Cabelinho */}
      <path d="M40 56 C42 32 98 30 101 56 C92 44 54 44 40 56 Z" fill="#3B2B27" />
      {/* Fones laterais */}
      <rect x="27" y="54" width="12" height="22" rx="6" fill="#C12B5B" />
      <rect x="101" y="54" width="12" height="22" rx="6" fill="#C12B5B" />
      {/* Olhos piscando */}
      <g className="animate-na-blink">
        <circle cx="58" cy="65" r="5" fill="#242126" />
        <circle cx="60" cy="63" r="1.8" fill="#FFFFFF" />
        <circle cx="82" cy="65" r="5" fill="#242126" />
        <circle cx="84" cy="63" r="1.8" fill="#FFFFFF" />
      </g>
      <ellipse cx="48" cy="74" rx="5.5" ry="3" fill="#FF9E8A" opacity="0.7" />
      <ellipse cx="92" cy="74" rx="5.5" ry="3" fill="#FF9E8A" opacity="0.7" />
      {/* Sorriso */}
      <path d="M60 77 Q70 88 80 77" stroke="#7A1436" strokeWidth="3.8" strokeLinecap="round" fill="none" />
      {/* Mão acenando */}
      <g className="animate-na-wave">
        <path d="M98 98 C114 92 118 78 112 68" stroke="#1496B0" strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx="112" cy="68" r="6.5" fill="#FFD9B8" />
      </g>
    </svg>
  );
}

/**
 * BIA — Menina alegre com tiara dourada de estrela, torce em cada etapa!
 */
function BiaCharacter({ size = 96, excited = false }: { size?: number; excited?: boolean }) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={`overflow-visible ${excited ? 'animate-na-hop' : 'animate-na-float'}`}
      aria-hidden="true"
    >
      <ellipse cx="70" cy="130" rx="30" ry="7" fill="#C98A00" opacity="0.18" />
      {/* Cabelo volumoso cacheado atrás */}
      <circle cx="42" cy="60" r="18" fill="#4B2A20" />
      <circle cx="98" cy="60" r="18" fill="#4B2A20" />
      <circle cx="70" cy="40" r="22" fill="#4B2A20" />
      {/* Estrela dourada */}
      <path
        d="M95 25 L98 17 L101 25 L109 28 L101 31 L98 39 L95 31 L87 28 Z"
        fill="#F4B400"
        stroke="#C98A00"
        strokeWidth="1.5"
        className="animate-na-sparkle"
      />
      {/* Blusa dourada / bordô */}
      <rect x="42" y="88" width="56" height="38" rx="18" fill="#F4B400" stroke="#C98A00" strokeWidth="3" />
      <rect x="61" y="99" width="18" height="16" rx="5" fill="#C12B5B" />
      {/* Rosto */}
      <circle cx="70" cy="65" r="30" fill="#B67852" stroke="#8C5636" strokeWidth="2.5" />
      <g className="animate-na-blink">
        <circle cx="58" cy="65" r="5" fill="#242126" />
        <circle cx="60" cy="63" r="1.8" fill="#FFFFFF" />
        <circle cx="82" cy="65" r="5" fill="#242126" />
        <circle cx="84" cy="63" r="1.8" fill="#FFFFFF" />
      </g>
      <ellipse cx="49" cy="74" rx="5.5" ry="3" fill="#FF8C9E" opacity="0.55" />
      <ellipse cx="91" cy="74" rx="5.5" ry="3" fill="#FF8C9E" opacity="0.55" />
      <path d="M59 76 Q70 89 81 76 Z" fill="#FFFFFF" stroke="#7A1436" strokeWidth="2.2" />
      <g className="animate-na-wave">
        <path d="M42 98 C24 92 22 78 28 68" stroke="#F4B400" strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx="28" cy="68" r="6.5" fill="#B67852" />
      </g>
    </svg>
  );
}

/**
 * MOCHI — Gatinho esmeralda com pecinha dourada na testa (guia do Hangul, Hiragana e Memória!).
 */
function MochiCharacter({ size = 96, excited = false }: { size?: number; excited?: boolean }) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={`overflow-visible ${excited ? 'animate-na-hop' : 'animate-na-float'}`}
      aria-hidden="true"
    >
      <ellipse cx="70" cy="130" rx="30" ry="7" fill="#1D8A45" opacity="0.18" />
      {/* Orelhinhas */}
      <path d="M38 56 L34 24 L62 42 Z" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3" strokeLinejoin="round" />
      <path d="M102 56 L106 24 L78 42 Z" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3" strokeLinejoin="round" />
      <path d="M41 50 L39 32 L55 43 Z" fill="#FFE8F0" />
      <path d="M99 50 L101 32 L85 43 Z" fill="#FFE8F0" />
      {/* Corpinho fofo */}
      <rect x="34" y="42" width="72" height="82" rx="36" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3.5" />
      {/* Barriguinha creme */}
      <ellipse cx="70" cy="102" rx="22" ry="16" fill="#FFF9F0" />
      {/* Pecinha dourada na testa */}
      <circle cx="70" cy="54" r="6.5" fill="#F4B400" />
      {/* Olhos */}
      <g className="animate-na-blink">
        <circle cx="55" cy="74" r="6" fill="#242126" />
        <circle cx="57" cy="72" r="2.2" fill="#FFFFFF" />
        <circle cx="85" cy="74" r="6" fill="#242126" />
        <circle cx="87" cy="72" r="2.2" fill="#FFFFFF" />
      </g>
      {/* Narizinho & bigodes */}
      <polygon points="70,80 65,76 75,76" fill="#C12B5B" />
      <path d="M62 84 Q70 91 78 84" stroke="#1D8A45" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M22 76 L37 78 M24 85 L37 84 M118 76 L103 78 M116 85 L103 84" stroke="#1D8A45" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * DINO — Dinossaurinho animado super carinhoso que adora ensinar idiomas e pular na trilha!
 */
function DinoCharacter({ size = 96, excited = false }: { size?: number; excited?: boolean }) {
  return (
    <svg
      viewBox="0 0 150 146"
      width={size}
      height={size}
      className={`overflow-visible ${excited ? 'animate-na-hop' : 'animate-na-float'}`}
      aria-hidden="true"
    >
      <ellipse cx="72" cy="134" rx="34" ry="7.5" fill="#1D8A45" opacity="0.18" />
      {/* Rabinho abanando */}
      <path
        d="M104 98 C126 104 140 90 136 74 C127 81 118 84 106 84 Z"
        fill="#2CB65E"
        stroke="#1D8A45"
        strokeWidth="3.5"
        strokeLinejoin="round"
        className="animate-na-wave"
      />
      {/* Cristas coloridas */}
      <polygon points="50,36 60,18 70,34" fill="#F4B400" stroke="#C98A00" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="68,32 79,14 90,33" fill="#C12B5B" stroke="#7A1436" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="88,38 100,24 106,44" fill="#1496B0" stroke="#0C6F84" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Pezinhos */}
      <rect x="48" y="112" width="18" height="20" rx="9" fill="#1D8A45" />
      <rect x="80" y="112" width="18" height="20" rx="9" fill="#1D8A45" />
      {/* Bracinho acenando */}
      <g className="animate-na-wave">
        <path d="M36 86 C20 78 18 64 26 56" stroke="#1D8A45" strokeWidth="10" strokeLinecap="round" fill="none" />
      </g>
      {/* Corpo fofo */}
      <rect x="30" y="34" width="84" height="86" rx="42" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3.5" />
      <ellipse cx="72" cy="98" rx="25" ry="16" fill="#FFF9F0" />
      {/* Olhos piscando */}
      <g className="animate-na-blink">
        <ellipse cx="56" cy="66" rx="8.5" ry="9.5" fill="#FFFFFF" />
        <circle cx="58" cy="67" r="4.8" fill="#242126" />
        <circle cx="59.5" cy="65" r="1.8" fill="#FFFFFF" />
        <ellipse cx="88" cy="66" rx="8.5" ry="9.5" fill="#FFFFFF" />
        <circle cx="90" cy="67" r="4.8" fill="#242126" />
        <circle cx="91.5" cy="65" r="1.8" fill="#FFFFFF" />
      </g>
      <ellipse cx="44" cy="77" rx="6" ry="3.5" fill="#FF9EB8" opacity="0.8" />
      <ellipse cx="100" cy="77" rx="6" ry="3.5" fill="#FF9EB8" opacity="0.8" />
      <path d="M60 79 Q72 91 84 79 Z" fill="#FFFFFF" stroke="#1D8A45" strokeWidth="2.5" />
    </svg>
  );
}

const CAST_CHEERS: Record<CastId, string[]> = {
  puz: ['Você consegue! 🧩', 'Cada peça conta!', 'Vamos brincar aprendendo!'],
  dino: ['Roooar! Vamos aprender juntos! 🦕', 'Dinossauros amam idiomas! ⭐', 'Você é incrível! 🦖'],
  leo: ['Bora destravar mais uma! 🎧', 'Mandando super bem!', 'Adoro estudar assim!'],
  bia: ['Uhuul! Continua assim! ⭐', 'Você está brilhando!', 'Mais uma estrelinha!'],
  mochi: ['Miau! Vamos treinar os sons! 🐾', 'Sua memória está afiada!', 'Que legal!'],
};

interface InteractiveCastProps {
  character: CastId;
  size?: number;
  mood?: MascotMood;
  customPhrase?: string;
}

export function InteractiveCast({
  character,
  size = 96,
  mood = 'idle',
  customPhrase,
}: InteractiveCastProps) {
  const [bubble, setBubble] = useState<string | null>(null);
  const [bouncing, setBouncing] = useState(false);

  function handlePoke() {
    void hapticTap();
    playCharacterCheerSound();
    const list = CAST_CHEERS[character];
    const phrase = customPhrase ?? list[Math.floor(Math.random() * list.length)] ?? 'Vamos lá!';
    setBubble(phrase);
    setBouncing(true);
    setTimeout(() => setBouncing(false), 900);
    setTimeout(() => setBubble(null), 2600);
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      {bubble && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap z-20 px-3 py-1.5 rounded-2xl bg-white border-2 border-[var(--na-border)] shadow-md text-xs font-extrabold text-[var(--na-ink)]"
        >
          {bubble}
        </motion.div>
      )}
      <button
        type="button"
        onClick={handlePoke}
        aria-label={`Interagir com ${character}`}
        className="p-1 rounded-3xl cursor-pointer transition-transform active:scale-95 focus-visible:outline-2"
      >
        {character === 'puz' && (
          <PuzzleMascot size={size} mood={bouncing ? 'happy' : mood} />
        )}
        {character === 'dino' && <DinoCharacter size={size} excited={bouncing} />}
        {character === 'leo' && <LeoCharacter size={size} excited={bouncing} />}
        {character === 'bia' && <BiaCharacter size={size} excited={bouncing} />}
        {character === 'mochi' && <MochiCharacter size={size} excited={bouncing} />}
      </button>
    </div>
  );
}

export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = [
    { x: -110, y: -90, color: '#C12B5B', r: 120 },
    { x: -65, y: -120, color: '#F4B400', r: -95 },
    { x: -20, y: -135, color: '#1496B0', r: 150 },
    { x: 25, y: -130, color: '#2CB65E', r: -140 },
    { x: 75, y: -115, color: '#F26522', r: 90 },
    { x: 115, y: -85, color: '#C12B5B', r: -120 },
    { x: -90, y: -45, color: '#2CB65E', r: 60 },
    { x: 92, y: -40, color: '#F4B400', r: -75 },
    { x: -45, y: -75, color: '#1496B0', r: 180 },
    { x: 48, y: -70, color: '#F26522', r: -160 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible z-30">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0.4, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, scale: 1.15, rotate: p.r }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="absolute w-3.5 h-3.5 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

export const LANGUAGE_FLAGS: Record<
  LanguageCode,
  { emoji: string; shortName: string; letterBadge: string; badgeColor: string }
> = {
  en: { emoji: '🇺🇸', shortName: 'Inglês', letterBadge: 'Aa', badgeColor: '#C12B5B' },
  ko: { emoji: '🇰🇷', shortName: 'Coreano', letterBadge: '한', badgeColor: '#1496B0' },
  ja: { emoji: '🇯🇵', shortName: 'Japonês', letterBadge: 'あ', badgeColor: '#C12B5B' },
  es: { emoji: '🇪🇸', shortName: 'Espanhol', letterBadge: 'Ññ', badgeColor: '#F26522' },
  fr: { emoji: '🇫🇷', shortName: 'Francês', letterBadge: 'Çç', badgeColor: '#1496B0' },
  de: { emoji: '🇩🇪', shortName: 'Alemão', letterBadge: 'Ää', badgeColor: '#E09F00' },
  it: { emoji: '🇮🇹', shortName: 'Italiano', letterBadge: 'Ci', badgeColor: '#2CB65E' },
  zh: { emoji: '🇨🇳', shortName: 'Chinês', letterBadge: '拼', badgeColor: '#E04338' },
};
