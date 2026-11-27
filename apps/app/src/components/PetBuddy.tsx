import { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Sparkle, X } from '@phosphor-icons/react';
import { hapticSuccess, hapticTap } from '../lib/native';
import { playPetHappySound, playTapSound } from '../lib/sound';

export type PetSpecies = 'puzinho' | 'dino' | 'mochi' | 'tico';
export type PetMood = 'idle' | 'happy' | 'super_happy' | 'sad' | 'walking' | 'celebrate';

export interface PetProfile {
  species: PetSpecies;
  name: string;
  happiness: number; // 0..100
}

const PET_STORAGE_KEY = 'naidioma_pet_buddy_v1';

export const PET_CATALOG: Record<
  PetSpecies,
  {
    defaultName: string;
    titlePt: string;
    descPt: string;
    primary: string;
    dark: string;
    accent: string;
    softBg: string;
  }
> = {
  puzinho: {
    defaultName: 'Puzinho',
    titlePt: 'Bichinho Quebra-Cabeça',
    descPt: 'Adora montar peças novas e pular quando você acerta!',
    primary: '#C12B5B',
    dark: '#7A1436',
    accent: '#F4B400',
    softBg: '#FFE8F0',
  },
  dino: {
    defaultName: 'Dino',
    titlePt: 'Dinossaurinho Curioso',
    descPt: 'Roooar! Ama aprender idiomas, dar pulos gigantes e colecionar peças!',
    primary: '#2CB65E',
    dark: '#1D8A45',
    accent: '#F4B400',
    softBg: '#E2F9EB',
  },
  mochi: {
    defaultName: 'Mochi',
    titlePt: 'Gatinho Esmeralda',
    descPt: 'Tem uma pecinha dourada na testa e ama ler Hangul e idiomas!',
    primary: '#1496B0',
    dark: '#0C6F84',
    accent: '#F4B400',
    softBg: '#E2F7FB',
  },
  tico: {
    defaultName: 'Tico',
    titlePt: 'Cachorrinho Sensorial',
    descPt: 'Usa fonezinho confortável e adora caminhar na trilha com você!',
    primary: '#1496B0',
    dark: '#0C6F84',
    accent: '#F26522',
    softBg: '#E2F7FB',
  },
};

export function loadPetProfile(): PetProfile {
  if (typeof window === 'undefined') {
    return { species: 'puzinho', name: 'Puzinho', happiness: 80 };
  }
  try {
    const raw = window.localStorage.getItem(PET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PetProfile>;
      const species: PetSpecies =
        parsed.species && parsed.species in PET_CATALOG ? parsed.species : 'puzinho';
      return {
        species,
        name: (parsed.name || PET_CATALOG[species].defaultName).slice(0, 20),
        happiness:
          typeof parsed.happiness === 'number'
            ? Math.max(15, Math.min(100, parsed.happiness))
            : 80,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { species: 'puzinho', name: 'Puzinho', happiness: 80 };
}

export function savePetProfile(pet: PetProfile): PetProfile {
  const safe: PetProfile = {
    species: pet.species in PET_CATALOG ? pet.species : 'puzinho',
    name: (pet.name.trim() || PET_CATALOG[pet.species].defaultName).slice(0, 20),
    happiness: Math.max(15, Math.min(100, Math.round(pet.happiness))),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PET_STORAGE_KEY, JSON.stringify(safe));
    } catch {
      // ignore storage errors
    }
  }
  return safe;
}

interface PetSpriteProps {
  species: PetSpecies;
  mood?: PetMood;
  size?: number;
  facingLeft?: boolean;
  className?: string;
}

/**
 * Bichinho animado completo com perninhas que ANDAM de verdade (mood="walking"),
 * fica super feliz com corações (mood="happy"/"super_happy"/"celebrate")
 * e fica tristinho com orelhas caídas e lagriminha (mood="sad") quando a pessoa erra!
 */
export function PetSprite({
  species,
  mood = 'idle',
  size = 96,
  facingLeft = false,
  className = '',
}: PetSpriteProps) {
  const isWalking = mood === 'walking';
  const isSad = mood === 'sad';
  const isHappy = mood === 'happy' || mood === 'super_happy' || mood === 'celebrate';

  const bodyAnimClass = isWalking
    ? 'animate-na-walk-bob'
    : isHappy
      ? 'animate-na-hop'
      : isSad
        ? 'animate-na-sad'
        : 'animate-na-float';

  const info = PET_CATALOG[species];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        width: size,
        height: size,
        transform: facingLeft ? 'scaleX(-1)' : undefined,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 160 160" width={size} height={size} className="overflow-visible">
        {/* Sombra no chão */}
        <ellipse cx="80" cy="147" rx={isWalking ? 34 : 38} ry="8" fill={info.dark} opacity="0.18" />

        {/* Poeirinha dos passos quando está andando! */}
        {isWalking && (
          <g className="animate-na-dust">
            <circle cx="34" cy="138" r="7" fill="#E6D7C4" />
            <circle cx="22" cy="133" r="5" fill="#E6D7C4" opacity="0.8" />
            <circle cx="44" cy="141" r="4.5" fill="#F4B400" opacity="0.65" />
          </g>
        )}

        {/* Coraçõezinhos e estrelas quando está feliz! */}
        {(mood === 'happy' || mood === 'super_happy' || mood === 'celebrate') && (
          <>
            <path
              d="M24 34 C24 27 32 25 35 31 C38 25 46 27 46 34 C46 42 35 48 35 48 C35 48 24 42 24 34 Z"
              fill="#C12B5B"
              className="animate-na-sparkle"
            />
            <path
              d="M126 24 L129 16 L132 24 L140 27 L132 30 L129 38 L126 30 L118 27 Z"
              fill="#F4B400"
              className="animate-na-sparkle"
            />
            {(mood === 'super_happy' || mood === 'celebrate') && (
              <path
                d="M120 48 C120 43 126 42 128 46 C130 42 136 43 136 48 C136 53 128 58 128 58 C128 58 120 53 120 48 Z"
                fill="#2CB65E"
                className="animate-na-sparkle"
              />
            )}
          </>
        )}

        {/* Nuvem pequenina quando está tristinho */}
        {isSad && (
          <g opacity="0.85">
            <circle cx="122" cy="28" r="9" fill="#9BBCC4" />
            <circle cx="132" cy="26" r="11" fill="#9BBCC4" />
            <circle cx="142" cy="30" r="8" fill="#9BBCC4" />
          </g>
        )}

        {/* Corpinho + Pernas articuladas */}
        <g className={bodyAnimClass}>
          {/* PERNINHAS QUE ANDAM DE VERDADE! */}
          <g className={isWalking ? 'animate-na-leg-l' : ''}>
            <rect x="52" y="118" width="20" height="24" rx="10" fill={info.dark} />
            <ellipse cx="64" cy="140" rx="12" ry="6.5" fill={info.dark} />
          </g>
          <g className={isWalking ? 'animate-na-leg-r' : ''}>
            <rect x="88" y="118" width="20" height="24" rx="10" fill={info.dark} />
            <ellipse cx="100" cy="140" rx="12" ry="6.5" fill={info.dark} />
          </g>

          {/* ESPÉCIE 1: PUZINHO (Bichinho Quebra-Cabeça!) */}
          {species === 'puzinho' && (
            <g>
              {/* Bracinhos */}
              <path
                d={
                  isHappy
                    ? 'M34 80 C16 66 14 48 25 42'
                    : isSad
                      ? 'M34 90 C22 102 24 114 32 118'
                      : 'M34 86 C20 90 19 102 28 106'
                }
                stroke="#9B1E47"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={
                  isHappy
                    ? 'M126 80 C144 66 146 48 135 42'
                    : isSad
                      ? 'M126 90 C138 102 136 114 128 118'
                      : 'M126 86 C140 90 141 102 132 106'
                }
                stroke="#9B1E47"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
              />
              {/* Corpo peça de quebra-cabeça */}
              <path
                d="M44 46 H65 C63 32 69 20 80 20 C91 20 97 32 95 46 H116 C125 46 132 53 132 62 V74 C144 72 152 79 152 89 C152 99 144 106 132 104 V118 C132 127 125 134 116 134 H44 C35 134 28 127 28 118 V104 C16 106 8 99 8 89 C8 79 16 72 28 74 V62 C28 53 35 46 44 46 Z"
                fill="#7A1436"
                transform="translate(0, 4)"
              />
              <path
                d="M44 46 H65 C63 32 69 20 80 20 C91 20 97 32 95 46 H116 C125 46 132 53 132 62 V74 C144 72 152 79 152 89 C152 99 144 106 132 104 V118 C132 127 125 134 116 134 H44 C35 134 28 127 28 118 V104 C16 106 8 99 8 89 C8 79 16 72 28 74 V62 C28 53 35 46 44 46 Z"
                fill="#C12B5B"
              />
              <circle cx="80" cy="31" r="10.5" fill="#F4B400" />
              <circle cx="140" cy="89" r="8.5" fill="#1496B0" />
              <circle cx="20" cy="89" r="8.5" fill="#2CB65E" />
            </g>
          )}

          {/* ESPÉCIE 2: DINO (Dinossaurinho Curioso com Crista Dourada & Rabinho!) */}
          {species === 'dino' && (
            <g>
              {/* Rabinho de dinossauro abanando */}
              <path
                d="M114 106 C138 112 150 96 146 80 C138 88 128 92 114 92 Z"
                fill="#2CB65E"
                stroke="#1D8A45"
                strokeWidth="3.5"
                strokeLinejoin="round"
                className={isHappy || isWalking ? 'animate-na-wave' : ''}
              />
              {/* Cristinhas douradas e bordô no topo da cabeça e costas */}
              <g transform={isSad ? 'translate(0, 4)' : undefined}>
                <polygon points="56,36 66,18 76,34" fill="#F4B400" stroke="#C98A00" strokeWidth="2.5" strokeLinejoin="round" />
                <polygon points="74,33 85,15 96,34" fill="#C12B5B" stroke="#7A1436" strokeWidth="2.5" strokeLinejoin="round" />
                <polygon points="94,38 106,24 112,44" fill="#1496B0" stroke="#0C6F84" strokeWidth="2.5" strokeLinejoin="round" />
              </g>
              {/* Bracinhos curtinhos fofos de dino */}
              <path
                d={isHappy ? 'M38 92 L22 76' : 'M38 96 L24 98'}
                stroke="#1D8A45"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d={isHappy ? 'M122 92 L138 76' : 'M122 96 L136 98'}
                stroke="#1D8A45"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Corpo fofinho arredondado de dinossauro */}
              <rect x="34" y="34" width="92" height="96" rx="44" fill="#1D8A45" transform="translate(0, 4)" />
              <rect x="34" y="34" width="92" height="96" rx="44" fill="#2CB65E" />
              {/* Barriguinha creme com pintinhas alegres */}
              <ellipse cx="80" cy="108" rx="28" ry="18" fill="#FFF9F0" />
              <circle cx="46" cy="56" r="5" fill="#1D8A45" opacity="0.35" />
              <circle cx="114" cy="60" r="4.5" fill="#1D8A45" opacity="0.35" />
            </g>
          )}

          {/* ESPÉCIE 3: MOCHI (Gatinho Esmeralda com Pecinha Dourada!) */}
          {species === 'mochi' && (
            <g>
              {/* Rabinho abanando */}
              <path
                d="M116 108 C142 102 146 78 134 72"
                stroke="#1D8A45"
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
                className={isHappy || isWalking ? 'animate-na-wave' : ''}
              />
              {/* Orelhinhas (abaixam quando está tristinho!) */}
              <g transform={isSad ? 'rotate(-16 45 50)' : undefined}>
                <path d="M36 58 L30 22 L62 42 Z" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3.5" strokeLinejoin="round" />
                <path d="M40 50 L37 32 L54 43 Z" fill="#FFE8F0" />
              </g>
              <g transform={isSad ? 'rotate(16 115 50)' : undefined}>
                <path d="M124 58 L130 22 L98 42 Z" fill="#2CB65E" stroke="#1D8A45" strokeWidth="3.5" strokeLinejoin="round" />
                <path d="M120 50 L123 32 L106 43 Z" fill="#FFE8F0" />
              </g>
              {/* Corpo fofinho */}
              <rect x="34" y="40" width="92" height="90" rx="44" fill="#1D8A45" transform="translate(0, 4)" />
              <rect x="34" y="40" width="92" height="90" rx="44" fill="#2CB65E" />
              <ellipse cx="80" cy="108" rx="28" ry="18" fill="#FFF9F0" />
              {/* Pecinha dourada na testa */}
              <circle cx="80" cy="54" r="7.5" fill="#F4B400" />
              {/* Bigodes */}
              <path d="M22 84 L38 86 M24 94 L38 92 M138 84 L122 86 M136 94 L122 92" stroke="#1D8A45" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}

          {/* ESPÉCIE 3: TICO (Cachorrinho Azul-Petróleo com Fone Sensorial!) */}
          {species === 'tico' && (
            <g>
              {/* Orelhas caidinhas fofas */}
              <ellipse
                cx="34"
                cy={isSad ? 84 : 74}
                rx="14"
                ry="26"
                fill="#0C6F84"
                transform={isSad ? 'rotate(12 34 84)' : 'rotate(18 34 74)'}
              />
              <ellipse
                cx="126"
                cy={isSad ? 84 : 74}
                rx="14"
                ry="26"
                fill="#0C6F84"
                transform={isSad ? 'rotate(-12 126 84)' : 'rotate(-18 126 74)'}
              />
              {/* Arco do fone sensorial */}
              <path d="M36 58 C36 20 124 20 124 58" stroke="#C12B5B" strokeWidth="8" fill="none" strokeLinecap="round" />
              {/* Corpo */}
              <rect x="36" y="42" width="88" height="88" rx="40" fill="#0C6F84" transform="translate(0, 4)" />
              <rect x="36" y="42" width="88" height="88" rx="40" fill="#1496B0" />
              {/* Barriguinha e focinho creme */}
              <ellipse cx="80" cy="104" rx="28" ry="20" fill="#FFF9F0" />
              {/* Fones laterais */}
              <rect x="26" y="54" width="13" height="22" rx="6" fill="#F4B400" stroke="#C98A00" strokeWidth="2" />
              <rect x="121" y="54" width="13" height="22" rx="6" fill="#F4B400" stroke="#C98A00" strokeWidth="2" />
            </g>
          )}

          {/* ROSTINHO EXPRESSIVO UNIVERSAL (Muda claramente entre Feliz, Super Feliz, Andando e Triste!) */}
          <g>
            {isHappy ? (
              /* Olhos em arco feliz ^ ^ */
              <g stroke="#242126" strokeWidth="5.5" strokeLinecap="round" fill="none">
                <path d="M51 82 Q61 70 71 82" />
                <path d="M89 82 Q99 70 109 82" />
              </g>
            ) : isSad ? (
              /* Olhos tristes com sobrancelhas caídas + lagriminha animada! */
              <g>
                <ellipse cx="62" cy="83" rx="10" ry="11" fill="#FFFFFF" />
                <circle cx="62" cy="86" r="5.5" fill="#242126" />
                <circle cx="60" cy="84" r="2" fill="#FFFFFF" />
                <ellipse cx="98" cy="83" rx="10" ry="11" fill="#FFFFFF" />
                <circle cx="98" cy="86" r="5.5" fill="#242126" />
                <circle cx="96" cy="84" r="2" fill="#FFFFFF" />
                {/* Sobrancelhas caídas */}
                <path d="M50 70 L68 65" stroke="#242126" strokeWidth="4" strokeLinecap="round" />
                <path d="M110 70 L92 65" stroke="#242126" strokeWidth="4" strokeLinecap="round" />
                {/* Lagriminha azul brilhante caindo */}
                <path
                  d="M107 90 C107 90 113 98 113 102 C113 105.5 110.3 108 107 108 C103.7 108 101 105.5 101 102 C101 98 107 90 107 90 Z"
                  fill="#49C6E5"
                  className="animate-na-tear"
                />
              </g>
            ) : (
              /* Olhos acesos e curiosos (idle / walking) */
              <g className="animate-na-blink">
                <ellipse cx="62" cy="81" rx="10.5" ry="12" fill="#FFFFFF" />
                <circle cx={isWalking ? 66 : 63} cy="82" r="5.8" fill="#242126" />
                <circle cx={isWalking ? 68 : 65} cy="79" r="2.2" fill="#FFFFFF" />
                <ellipse cx="98" cy="81" rx="10.5" ry="12" fill="#FFFFFF" />
                <circle cx={isWalking ? 102 : 97} cy="82" r="5.8" fill="#242126" />
                <circle cx={isWalking ? 104 : 99} cy="79" r="2.2" fill="#FFFFFF" />
              </g>
            )}

            {/* Bochechas rosadas */}
            {!isSad && (
              <>
                <ellipse cx="45" cy="94" rx="7.5" ry="4.5" fill="#FF9EB8" opacity="0.85" />
                <ellipse cx="115" cy="94" rx="7.5" ry="4.5" fill="#FF9EB8" opacity="0.85" />
              </>
            )}

            {/* Boca por humor */}
            {isHappy ? (
              <path
                d="M66 96 Q80 118 94 96 Z"
                fill="#7A1436"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            ) : isSad ? (
              <path
                d="M68 107 Q80 97 92 107"
                stroke={species === 'puzinho' ? '#FFFFFF' : '#242126'}
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <path
                d="M69 98 Q80 110 91 98"
                stroke={species === 'puzinho' ? '#FFFFFF' : '#242126'}
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}

interface PetPickerModalProps {
  pet: PetProfile;
  onSave: (pet: PetProfile) => void;
  onClose: () => void;
}

export function PetPickerModal({ pet, onSave, onClose }: PetPickerModalProps) {
  const [species, setSpecies] = useState<PetSpecies>(pet.species);
  const [name, setName] = useState(pet.name);
  const [petted, setPetted] = useState(false);

  function handlePetting() {
    void hapticSuccess();
    playPetHappySound();
    setPetted(true);
    onSave({ species, name, happiness: Math.min(100, pet.happiness + 10) });
    setTimeout(() => setPetted(false), 1600);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="duo-card w-full sm:max-w-md rounded-b-none sm:rounded-[26px] p-6 space-y-5 safe-bottom max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-burgundy)] inline-flex items-center gap-1">
              <Sparkle size={14} weight="fill" /> Meu Bichinho de Estudos
            </div>
            <h3 className="font-display text-2xl text-[var(--na-ink)] mt-0.5">
              Cuide do seu companheiro!
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 rounded-2xl border-2 border-[var(--na-border)] flex items-center justify-center"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Palco interativo do bichinho */}
        <div className="p-5 rounded-3xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] flex flex-col items-center gap-3 text-center">
          <PetSprite species={species} mood={petted ? 'super_happy' : 'happy'} size={126} />
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="text-[var(--na-ink)]">Alegria do {name || PET_CATALOG[species].defaultName}</span>
              <span className="text-[var(--na-burgundy)]">{pet.happiness}% 💖</span>
            </div>
            <div className="h-3.5 rounded-full bg-[var(--na-sand-dark)] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-[var(--na-success)] transition-all duration-300"
                style={{ width: `${pet.happiness}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handlePetting}
            className="duo-btn-gold px-5 min-h-[44px] text-xs uppercase tracking-wide inline-flex items-center gap-1.5"
          >
            <Heart size={16} weight="fill" />
            {petted ? 'Eba!! Ele amou o carinho! 💖' : 'Fazer carinho'}
          </button>
        </div>

        {/* Escolher espécie */}
        <div className="space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)]">
            Escolha seu bichinho:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['puzinho', 'dino', 'mochi', 'tico'] as PetSpecies[]).map((sp) => {
              const active = species === sp;
              return (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    playTapSound();
                    setSpecies(sp);
                    if (
                      name === PET_CATALOG.puzinho.defaultName ||
                      name === PET_CATALOG.dino.defaultName ||
                      name === PET_CATALOG.mochi.defaultName ||
                      name === PET_CATALOG.tico.defaultName
                    ) {
                      setName(PET_CATALOG[sp].defaultName);
                    }
                  }}
                  className={`p-3 rounded-2xl border-2 border-b-4 flex flex-col items-center gap-1 transition-all ${
                    active
                      ? 'bg-[var(--na-teal-soft)] border-[var(--na-teal)] text-[var(--na-teal-dark)]'
                      : 'bg-white border-[var(--na-border)] text-[var(--na-ink)]'
                  }`}
                >
                  <PetSprite species={sp} mood={active ? 'happy' : 'idle'} size={56} />
                  <span className="text-xs font-extrabold">{PET_CATALOG[sp].defaultName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dar nome ao bichinho */}
        <div>
          <label
            htmlFor="na-pet-name"
            className="block text-xs font-extrabold uppercase tracking-wider text-[var(--na-muted)] mb-1.5"
          >
            Nome do seu bichinho:
          </label>
          <input
            id="na-pet-name"
            type="text"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={PET_CATALOG[species].defaultName}
            className="w-full min-h-[48px] px-4 rounded-2xl bg-[var(--na-cream)] border-2 border-[var(--na-border)] font-bold text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            playPetHappySound();
            onSave({ species, name: name.trim() || PET_CATALOG[species].defaultName, happiness: pet.happiness });
            onClose();
          }}
          className="duo-btn-emerald w-full text-sm uppercase tracking-wide"
        >
          SALVAR MEU BICHINHO! 🧩
        </button>
      </motion.div>
    </div>
  );
}
