import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LanguageCodeSchema, getScenarioById } from '@naidioma/shared';
import { prisma } from '../lib/prisma.js';
import {
  explainPhrase,
  getAiCapabilities,
  runConversationTurn,
  transcribeAudioBuffer,
} from '../services/ai-gateway.js';
import { getRuntimeSettings } from '../services/runtime-config.js';
import { requireUser } from './auth.js';

const ConversationSchema = z.object({
  scenarioId: z.string().min(1),
  userMessage: z.string().trim().min(1).max(600),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string(),
      }),
    )
    .max(20)
    .default([]),
});

const ExplainSchema = z.object({
  language: LanguageCodeSchema,
  phrase: z.string().trim().min(1).max(300),
});

const TranscribeSchema = z.object({
  language: LanguageCodeSchema,
  audioBase64: z.string().min(100).max(3_200_000),
  mimeType: z.string().max(80).optional(),
});

export async function registerAiRoutes(app: FastifyInstance) {
  app.get('/api/ai/status', async () => {
    return getAiCapabilities();
  });

  app.post('/api/ai/transcribe', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão necessária.' });

    const parsed = TranscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Áudio inválido ou grande demais para transcrição.' });
    }

    return transcribeAudioBuffer(parsed.data);
  });

  app.post('/api/ai/conversation', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão necessária.' });

    const parsed = ConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Mensagem inválida para o tutor de IA.' });
    }

    const scenario = getScenarioById(parsed.data.scenarioId);
    if (!scenario) {
      return reply.status(404).send({ error: 'Cenário de conversa não encontrado.' });
    }

    // Daily anti-abuse quota (generous during free beta)
    const runtime = await getRuntimeSettings();
    const dateKey = new Date().toISOString().slice(0, 10);
    const usage = await prisma.aiUsageDaily.findUnique({
      where: { userId_dateKey: { userId: user.id, dateKey } },
    });

    if (usage && usage.turnsUsed >= runtime.dailyFreeAiTurns && user.subscriptionTier !== 'pro') {
      return reply.status(429).send({
        error: `Você atingiu o limite diário de ${runtime.dailyFreeAiTurns} turnos de IA no beta gratuito. Volte amanhã para continuar praticando!`,
      });
    }

    const result = await runConversationTurn({
      language: scenario.language,
      scenario,
      history: parsed.data.history,
      userMessage: parsed.data.userMessage,
    });

    await Promise.all([
      prisma.aiUsageDaily.upsert({
        where: { userId_dateKey: { userId: user.id, dateKey } },
        create: { userId: user.id, dateKey, turnsUsed: 1 },
        update: { turnsUsed: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { xpTotal: { increment: 12 } },
      }),
    ]);

    return {
      ...result,
      dailyQuotaRemaining: Math.max(
        0,
        runtime.dailyFreeAiTurns - ((usage?.turnsUsed ?? 0) + 1),
      ),
    };
  });

  app.post('/api/ai/explain', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão necessária.' });

    const parsed = ExplainSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Frase inválida.' });
    }

    return explainPhrase(parsed.data.language, parsed.data.phrase);
  });
}
