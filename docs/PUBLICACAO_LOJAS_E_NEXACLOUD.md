# Guia de Publicação 100% Online — NAidioma (NexaCloud + Cloudflare Sync + Android + Apple iOS + Stripe + Ollama)

Tudo no **NAidioma** foi desenhado para rodar **100% online na nuvem**, sem depender de máquina local e **sem Neon** (sem bloqueios por horas de computação).

## 1. Deploy no NexaCloud (API + Web App / PWA + Persistência Cloudflare)
1. Conecte o repositório público `naidioma` no **NexaCloud** (`framework: server`, Node 22).
2. A persistência de banco roda em **SQLite em disco rápido + replicação automática criptografada (AES-256-GCM) no Cloudflare Private KV do NexaCloud** a cada escrita, no cron `/api/cron/backup` e no encerramento do container, com restauração automática no boot (`cloud-restore.js`).
3. Configure as variáveis de ambiente baseadas em `apps/api/.env.example`:
   - `DATABASE_URL`: `file:/app/data/naidioma.db`
   - `CLOUD_SYNC_URL`: `https://app.nexaclouds.online/api/customer/projects/naidioma/kv`
   - `CLOUD_SYNC_TOKEN`: token privado do projeto no NexaCloud
   - `APP_PUBLIC_URL`: domínio público (ex.: `https://naidioma.nexaclouds.online` ou `https://naidioma.com.br`)
   - `JWT_SECRET` e `ADMIN_API_KEY`: chaves fortes aleatórias
   - `FREE_BETA_MODE="true"` e `BILLING_UI_ENABLED="false"` (mantém 100% gratuito e sem preços visíveis no beta)
   - `EMAIL_FROM="NAidioma <contato@naidioma.com.br>"` + `RESEND_API_KEY` ou `BREVO_API_KEY`

---

## 2. Conectar Ollama na Nuvem (Kaggle GPU T4 x2 ou Ollama Cloud)
1. Suba o notebook `scripts/kaggle-content-factory/naidioma_kaggle_ollama_factory.ipynb` no **Kaggle (GPU T4 x2 + Internet ON)** — ou use sua chave do **Ollama Cloud** (`https://ollama.com`).
2. Abra o NAidioma online → **Perfil → Painel Admin → Aba "Ollama/Kaggle · Stripe · Versão"**.
3. Cole a URL do Ollama + modelo (`gpt-oss:20b`) e clique em **Salvar**.
4. Configure também `GEMINI_API_KEY` no NexaCloud como fallback 24/7 automático para os momentos em que a sessão do Kaggle expirar.

---

## 3. Exportar seu Mailing para E-mail Marketing
- No site online, abra **Perfil → Painel Admin → Aba "Mailing"** e clique em **Baixar Mailing CSV** (pronto para Brevo/Resend, já com opt-in LGPD e origem `nucleoafetar`).

---

## 4. Ativar a Cobrança Stripe (quando decidir começar a cobrar)
Toda a cobrança Stripe já está implementada (Checkout BRL, Portal do Cliente e Webhook), mas **invisível** enquanto `BILLING_UI_ENABLED="false"`.
1. No NexaCloud, preencha `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (webhook: `https://seu-dominio/api/billing/webhook`) e opcionalmente os `STRIPE_PRICE_*`.
2. No **Painel Admin**, ative **"Exibir tela de planos e pagamentos Stripe no app"** e desative `FREE_BETA_MODE`.

---

## 5. Atualizar e Publicar Android e Apple iOS (100% pela Nuvem)
Cada push na branch `main` roda `.github/workflows/build-all-platforms.yml` no GitHub Actions:
- Gera o APK Android em nuvem (`ubuntu-latest`);
- Verifica e compila o projeto Apple iOS em nuvem (`macos-15` + Xcode + Swift Package Manager);
- Quando publicar nas lojas (Google Play US$ 25 única / Apple Developer US$ 99/ano), basta atualizar o campo **"Versão mais recente do app"** no Painel Admin para avisar todos os usuários automaticamente.
