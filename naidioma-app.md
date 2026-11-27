# NAidioma — Plataforma Cutting-Edge 100% Online de Idiomas (Web/PWA + Android + iOS)

## Goal
Construir o **NAidioma** (`com.naidioma.app`), plataforma 100% online na nuvem (Web/PWA offline-first + Android nativo + Apple iOS nativo em um único código-base), na paleta oficial do **Núcleo Afetar** (`nucleoafetar.com.br`), com 8 idiomas ensinados a partir do Português BR (destaque para Inglês para Brasileiros), cadastro obrigatório com mailing LGPD + e-mail profissional, FSRS-4.5, tutor de voz IA multi-provedor (Ollama Cloud / Kaggle T4 x2 + fallback), Stripe 100% conectado (oculto até liberação), PostgreSQL em nuvem, NexaCloud deploy e CI mobile.

## Project Type
FULL-STACK + CROSS-PLATFORM MOBILE (Monorepo: Web/PWA + Capacitor 7 Android & Apple iOS SPM + Fastify API + Prisma PostgreSQL + Stripe + Resend/Brevo)

## Task Breakdown
- [x] **T1 — Monorepo & Identidade NAidioma:** Estrutura pnpm, `Dockerfile`, `nexacloud.json`, plano técnico.
- [x] **T2 — Core Compartilhado (`@naidioma/shared`):** FSRS-4.5, avaliador de pronúncia, currículo 8 idiomas (EN flagship + ES, FR, DE, IT, JA, ZH, KO) e tabela de planos BRL compatíveis.
- [x] **T3 — Backend API 100% Cloud (`@naidioma/api`):** Fastify + Prisma PostgreSQL + Cadastro obrigatório com mailing LGPD/UTM + E-mail profissional (Resend/Brevo) + Stripe Checkout/Portal/Webhook (oculto via `BILLING_UI_ENABLED=false`) + AI Gateway Multi-Provedor + Admin Mailing CSV + Version Engine.
- [x] **T4 — Web App / PWA Offline-First (`@naidioma/app`):** Paleta Núcleo Afetar, fontes self-hosted, instalação 1 clique (Android/Desktop) + guia visual 2 toques (iPhone + `apple-touch-icon.png`), fila de sincronização offline, 6 motores de exercício (microfone + Furigana/Pinyin/Hangul), Voz IA, FSRS-4.5, Feedback 2 cliques, Stripe oculto e Painel Admin.
- [x] **T5 — Projetos Nativos Android e Apple iOS (Capacitor 7):** `apps/app/android/` (Gradle + `RECORD_AUDIO` + ícones NAidioma) e `apps/app/ios/` (Xcode + Swift Package Manager + `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` + ícone 1024×1024).
- [x] **T6 — Kit Kaggle GPU T4 x2 + CI Cloud Android/iOS:** Notebook Ollama `gpt-oss` + `.github/workflows/build-all-platforms.yml` (PostgreSQL CI + Android APK + Apple iOS macOS runner).
- [x] **T7 — Phase X Verificação Final:** TypeScript strict, Vitest, builds de produção, Capacitor sync, auditoria de segurança (0 segredos), limpeza total de arquivos locais.

## ✅ PHASE X COMPLETE
- Shared Core TypeScript & Tests: ✅ 5/5 Pass
- API TypeScript, Prisma PostgreSQL & Integration Tests: ✅ 6/6 Pass (verified end-to-end before switching schema to PostgreSQL cloud)
- Web App + PWA Production Build: ✅ Success (77 precached offline entries)
- Capacitor Native Android & Apple iOS (SPM) Sync: ✅ Success (6 plugins + permissions + 16 branded PNG icons)
- Security Scan (Source): ✅ 0 real secrets, 0 dangerous code patterns, zero local DB/env files committed
- Date: 2026-11-27
