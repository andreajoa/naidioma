import type { LanguageCode, LanguageMeta } from './types.js';

export const LANGUAGES: Record<LanguageCode, LanguageMeta> = {
  en: {
    code: 'en',
    isoBadge: 'EN',
    namePt: 'Inglês para Brasileiros',
    nativeName: 'English',
    subtitlePt: 'Trilha carro-chefe · Fala real, trabalho remoto, viagens e armadilhas PT↔EN',
    speechLocale: 'en-US',
    flagship: true,
    accentHex: '#783247',
    script: {
      hasNativeScript: false,
    },
    brazilianFocusNote:
      'Desenhado para vencer o travamento do brasileiro: sons de TH/R/ED, falsos cognatos e frases que nativos realmente usam.',
  },
  es: {
    code: 'es',
    isoBadge: 'ES',
    namePt: 'Espanhol',
    nativeName: 'Español',
    subtitlePt: 'Fim do Portunhol · Negócios, viagens e vocabulário autêntico',
    speechLocale: 'es-ES',
    accentHex: '#9a4f2c',
    script: {
      hasNativeScript: false,
    },
    brazilianFocusNote:
      'Elimina os falsos amigos clássicos entre Português e Espanhol para você falar com segurança e naturalidade.',
  },
  fr: {
    code: 'fr',
    isoBadge: 'FR',
    namePt: 'Francês',
    nativeName: 'Français',
    subtitlePt: 'Pronúncia limpa, liaisons e situações reais do cotidiano',
    speechLocale: 'fr-FR',
    accentHex: '#38697b',
    script: {
      hasNativeScript: false,
    },
    brazilianFocusNote:
      'Usa a proximidade lexical com o português a seu favor, treinando vogais nasais e ritmo falado real.',
  },
  de: {
    code: 'de',
    isoBadge: 'DE',
    namePt: 'Alemão',
    nativeName: 'Deutsch',
    subtitlePt: 'Lógica direta de estrutura, carreira na Europa e dia a dia',
    speechLocale: 'de-DE',
    accentHex: '#8a6b3e',
    script: {
      hasNativeScript: false,
    },
    brazilianFocusNote:
      'Desmistifica a ordem dos verbos e os artigos (der/die/das) com blocos práticos em vez de decoreba seca.',
  },
  it: {
    code: 'it',
    isoBadge: 'IT',
    namePt: 'Italiano',
    nativeName: 'Italiano',
    subtitlePt: 'Fluência rápida, cultura, gastronomia e conversação viva',
    speechLocale: 'it-IT',
    accentHex: '#285c3b',
    script: {
      hasNativeScript: false,
    },
    brazilianFocusNote:
      'Acelera sua compreensão aproveitando raízes latinas e blindando contra falsos cognatos enganosos.',
  },
  ja: {
    code: 'ja',
    isoBadge: 'JA',
    namePt: 'Japonês',
    nativeName: '日本語',
    subtitlePt: 'Hiragana, Katakana e Kanji com Furigana/Romaji sob demanda',
    speechLocale: 'ja-JP',
    accentHex: '#682b3c',
    script: {
      hasNativeScript: true,
      romanizationLabel: 'Romaji',
      secondaryLabel: 'Furigana',
    },
    brazilianFocusNote:
      'Vogais muito parecidas com o português brasileiro! Foco em ritmo natural, polidez e leitura progressiva.',
  },
  zh: {
    code: 'zh',
    isoBadge: 'ZH',
    namePt: 'Chinês (Mandarim)',
    nativeName: '中文',
    subtitlePt: 'Hanzi, Pinyin e guia visual dos 4 tons para falar sem medo',
    speechLocale: 'zh-CN',
    accentHex: '#9a2c20',
    script: {
      hasNativeScript: true,
      romanizationLabel: 'Pinyin',
      supportsToneColors: true,
    },
    brazilianFocusNote:
      'Gramática surpreendentemente simples (sem conjugação verbal!): o foco central é dominar os 4 tons desde o início.',
  },
  ko: {
    code: 'ko',
    isoBadge: 'KO',
    namePt: 'Coreano',
    nativeName: '한국어',
    subtitlePt: 'Hangul lógico, fala polida e cultura contemporânea de Seul',
    speechLocale: 'ko-KR',
    accentHex: '#2f5d6b',
    script: {
      hasNativeScript: true,
      romanizationLabel: 'Romanização',
    },
    brazilianFocusNote:
      'O Hangul foi projetado para ser aprendido em poucos dias. Você lê placas reais e fala educadamente desde a primeira semana.',
  },
};

export const LANGUAGE_LIST: LanguageMeta[] = [
  LANGUAGES.en,
  LANGUAGES.es,
  LANGUAGES.fr,
  LANGUAGES.de,
  LANGUAGES.it,
  LANGUAGES.ja,
  LANGUAGES.zh,
  LANGUAGES.ko,
];
