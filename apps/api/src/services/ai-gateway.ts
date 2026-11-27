import {
  CoachFeedbackSchema,
  LANGUAGES,
  type CoachFeedback,
  type ConversationScenario,
  type LanguageCode,
} from '@naidioma/shared';
import { config } from '../lib/config.js';
import { getRuntimeSettings } from './runtime-config.js';

export type ActiveAiProvider =
  | 'ollama'
  | 'openai-compatible'
  | 'gemini'
  | 'local-pedagogical';

export interface ChatTurnInput {
  language: LanguageCode;
  scenario: ConversationScenario;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  userMessage: string;
}

export interface ChatTurnResponse {
  replyText: string;
  replyReading?: string;
  replyTranslationPt: string;
  coach: CoachFeedback;
  providerUsed: ActiveAiProvider;
  modelUsed: string;
  latencyMs: number;
}

export interface ExplainPhraseResponse {
  breakdownPt: string;
  literalVsNaturalPt: string;
  brazilianPitfallPt: string;
  examples: Array<{ target: string; reading?: string; translationPt: string }>;
  providerUsed: ActiveAiProvider;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callOllamaJson(
  baseUrl: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16_000);
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: { temperature: 0.45 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const parsed = extractJsonObject(data.message?.content ?? '');
    if (!parsed) throw new Error('Ollama returned non-JSON payload');
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiCompatibleJson(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16_000);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.45,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI-compatible HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = extractJsonObject(data.choices?.[0]?.message?.content ?? '');
    if (!parsed) throw new Error('OpenAI-compatible returned invalid JSON');
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiJson(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16_000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.45,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = extractJsonObject(raw);
    if (!parsed) throw new Error('Gemini returned invalid JSON');
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPedagogicalFallback(input: ChatTurnInput): Omit<ChatTurnResponse, 'latencyMs'> {
  const { language, scenario, userMessage, history } = input;
  const turn = history.length;
  const trimmed = userMessage.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const hasPolite = /please|por favor|s'il vous|bitte|per favore|kudasai|juseyo|xiexie|thank|obrigad|merci|danke|grazie/i.test(trimmed);

  const fallbackByLang: Record<
    LanguageCode,
    Array<{ reply: string; reading?: string; pt: string; nativeAlt: string; tip: string; hints: Array<{ text: string; reading?: string; translationPt: string }> }>
  > = {
    en: [
      {
        reply: 'Awesome, got it! Would you like that for here or to go — and can I get you anything else?',
        pt: 'Ótimo, anotado! Você gostaria para consumir aqui ou para viagem — e posso trazer mais alguma coisa?',
        nativeAlt: trimmed.length < 18 ? `${trimmed}, please!` : trimmed,
        tip: hasPolite
          ? 'Ótima polidez! Nativos valorizam muito começar ou terminar pedidos com "please" e usar contrações como "I’d like".'
          : 'Dica para brasileiros: adicionar "please" ou "Could I get..." deixa sua frase 10x mais natural e educada em inglês.',
        hints: [
          { text: 'To go, please! Also, what is the Wi-Fi password?', translationPt: 'Para viagem, por favor! Aliás, qual é a senha do Wi-Fi?' },
          { text: "For here, thanks! That's all for now.", translationPt: 'Para aqui, obrigado! Por enquanto é só.' },
        ],
      },
      {
        reply: "Sounds great! Here you go — let me know if you need anything else today.",
        pt: 'Perfeito! Aqui está — me avise se precisar de mais alguma coisa hoje.',
        nativeAlt: "Thank you so much, I really appreciate it!",
        tip: 'Frase clara e comunicativa! Tente variar respostas usando "Sounds good", "That works for me" ou "I really appreciate it".',
        hints: [
          { text: 'Thanks a lot! Have a wonderful day.', translationPt: 'Muito obrigado! Tenha um ótimo dia.' },
          { text: 'Could I pay by card?', translationPt: 'Posso pagar com cartão?' },
        ],
      },
    ],
    es: [
      {
        reply: '¡Perfecto, ahora mismo se lo traigo! ¿Le gustaría probar también nuestra especialidad de la casa?',
        pt: 'Perfeito, já vou trazer agora mesmo! Gostaria de provar também a especialidade da casa?',
        nativeAlt: trimmed,
        tip: 'Muito bem! Lembre-se de fechar bem as vogais finais ("e" e "o") para soar 100% espanhol sem Portunhol.',
        hints: [
          { text: '¡Sí, por favor! ¿Cuál me recomienda?', translationPt: 'Sim, por favor! Qual você me recomenda?' },
          { text: 'Por ahora está bien, muchas gracias.', translationPt: 'Por enquanto está ótimo, muito obrigado.' },
        ],
      },
    ],
    fr: [
      {
        reply: 'Très bien ! Ce sera sur place ou à emporter ?',
        pt: 'Muito bem! Vai ser para comer aqui ou para levar?',
        nativeAlt: trimmed,
        tip: 'Excelente! Em francês, mantenha sempre o ritmo leve sem pronunciar consoantes finais como "s" e "t".',
        hints: [
          { text: "À emporter, s'il vous plaît.", translationPt: 'Para levar, por favor.' },
          { text: 'Sur place, merci beaucoup !', translationPt: 'Para aqui, muito obrigado!' },
        ],
      },
    ],
    de: [
      {
        reply: 'Sehr gerne! Möchten Sie bar oder mit Karte bezahlen?',
        pt: 'Com todo prazer! O senhor/a senhora prefere pagar em dinheiro ou com cartão?',
        nativeAlt: trimmed,
        tip: 'Ótima estrutura! Mantenha o verbo conjugado sempre na 2ª posição da frase principal.',
        hints: [
          { text: 'Mit Karte, bitte.', translationPt: 'Com cartão, por favor.' },
          { text: 'Vielen Dank, alles klar!', translationPt: 'Muito obrigado, tudo certo!' },
        ],
      },
    ],
    it: [
      {
        reply: 'Perfetto! Posso portarvi anche dell’acqua naturale o frizzante?',
        pt: 'Perfeito! Posso trazer também água sem gás ou com gás?',
        nativeAlt: trimmed,
        tip: 'Muito natural! Destaque bem as consoantes duplas (como em "caffè" e "perfetto") para dar a musicalidade italiana.',
        hints: [
          { text: 'Acqua frizzante, per favore.', translationPt: 'Água com gás, por favor.' },
          { text: 'Grazie mille, va benissimo così!', translationPt: 'Muito obrigado, assim está ótimo!' },
        ],
      },
    ],
    ja: [
      {
        reply: 'かしこまりました！少々お待ちください。お飲み物はいかがですか？',
        reading: 'Kashikomarimashita! Shoushou omachi kudasai. Onomimono wa ikaga desu ka?',
        pt: 'Certamente! Aguarde um momento, por favor. Gostaria de alguma bebida?',
        nativeAlt: trimmed,
        tip: 'Excelente! Usar formas polidas com "kudasai" e "desu/masu" garante respeito imediato no Japão.',
        hints: [
          { text: 'お水をください。', reading: 'Omizu o kudasai.', translationPt: 'Água, por favor.' },
          { text: 'ありがとうございます！', reading: 'Arigatou gozaimasu!', translationPt: 'Muito obrigado!' },
        ],
      },
    ],
    zh: [
      {
        reply: '好的！这个八十块。你还要别的吗？',
        reading: 'Hǎo de! Zhège bāshí kuài. Nǐ hái yào biéde ma?',
        pt: 'Certo! Este custa 80 yuans. Você quer mais alguma coisa?',
        nativeAlt: trimmed,
        tip: 'Muito bem! Foque na clareza dos 4 tons — em mandarim o tom define a palavra.',
        hints: [
          { text: '不要了，谢谢！', reading: 'Bú yào le, xièxie!', translationPt: 'Não precisa mais, obrigado!' },
          { text: '可以刷卡吗？', reading: 'Kěyǐ shuākǎ ma?', translationPt: 'Posso pagar com cartão?' },
        ],
      },
    ],
    ko: [
      {
        reply: '네, 알겠습니다! 매장에서 드실 건가요, 포장해 드릴까요?',
        reading: 'Ne, algesseumnida! Maejang-eseo deusil geongayo, pojanghae deurilkkayo?',
        pt: 'Sim, entendido! Vai consumir aqui na loja ou prefere para viagem?',
        nativeAlt: trimmed,
        tip: 'Muito bom! Manter as terminações polidas "-요 (-yo)" ou "-주세요 (juseyo)" deixa sua fala super respeitosa.',
        hints: [
          { text: '포장해 주세요.', reading: 'Pojanghae juseyo.', translationPt: 'Para viagem, por favor.' },
          { text: '여기서 마실게요, 감사합니다!', reading: 'Yeogiseo masilgeyo, gamsahamnida!', translationPt: 'Vou beber aqui, obrigado!' },
        ],
      },
    ],
  };

  const bank = fallbackByLang[language];
  const pick = bank[turn % bank.length] ?? bank[0]!;
  const score = Math.min(96, Math.max(68, 72 + Math.min(18, wordCount * 3) + (hasPolite ? 6 : 0)));

  return {
    replyText: pick.reply,
    replyReading: pick.reading,
    replyTranslationPt: pick.pt,
    coach: {
      naturalnessScore: score,
      correctedVersion: trimmed,
      nativeAlternative: pick.nativeAlt,
      explanationPt: pick.tip,
      pronunciationTipPt:
        `Cenário "${scenario.titlePt}": pratique falar essa resposta em voz alta usando o microfone para fixar o ritmo.`,
      suggestedReplies: pick.hints,
    },
    providerUsed: 'local-pedagogical',
    modelUsed: 'naidioma-pedagogical-v1',
  };
}

export async function runConversationTurn(input: ChatTurnInput): Promise<ChatTurnResponse> {
  const startedAt = Date.now();
  const runtime = await getRuntimeSettings();
  const langMeta = LANGUAGES[input.language];

  const systemPrompt = [
    `You are ${input.scenario.aiRoleName}, acting as "${input.scenario.aiRoleTitlePt}" in a live spoken language roleplay.`,
    `Target language: ${langMeta.nativeName} (${langMeta.namePt}). Learner's native language: Brazilian Portuguese (PT-BR).`,
    `Scenario: ${input.scenario.situationPt}. CEFR level: ${input.scenario.cefr}.`,
    `Respond ONLY with valid JSON matching this exact shape:`,
    `{`,
    `  "replyText": "natural reply in ${langMeta.nativeName} (1-2 concise conversational sentences)",`,
    `  "replyReading": "optional romanization/pinyin/romaji if language is ja/zh/ko, otherwise omit",`,
    `  "replyTranslationPt": "natural PT-BR translation of replyText",`,
    `  "coach": {`,
    `    "naturalnessScore": 0-100 integer,`,
    `    "correctedVersion": "grammatically correct version of user message",`,
    `    "nativeAlternative": "how a friendly native speaker would naturally say it",`,
    `    "explanationPt": "1-2 concise sentences in PT-BR explaining grammar/choice or praising",`,
    `    "pronunciationTipPt": "1 short phonetic tip tailored for Brazilian Portuguese speakers",`,
    `    "suggestedReplies": [`,
    `      { "text": "next reply in target language", "reading": "optional", "translationPt": "PT-BR translation" },`,
    `      { "text": "second option", "reading": "optional", "translationPt": "PT-BR translation" }`,
    `    ]`,
    `  }`,
    `}`,
  ].join('\n');

  const historyText = input.history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Learner' : input.scenario.aiRoleName}: ${m.text}`)
    .join('\n');

  const userPrompt = `Conversation so far:\n${historyText || '(start)'}\n\nLearner just said: "${input.userMessage}"`;

  const tryProviders: Array<{
    provider: ActiveAiProvider;
    model: string;
    run: () => Promise<Record<string, unknown>>;
  }> = [];

  if (runtime.ollamaBaseUrl) {
    tryProviders.push({
      provider: 'ollama',
      model: runtime.ollamaModel || 'gpt-oss:20b',
      run: () =>
        callOllamaJson(
          runtime.ollamaBaseUrl,
          runtime.ollamaModel || 'gpt-oss:20b',
          runtime.ollamaApiKey,
          systemPrompt,
          userPrompt,
        ),
    });
  }

  if (runtime.openaiBaseUrl) {
    tryProviders.push({
      provider: 'openai-compatible',
      model: runtime.openaiModel || 'gpt-4o-mini',
      run: () =>
        callOpenAiCompatibleJson(
          runtime.openaiBaseUrl,
          config.openaiApiKey,
          runtime.openaiModel || 'gpt-4o-mini',
          systemPrompt,
          userPrompt,
        ),
    });
  }

  if (config.geminiApiKey) {
    tryProviders.push({
      provider: 'gemini',
      model: config.geminiModel,
      run: () => callGeminiJson(config.geminiApiKey, config.geminiModel, systemPrompt, userPrompt),
    });
  }

  for (const attempt of tryProviders) {
    try {
      const raw = await attempt.run();
      const coachParsed = CoachFeedbackSchema.safeParse(raw.coach);
      if (typeof raw.replyText === 'string' && typeof raw.replyTranslationPt === 'string' && coachParsed.success) {
        return {
          replyText: raw.replyText,
          replyReading: typeof raw.replyReading === 'string' ? raw.replyReading : undefined,
          replyTranslationPt: raw.replyTranslationPt,
          coach: coachParsed.data,
          providerUsed: attempt.provider,
          modelUsed: attempt.model,
          latencyMs: Date.now() - startedAt,
        };
      }
    } catch {
      // Fallback cleanly to next provider
    }
  }

  const fallback = buildPedagogicalFallback(input);
  return {
    ...fallback,
    latencyMs: Date.now() - startedAt,
  };
}

export async function explainPhrase(
  language: LanguageCode,
  phrase: string,
): Promise<ExplainPhraseResponse> {
  const runtime = await getRuntimeSettings();
  const langMeta = LANGUAGES[language];

  const systemPrompt = `You are a Brazilian-Portuguese-native polyglot coach teaching ${langMeta.namePt}. Return JSON with keys: breakdownPt, literalVsNaturalPt, brazilianPitfallPt, examples (array of 2 objects with target, optional reading, translationPt). Keep explanations crisp, warm, and direct in PT-BR.`;
  const userPrompt = `Explain this phrase in ${langMeta.nativeName}: "${phrase}"`;

  if (runtime.ollamaBaseUrl) {
    try {
      const raw = await callOllamaJson(
        runtime.ollamaBaseUrl,
        runtime.ollamaModel || 'gpt-oss:20b',
        runtime.ollamaApiKey,
        systemPrompt,
        userPrompt,
      );
      if (typeof raw.breakdownPt === 'string' && Array.isArray(raw.examples)) {
        return {
          breakdownPt: raw.breakdownPt,
          literalVsNaturalPt: String(raw.literalVsNaturalPt ?? ''),
          brazilianPitfallPt: String(raw.brazilianPitfallPt ?? ''),
          examples: raw.examples.slice(0, 2) as ExplainPhraseResponse['examples'],
          providerUsed: 'ollama',
        };
      }
    } catch {
      // fall through
    }
  }

  if (config.geminiApiKey) {
    try {
      const raw = await callGeminiJson(config.geminiApiKey, config.geminiModel, systemPrompt, userPrompt);
      if (typeof raw.breakdownPt === 'string' && Array.isArray(raw.examples)) {
        return {
          breakdownPt: raw.breakdownPt,
          literalVsNaturalPt: String(raw.literalVsNaturalPt ?? ''),
          brazilianPitfallPt: String(raw.brazilianPitfallPt ?? ''),
          examples: raw.examples.slice(0, 2) as ExplainPhraseResponse['examples'],
          providerUsed: 'gemini',
        };
      }
    } catch {
      // fall through
    }
  }

  return {
    breakdownPt: `"${phrase}" é uma construção autêntica em ${langMeta.namePt}. Ouça o áudio devagar (0.75x) e observe a ordem natural das palavras.`,
    literalVsNaturalPt:
      'Evite traduzir palavra por palavra do português: memorize o bloco inteiro como uma peça pronta de conversação.',
    brazilianPitfallPt: langMeta.brazilianFocusNote,
    examples: [
      {
        target: phrase,
        translationPt: 'Use esta frase exatamente neste bloco em conversas do dia a dia.',
      },
    ],
    providerUsed: 'local-pedagogical',
  };
}

export async function pingOllamaEndpoint(): Promise<{
  configured: boolean;
  reachable: boolean;
  url: string;
  model: string;
  availableModels: string[];
  error?: string;
}> {
  const runtime = await getRuntimeSettings();
  if (!runtime.ollamaBaseUrl) {
    return {
      configured: false,
      reachable: false,
      url: '',
      model: runtime.ollamaModel,
      availableModels: [],
      error: 'URL do Ollama ainda não configurada (aguardando Kaggle T4 x2 ou Ollama Cloud).',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const headers: Record<string, string> = {};
    if (runtime.ollamaApiKey) {
      headers['Authorization'] = `Bearer ${runtime.ollamaApiKey}`;
    }
    const res = await fetch(`${runtime.ollamaBaseUrl}/api/tags`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        configured: true,
        reachable: false,
        url: runtime.ollamaBaseUrl,
        model: runtime.ollamaModel,
        availableModels: [],
        error: `Endpoint respondeu HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? []).map((m) => m.name ?? '').filter(Boolean);
    return {
      configured: true,
      reachable: true,
      url: runtime.ollamaBaseUrl,
      model: runtime.ollamaModel,
      availableModels: models,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      url: runtime.ollamaBaseUrl,
      model: runtime.ollamaModel,
      availableModels: [],
      error: err instanceof Error ? err.message : 'Falha de conexão com Ollama',
    };
  } finally {
    clearTimeout(timeout);
  }
}
