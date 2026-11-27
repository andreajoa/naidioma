# NAidioma — Plataforma 100% Online de Idiomas (Web/PWA + Android + Apple iOS)

Plataforma completa e cutting-edge de aprendizado de **8 idiomas** (Inglês para Brasileiros em destaque, Espanhol, Francês, Alemão, Italiano, Japonês, Chinês Mandarim e Coreano) na paleta visual oficial do **Núcleo Afetar** (`nucleoafetar.com.br`).

**100% online na nuvem** — deploy pronto no **NexaCloud** com **persistência automática criptografada (AES-256-GCM) no Cloudflare Private KV** (zero Neon, sem risco de bloqueio por limite de horas), IA na nuvem (**Ollama Cloud / Kaggle GPU T4 x2** com fallback 24/7), e-mail profissional (**Resend / Brevo**), **Stripe** conectado (oculto até liberação) e builds automáticos de **Android** e **Apple iOS** no GitHub Actions.

## Recursos Principais
- **Cadastro obrigatório + Mailing LGPD:** captura nome, e-mail, WhatsApp opcional, idioma de interesse e origem (`utm_source` / `nucleoafetar`), envia e-mail profissional de boas-vindas e permite baixar o **Mailing CSV** direto no Painel Admin.
- **PWA fácil de instalar + Modo Offline de estudo:** botão de 1 clique no Android/Desktop, guia visual de 2 toques no iPhone (com ícone nativo `apple-touch-icon.png`) e cache offline que sincroniza automaticamente com a nuvem quando o aparelho reconecta.
- **8 Idiomas completos para brasileiros:** 6 tipos de exercícios (incluindo treino de pronúncia por microfone, armadilhas PT↔idioma e laboratório de escrita Furigana/Pinyin/Hangul).
- **Estúdio de Conversa por Voz IA:** gateway multi-provedor na nuvem (Ollama Cloud / Kaggle GPU T4 x2 → OpenAI-compatible → Gemini).
- **Revisão Científica FSRS-4.5:** agenda cada expressão no momento exato antes do esquecimento.
- **Stripe 100% conectado (oculto durante o beta gratuito):** planos compatíveis em BRL prontos, invisíveis no app enquanto `BILLING_UI_ENABLED=false`.
- **Single Codebase → Web/PWA + Android + Apple iOS:** projetos nativos em `apps/app/android` e `apps/app/ios` (Swift Package Manager). Toda atualização no código atualiza as 3 plataformas juntas.

## Deploy 100% Online no NexaCloud
1. Conecte este repositório no **NexaCloud** (o `Dockerfile` e `nexacloud.json` já sobem API + Web App/PWA na porta `3000`).
2. Configure `DATABASE_URL="file:/app/data/naidioma.db"`, `CLOUD_SYNC_URL` e `CLOUD_SYNC_TOKEN` (Cloudflare Private KV do NexaCloud) e as variáveis listadas em `apps/api/.env.example`.
3. O container restaura automaticamente o último snapshot criptografado do Cloudflare no boot, executa `prisma db push` e replica todas as alterações continuamente para a nuvem Cloudflare.

## Builds na Nuvem para Android e Apple iOS
O workflow `.github/workflows/build-all-platforms.yml` compila automaticamente na nuvem:
- Testes + API + Web/PWA com camada de persistência Cloudflare;
- App **Android** (`.apk` pronto para instalar/testar e `.aab` para Google Play);
- App **Apple iOS** (compilado em runner macOS Xcode com Swift Package Manager).
