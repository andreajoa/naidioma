import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { z } from 'zod';
import { NAIDIOMA_PLANS, getPlanByKey } from '@naidioma/shared';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';
import { getRuntimeSettings } from '../services/runtime-config.js';
import { requireUser } from './auth.js';

const CheckoutSchema = z.object({
  planKey: z.enum(['plus_monthly', 'plus_yearly', 'pro_monthly', 'pro_yearly']),
});

function getStripeClient(): Stripe | null {
  if (!config.stripeSecretKey) return null;
  return new Stripe(config.stripeSecretKey);
}

export async function registerBillingRoutes(app: FastifyInstance) {
  // Always safe to query: returns billingVisible=false during free open beta so UI stays 100% free & clean.
  app.get('/api/billing/status', async (req) => {
    const [runtime, user] = await Promise.all([getRuntimeSettings(), requireUser(req)]);

    return {
      billingVisible: runtime.billingUiEnabled,
      freeBetaMode: runtime.freeBetaMode,
      stripeConfigured: Boolean(config.stripeSecretKey),
      currentTier: user?.subscriptionTier ?? 'free',
      currentPlanKey: user?.subscriptionPlanKey ?? 'free',
      subscriptionExpiresAt: user?.subscriptionExpiresAt?.toISOString() ?? null,
      plans: NAIDIOMA_PLANS.map((plan) => ({
        ...plan,
        stripePriceConfigured: plan.stripePriceEnvKey
          ? Boolean(config.stripePrices[plan.stripePriceEnvKey])
          : true,
      })),
    };
  });

  app.post('/api/billing/checkout', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Faça login para assinar.' });

    const runtime = await getRuntimeSettings();
    if (!runtime.billingUiEnabled) {
      return reply.status(403).send({
        error: 'O NAidioma está 100% gratuito na fase aberta! Nenhuma cobrança está ativa no momento.',
      });
    }

    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Plano selecionado inválido.' });

    const plan = getPlanByKey(parsed.data.planKey);
    if (!plan || !plan.stripePriceEnvKey) {
      return reply.status(400).send({ error: 'Plano inválido.' });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return reply.status(503).send({
        error: 'Stripe aguardando chave STRIPE_SECRET_KEY no servidor.',
      });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.displayName,
        metadata: { userId: user.id, app: 'naidioma' },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const configuredPriceId = config.stripePrices[plan.stripePriceEnvKey];
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = configuredPriceId
      ? { price: configuredPriceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: plan.priceCentsBrl,
            recurring: {
              interval: plan.billingCycle === 'year' ? 'year' : 'month',
            },
            product_data: {
              name: plan.namePt,
              description: plan.taglinePt,
            },
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      allow_promotion_codes: true,
      line_items: [lineItem],
      success_url: `${config.appPublicUrl}/?billing=success&plan=${plan.key}`,
      cancel_url: `${config.appPublicUrl}/?billing=cancelled`,
      metadata: {
        userId: user.id,
        planKey: plan.key,
        tier: plan.tier,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planKey: plan.key,
          tier: plan.tier,
        },
      },
    });

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  });

  app.post('/api/billing/portal', async (req, reply) => {
    const user = await requireUser(req);
    if (!user) return reply.status(401).send({ error: 'Sessão necessária.' });

    const stripe = getStripeClient();
    if (!stripe || !user.stripeCustomerId) {
      return reply.status(400).send({ error: 'Nenhuma assinatura Stripe vinculada a esta conta.' });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: config.appPublicUrl,
    });
    return { portalUrl: portal.url };
  });

  // Stripe Webhook with raw-body signature verification
  app.post(
    '/api/billing/webhook',
    {
      config: { rawBody: true },
    },
    async (req, reply) => {
      const stripe = getStripeClient();
      if (!stripe || !config.stripeWebhookSecret) {
        return reply.status(503).send({ error: 'Stripe webhook não configurado.' });
      }

      const signature = req.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Assinatura Stripe ausente.' });
      }

      const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody ?? JSON.stringify(req.body);
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
      } catch (err) {
        return reply.status(400).send({
          error: `Webhook inválido: ${err instanceof Error ? err.message : 'erro de assinatura'}`,
        });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planKey = session.metadata?.planKey ?? 'plus_monthly';
        const tier = session.metadata?.tier ?? 'plus';
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTier: tier,
              subscriptionPlanKey: planKey,
              subscriptionProvider: 'stripe',
              stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
              stripeSubscriptionId:
                typeof session.subscription === 'string' ? session.subscription : undefined,
            },
          });
        }
      } else if (
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const sub = event.data.object as Stripe.Subscription;
        const active = sub.status === 'active' || sub.status === 'trialing';
        const tier = active ? sub.metadata?.tier || 'plus' : 'free';
        const planKey = active ? sub.metadata?.planKey || 'plus_monthly' : 'free';
        const periodEnd = sub.current_period_end;

        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            subscriptionTier: tier,
            subscriptionPlanKey: planKey,
            subscriptionExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
          },
        });
      }

      return { received: true };
    },
  );
}
