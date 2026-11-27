#!/usr/bin/env node
/**
 * NAidioma — Benchmark de Qualidade (20 Interações Reais): Inkling 2 Small (Ollama Cloud) vs Gemini
 *
 * Uso:
 *   OLLAMA_API_KEY=... GEMINI_API_KEY=... node scripts/kaggle-content-factory/benchmark_inkling_vs_gemini.mjs
 *
 * Só ativar OLLAMA_BASE_URL=https://ollama.com em produção no NexaCloud se o Inkling empatar ou ganhar do Gemini
 * em latência (< 15s), JSON válido, qualidade do português brasileiro e naturalidade do idioma-alvo.
 */

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'https://ollama.com').replace(/\/+$/, '');
const OLLAMA_API_KEY = (process.env.OLLAMA_API_KEY || '').trim();
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || 'inkling-2-small').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = [
  'You are a friendly polyglot tutor for Brazilian learners (both kids aged 9+ and adults) in NAidioma.',
  'Respond ONLY with valid JSON: {"replyText": string, "replyReading": string, "replyTranslationPt": string, "correctedVersion": string, "explanationPt": string}.',
  'Keep PT-BR crisp, natural, warm, and accurate.',
].join('\n');

const TEST_CASES = [
  { id: 1, lang: 'en', task: 'tutor', input: 'I have 25 years old and I am from Brazil.' },
  { id: 2, lang: 'en', task: 'tutor', input: 'I pretend to travel to Disney next year.' },
  { id: 3, lang: 'en', task: 'tutor', input: 'Actually I live in São Paulo right now.' },
  { id: 4, lang: 'en', task: 'tutor', input: 'Give me one iced coffee please.' },
  { id: 5, lang: 'en', task: 'tutor', input: 'My parents lives in Rio, they are very funny.' },
  { id: 6, lang: 'en', task: 'explain', input: 'Explique a diferença entre PUSH e PULL para um brasileiro.' },
  { id: 7, lang: 'en', task: 'explain', input: 'Por que falamos "I worked" com som de T no final?' },
  { id: 8, lang: 'en', task: 'explain', input: 'Quando usar "make" e quando usar "do" em inglês?' },
  { id: 9, lang: 'en', task: 'tutor', input: 'Yesterday I go to the mall with my friends.' },
  { id: 10, lang: 'en', task: 'tutor', input: 'Can you explain me how this works?' },
  { id: 11, lang: 'en', task: 'tutor', input: 'I am agree with your idea!' },
  { id: 12, lang: 'en', task: 'tutor', input: 'I need to make my homework before play.' },
  { id: 13, lang: 'ko', task: 'kids-tutor', input: '안녕! 나는 브라질에서 왔어.' },
  { id: 14, lang: 'ko', task: 'kids-tutor', input: '아이스크림 하나 주세요!' },
  { id: 15, lang: 'ko', task: 'explain', input: 'Explique para uma criança de 9 anos como ler 안녕하세요.' },
  { id: 16, lang: 'ko', task: 'explain', input: 'Qual a diferença entre 안녕 e 안녕하세요?' },
  { id: 17, lang: 'es', task: 'tutor', input: 'La comida está muy exquisita, pero tengo mucha vergüenza.' },
  { id: 18, lang: 'fr', task: 'tutor', input: 'Je veux un croissant maintenant.' },
  { id: 19, lang: 'ja', task: 'kids-tutor', input: 'すみません、みずをください。' },
  { id: 20, lang: 'en', task: 'tutor', input: 'How do I politely ask to move a meeting to Thursday?' },
];

async function listOllamaCloudModels() {
  if (!OLLAMA_API_KEY) return [];
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      headers: { Authorization: `Bearer ${OLLAMA_API_KEY}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

async function callOllama(tc) {
  const t0 = Date.now();
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OLLAMA_API_KEY}`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `[lang=${tc.lang}, task=${tc.task}] ${tc.input}` },
      ],
      options: { temperature: 0.4 },
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status}` };
  const data = await res.json();
  try {
    const parsed = JSON.parse(data?.message?.content || '{}');
    return { ok: Boolean(parsed.replyText || parsed.explanationPt), ms, parsed };
  } catch {
    return { ok: false, ms, error: 'Invalid JSON' };
  }
}

async function callGemini(tc) {
  const t0 = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `[lang=${tc.lang}, task=${tc.task}] ${tc.input}` }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status}` };
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try {
    const parsed = JSON.parse(raw);
    return { ok: Boolean(parsed.replyText || parsed.explanationPt), ms, parsed };
  } catch {
    return { ok: false, ms, error: 'Invalid JSON' };
  }
}

async function main() {
  console.log('=== NAidioma Benchmark (20 interações): Inkling 2 Small vs Gemini ===');
  if (OLLAMA_API_KEY) {
    const models = await listOllamaCloudModels();
    const inklingModels = models.filter((m) => m.toLowerCase().includes('inkling'));
    console.log('Modelos Inkling encontrados na API Ollama Cloud:', inklingModels.length ? inklingModels : models.slice(0, 10));
  } else {
    console.log('AVISO: OLLAMA_API_KEY não informada — pulando chamadas ao Inkling.');
  }

  const report = [];
  for (const tc of TEST_CASES) {
    const row = { id: tc.id, lang: tc.lang, task: tc.task, input: tc.input };
    if (OLLAMA_API_KEY) {
      row.inkling = await callOllama(tc).catch((e) => ({ ok: false, ms: TIMEOUT_MS, error: String(e) }));
    }
    if (GEMINI_API_KEY) {
      row.gemini = await callGemini(tc).catch((e) => ({ ok: false, ms: TIMEOUT_MS, error: String(e) }));
    }
    console.log(
      `#${String(tc.id).padStart(2, '0')} [${tc.lang}] Inkling: ${row.inkling ? `${row.inkling.ok ? 'OK' : 'FAIL'} ${row.inkling.ms}ms` : 'skip'} | Gemini: ${row.gemini ? `${row.gemini.ok ? 'OK' : 'FAIL'} ${row.gemini.ms}ms` : 'skip'}`,
    );
    report.push(row);
  }

  const fs = await import('node:fs');
  const outPath = '/tmp/naidioma-benchmark-inkling-vs-gemini.json';
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('Relatório completo salvo em:', outPath);
}

void main();
