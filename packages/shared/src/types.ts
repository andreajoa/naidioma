import { z } from 'zod';

export const LanguageCodeSchema = z.enum([
  'en',
  'es',
  'fr',
  'de',
  'it',
  'ja',
  'zh',
  'ko',
]);

export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

export const CefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1']);
export type CefrLevel = z.infer<typeof CefrLevelSchema>;

export const SkillDimensionSchema = z.enum([
  'speaking',
  'listening',
  'reading',
  'writing',
  'vocabulary',
]);
export type SkillDimension = z.infer<typeof SkillDimensionSchema>;

export const ExerciseTypeSchema = z.enum([
  'context_choice',
  'listen_build',
  'speak_pronounce',
  'trap_buster',
  'dialogue_complete',
  'script_lab',
  'picture_choice',
  'match_pairs',
]);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

export interface ScriptMeta {
  hasNativeScript: boolean;
  romanizationLabel?: string;
  secondaryLabel?: string;
  supportsToneColors?: boolean;
}

export interface LanguageMeta {
  code: LanguageCode;
  isoBadge: string;
  namePt: string;
  nativeName: string;
  subtitlePt: string;
  speechLocale: string;
  flagship?: boolean;
  accentHex: string;
  script: ScriptMeta;
  brazilianFocusNote: string;
}

export const ExerciseOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  reading: z.string().optional(),
  translationPt: z.string().optional(),
  emoji: z.string().optional(),
});
export type ExerciseOption = z.infer<typeof ExerciseOptionSchema>;

export const MatchPairItemSchema = z.object({
  id: z.string(),
  left: z.string(),
  leftReading: z.string().optional(),
  right: z.string(),
  emoji: z.string().optional(),
});
export type MatchPairItem = z.infer<typeof MatchPairItemSchema>;

export const ExerciseSchema = z.object({
  id: z.string(),
  type: ExerciseTypeSchema,
  skill: SkillDimensionSchema,
  promptPt: z.string(),
  contextSituationPt: z.string().optional(),
  illustrationEmoji: z.string().optional(),
  targetText: z.string(),
  reading: z.string().optional(),
  furiganaOrPinyin: z.string().optional(),
  ipaOrPhoneticBr: z.string().optional(),
  translationPt: z.string(),
  brazilianTipPt: z.string(),
  options: z.array(ExerciseOptionSchema).optional(),
  correctOptionId: z.string().optional(),
  pairs: z.array(MatchPairItemSchema).optional(),
  wordBank: z.array(z.string()).optional(),
  correctTokens: z.array(z.string()).optional(),
  dialogueLines: z
    .array(
      z.object({
        speaker: z.string(),
        text: z.string(),
        reading: z.string().optional(),
        translationPt: z.string(),
        isBlank: z.boolean().optional(),
      }),
    )
    .optional(),
  acceptedSpeechVariants: z.array(z.string()).optional(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const LessonSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  order: z.number().int().positive(),
  titlePt: z.string(),
  subtitlePt: z.string(),
  durationMinutes: z.number().int().min(2).max(15),
  xpReward: z.number().int().min(10).max(120),
  cefr: CefrLevelSchema,
  focusSkill: SkillDimensionSchema,
  exercises: z.array(ExerciseSchema).min(3),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const UnitSchema = z.object({
  id: z.string(),
  language: LanguageCodeSchema,
  order: z.number().int().positive(),
  cefr: CefrLevelSchema,
  titlePt: z.string(),
  descriptionPt: z.string(),
  culturalNotePt: z.string(),
  lessons: z.array(LessonSchema).min(1),
});
export type Unit = z.infer<typeof UnitSchema>;

export const ConversationScenarioSchema = z.object({
  id: z.string(),
  language: LanguageCodeSchema,
  titlePt: z.string(),
  situationPt: z.string(),
  cefr: CefrLevelSchema,
  aiRoleName: z.string(),
  aiRoleTitlePt: z.string(),
  openingLine: z.string(),
  openingReading: z.string().optional(),
  openingTranslationPt: z.string(),
  missionGoalsPt: z.array(z.string()).min(2),
  starterHints: z.array(
    z.object({
      text: z.string(),
      reading: z.string().optional(),
      translationPt: z.string(),
    }),
  ),
});
export type ConversationScenario = z.infer<typeof ConversationScenarioSchema>;

export const FlashcardSeedSchema = z.object({
  id: z.string(),
  language: LanguageCodeSchema,
  front: z.string(),
  reading: z.string().optional(),
  ipaOrPhoneticBr: z.string().optional(),
  backPt: z.string(),
  exampleTarget: z.string(),
  exampleReading: z.string().optional(),
  examplePt: z.string(),
  brazilianTipPt: z.string(),
  cefr: CefrLevelSchema,
});
export type FlashcardSeed = z.infer<typeof FlashcardSeedSchema>;

export interface LanguageCourse {
  meta: LanguageMeta;
  units: Unit[];
  scenarios: ConversationScenario[];
  flashcards: FlashcardSeed[];
}

export const CoachFeedbackSchema = z.object({
  naturalnessScore: z.number().int().min(0).max(100),
  correctedVersion: z.string(),
  nativeAlternative: z.string(),
  explanationPt: z.string(),
  pronunciationTipPt: z.string().optional(),
  suggestedReplies: z.array(
    z.object({
      text: z.string(),
      reading: z.string().optional(),
      translationPt: z.string(),
    }),
  ),
});
export type CoachFeedback = z.infer<typeof CoachFeedbackSchema>;

export const FeedbackCategorySchema = z.enum([
  'bug',
  'translation',
  'audio',
  'ux',
  'idea',
]);
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;

export const PlatformTypeSchema = z.enum(['web', 'android', 'ios']);
export type PlatformType = z.infer<typeof PlatformTypeSchema>;
