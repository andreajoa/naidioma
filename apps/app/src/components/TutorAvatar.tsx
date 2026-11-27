import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { PetSprite, type PetMood, type PetProfile } from './PetBuddy';

export type TutorId = 'maya' | 'oliver' | 'pet';
export type TutorCallState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy';

export interface TutorMeta {
  id: TutorId;
  name: string;
  rolePt: string;
  accentPt: string;
  voicePreference: 'female' | 'male';
  backdropFrom: string;
  backdropTo: string;
  ringColor: string;
}

export const TUTOR_PROFILES: Record<Exclude<TutorId, 'pet'>, TutorMeta> = {
  maya: {
    id: 'maya',
    name: 'Maya',
    rolePt: 'Tutora Americana',
    accentPt: 'Acolhedora & clara',
    voicePreference: 'female',
    backdropFrom: '#FFF3E8',
    backdropTo: '#FDE1EC',
    ringColor: '#C12B5B',
  },
  oliver: {
    id: 'oliver',
    name: 'Oliver',
    rolePt: 'Tutor Internacional',
    accentPt: 'Calmo & executivo',
    voicePreference: 'male',
    backdropFrom: '#E7F6F9',
    backdropTo: '#E8F3EB',
    ringColor: '#1496B0',
  },
};

interface TutorAvatarProps {
  tutorId: TutorId;
  pet?: PetProfile;
  state: TutorCallState;
  mouthLevel: 0 | 1 | 2 | 3;
  micVolume?: number;
  size?: number;
}

/**
 * Lightweight 60fps vector tutor avatar with natural blinking, breathing,
 * emotional states (listening/thinking/speaking/happy) and word-synced mouth lip-sync.
 * Zero GPU cost, works smoothly on every mobile device & offline.
 */
export function TutorAvatar({
  tutorId,
  pet,
  state,
  mouthLevel,
  micVolume = 0,
  size = 188,
}: TutorAvatarProps) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setBlinking(true);
      blinkTimeout = setTimeout(() => setBlinking(false), 150);
    }, 3400);
    return () => {
      clearInterval(interval);
      if (blinkTimeout) clearTimeout(blinkTimeout);
    };
  }, []);

  if (tutorId === 'pet' && pet) {
    const petMood: PetMood =
      state === 'happy'
        ? 'celebrate'
        : state === 'speaking'
          ? 'happy'
          : state === 'listening'
            ? 'idle'
            : 'idle';

    return (
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: 'radial-gradient(circle at 35% 30%, #FFF8EB, #FCE4EC)',
        }}
      >
        {(state === 'speaking' || state === 'listening') && (
          <motion.span
            animate={{
              scale:
                state === 'listening'
                  ? 1 + Math.min(0.22, micVolume * 0.35)
                  : mouthLevel > 0
                    ? 1.07
                    : 1.01,
              opacity: state === 'listening' ? 0.5 : 0.35,
            }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 rounded-full border-4"
            style={{
              borderColor: state === 'listening' ? '#2CB65E' : '#C12B5B',
            }}
          />
        )}
        <motion.div
          animate={
            state === 'speaking'
              ? { y: [0, -3 - mouthLevel, 0], scale: 1 + mouthLevel * 0.015 }
              : state === 'thinking'
                ? { rotate: [-2, 2, -2] }
                : { y: [0, -2, 0] }
          }
          transition={{ duration: state === 'speaking' ? 0.25 : 2.2, repeat: Infinity }}
        >
          <PetSprite species={pet.species} mood={petMood} size={Math.round(size * 0.78)} />
        </motion.div>
      </div>
    );
  }

  const isMaya = tutorId === 'maya';
  const meta = isMaya ? TUTOR_PROFILES.maya : TUTOR_PROFILES.oliver;
  const skin = isMaya ? '#F2BE9B' : '#F4C9A8';
  const skinShadow = isMaya ? '#DF9E78' : '#DFA884';
  const hair = isMaya ? '#3B231E' : '#4A3326';
  const shirt = isMaya ? '#C12B5B' : '#1496B0';
  const shirtAccent = isMaya ? '#8E1C43' : '#0C6F84';

  const headAnim =
    state === 'speaking'
      ? { y: [0, -2.5, 0], rotate: [0, mouthLevel >= 2 ? 1.4 : -0.8, 0] }
      : state === 'listening'
        ? { rotate: [0, -2.5, 0], y: [0, -1, 0] }
        : state === 'thinking'
          ? { rotate: [-3, 3, -3], y: [0, -1.5, 0] }
          : state === 'happy'
            ? { y: [0, -5, 0], scale: [1, 1.03, 1] }
            : { y: [0, -1.5, 0] };

  // Dynamic lip-sync mouth path
  const effectiveMouth = state === 'speaking' ? mouthLevel : 0;

  return (
    <div
      className="relative flex items-center justify-center rounded-full shadow-md"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, ${meta.backdropFrom}, ${meta.backdropTo})`,
      }}
    >
      {/* Audio / Speaking Halo Ring */}
      {(state === 'speaking' || state === 'listening') && (
        <motion.span
          animate={{
            scale:
              state === 'listening'
                ? 1.02 + Math.min(0.18, micVolume * 0.3)
                : 1.02 + effectiveMouth * 0.03,
            opacity: state === 'listening' ? 0.65 : 0.45,
          }}
          transition={{ duration: 0.12 }}
          className="absolute -inset-2 rounded-full border-4 pointer-events-none"
          style={{
            borderColor: state === 'listening' ? '#2CB65E' : meta.ringColor,
          }}
        />
      )}

      {/* Thinking dots badge */}
      {state === 'thinking' && (
        <div className="absolute -top-1 right-2 z-20 px-2.5 py-1 rounded-full bg-white border-2 border-[var(--na-gold)] shadow-xs flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: dot * 0.16 }}
              className="w-1.5 h-1.5 rounded-full bg-[var(--na-burgundy)]"
            />
          ))}
        </div>
      )}

      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="rounded-full overflow-hidden"
        role="img"
        aria-label={`Avatar do tutor ${meta.name}`}
      >
        <defs>
          <clipPath id={`clip-${tutorId}`}>
            <circle cx="100" cy="100" r="98" />
          </clipPath>
        </defs>

        <g clipPath={`url(#clip-${tutorId})`}>
          {/* Soft studio light circle */}
          <circle cx="100" cy="105" r="82" fill="#FFFFFF" opacity="0.45" />

          {/* Back hair for Maya */}
          {isMaya && (
            <path
              d="M46 92 C42 135 45 168 62 185 L138 185 C155 168 158 135 154 92 C152 54 132 34 100 34 C68 34 48 54 46 92 Z"
              fill={hair}
            />
          )}

          {/* Shoulders & Shirt */}
          <path
            d="M36 202 C40 164 64 148 100 148 C136 148 160 164 164 202 Z"
            fill={shirt}
          />
          <path
            d="M84 149 L100 171 L116 149 Z"
            fill={shirtAccent}
          />
          {/* Subtle headset mic for tutor authenticity */}
          <path
            d="M54 98 C50 118 62 132 82 134"
            fill="none"
            stroke="#2B2428"
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="84" cy="134" r="4" fill="#2B2428" opacity="0.85" />

          {/* Neck */}
          <rect x="87" y="130" width="26" height="26" rx="10" fill={skinShadow} />

          {/* Animated Head Group */}
          <motion.g
            style={{ originX: '100px', originY: '130px' }}
            animate={headAnim}
            transition={{
              duration: state === 'speaking' ? 0.24 : 2.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Ears */}
            <circle cx="57" cy="98" r="10" fill={skinShadow} />
            <circle cx="143" cy="98" r="10" fill={skinShadow} />

            {/* Face */}
            <rect x="58" y="48" width="84" height="92" rx="40" fill={skin} />

            {/* Soft cheek blush */}
            <ellipse cx="75" cy="108" rx="8.5" ry="4.5" fill="#EA7B8F" opacity={state === 'happy' ? 0.45 : 0.24} />
            <ellipse cx="125" cy="108" rx="8.5" ry="4.5" fill="#EA7B8F" opacity={state === 'happy' ? 0.45 : 0.24} />

            {/* Hair Front */}
            {isMaya ? (
              <path
                d="M56 84 C58 52 76 38 100 38 C124 38 142 52 144 84 C135 66 118 58 98 60 C79 62 66 72 56 84 Z"
                fill={hair}
              />
            ) : (
              <path
                d="M57 86 C56 54 74 38 100 38 C126 38 144 54 143 86 C137 68 124 58 106 58 C84 58 68 65 57 86 Z"
                fill={hair}
              />
            )}

            {/* Eyebrows (expressive per state) */}
            <path
              d={
                state === 'thinking'
                  ? 'M72 80 Q82 76 90 79'
                  : state === 'happy' || state === 'speaking'
                    ? 'M72 79 Q81 74 90 78'
                    : 'M72 81 Q81 77 90 80'
              }
              fill="none"
              stroke={hair}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d={
                state === 'thinking'
                  ? 'M110 77 Q119 73 128 79'
                  : state === 'happy' || state === 'speaking'
                    ? 'M110 78 Q119 74 128 79'
                    : 'M110 80 Q119 77 128 81'
              }
              fill="none"
              stroke={hair}
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Oliver's clean glasses */}
            {!isMaya && (
              <g stroke="#2C2529" strokeWidth="2.4" fill="rgba(255,255,255,0.16)">
                <rect x="69" y="84" width="24" height="17" rx="6" />
                <rect x="107" y="84" width="24" height="17" rx="6" />
                <line x1="93" y1="92" x2="107" y2="92" />
              </g>
            )}

            {/* Eyes with natural blinking */}
            <g transform={blinking ? 'translate(0, 93) scale(1, 0.12) translate(0, -93)' : undefined}>
              <circle cx="81" cy="93" r="5.2" fill="#231B20" />
              <circle cx="82.8" cy="91.2" r="1.8" fill="#FFFFFF" />
              <circle cx="119" cy="93" r="5.2" fill="#231B20" />
              <circle cx="120.8" cy="91.2" r="1.8" fill="#FFFFFF" />
            </g>

            {/* Nose */}
            <path
              d="M100 96 L97.5 106 Q100 108 103 106"
              fill="none"
              stroke={skinShadow}
              strokeWidth="2.6"
              strokeLinecap="round"
            />

            {/* Lip-Sync Mouth */}
            {effectiveMouth === 0 && (
              <path
                d={
                  state === 'happy'
                    ? 'M84 117 Q100 132 116 117'
                    : state === 'thinking'
                      ? 'M90 120 Q100 119 109 120'
                      : 'M87 118 Q100 127 113 118'
                }
                fill={state === 'happy' ? '#FFFFFF' : 'none'}
                stroke="#8F2D45"
                strokeWidth="3.6"
                strokeLinecap="round"
              />
            )}
            {effectiveMouth === 1 && (
              <ellipse cx="100" cy="121" rx="9" ry="4.5" fill="#7A1D36" stroke="#8F2D45" strokeWidth="2.2" />
            )}
            {effectiveMouth === 2 && (
              <g>
                <path
                  d="M87 117 Q100 115 113 117 Q112 129 100 129 Q88 129 87 117 Z"
                  fill="#7A1D36"
                  stroke="#8F2D45"
                  strokeWidth="2.2"
                />
                <path d="M91 118 Q100 121 109 118" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
              </g>
            )}
            {effectiveMouth === 3 && (
              <g>
                <path
                  d="M85 116 Q100 114 115 116 Q114 133 100 133 Q86 133 85 116 Z"
                  fill="#6E1830"
                  stroke="#8F2D45"
                  strokeWidth="2.2"
                />
                <path d="M90 117 Q100 121 110 117" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
                <ellipse cx="100" cy="129" rx="6.5" ry="2.8" fill="#E36E86" />
              </g>
            )}
          </motion.g>
        </g>
      </svg>
    </div>
  );
}
