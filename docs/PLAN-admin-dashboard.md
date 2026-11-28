# PLAN: Painel Administrativo Exclusivo (`/dashboard`), Telemetria & Relatórios — NAidioma

## 1. Contexto & Arquitetura Existente
- **Tipo de projeto:** Monorepo Web/PWA + API + Mobile Capacitor (`@naidioma/shared`, `@naidioma/api`, `@naidioma/app`).
- **Stack:** Fastify 5, Prisma 6, SQLite com sincronização automática criptografada AES-256-GCM para Cloudflare Private KV (`apps/api/src/services/cloud-sync.ts`), React 19, Vite 6, Tailwind CSS v4, Phosphor Icons, Motion.
- **Deploy:** NexaCloud (`https://naidioma.nexaclouds.online`), build Docker + `cloud-restore.js` + `prisma db push`.
- **Segurança em Repositório Público:** Zero senhas, zero hashes de senha, zero salts e zero segredos no código-fonte ou no histórico Git. Credenciais do admin vivem exclusivamente em variáveis de ambiente do NexaCloud (`ADMIN_DASHBOARD_PASSWORD_HASH` / `ADMIN_DASHBOARD_PASSWORD` / `ADMIN_API_KEY`) e/ou rotacionadas dentro do banco criptografado (`RuntimeConfig` no Cloudflare KV).

## 2. Escopo Funcional
1. **Rota dedicada `/dashboard` (100% isolada dos alunos):**
   - Acessível diretamente por URL sem precisar de conta de aluno.
   - Removido o link "Painel Admin" do rodapé do `ProfileView` dos alunos.
   - Bloqueado para motores de busca (`robots.txt`, `X-Robots-Tag: noindex, nofollow`, meta tag dinâmica).
   - Autenticação exclusiva do proprietário com senha forte (`scrypt` + `timingSafeEqual`), JWT dedicado (`aud: naidioma-admin-dashboard`), rate-limit e lockout anti-força-bruta (5 tentativas / 15 min), troca de senha dentro do painel (invalidando sessões anteriores) e `AdminAuditLog`.
2. **Telemetria completa de acessos, localização e tempo de uso:**
   - Captura automática de cidade/estado/país/fuso via headers Cloudflare (`cf-ipcity`, `cf-region`, `cf-ipcountry`, `cf-timezone`) + fallback GeoIP com cache em memória (não bloqueante) + campo opcional de Cidade/Estado no cadastro e perfil.
   - Rastreamento de visitantes anônimos e cadastrados (`VisitorSession`): páginas de entrada (incluindo páginas SEO `/pt-br/`, `/en-us/` etc.), referrer, UTMs, dispositivo, OS, navegador, PWA instalado, conversão visitante → cadastro.
   - Medição precisa de tempo ativo em primeiro plano (pausa quando aba está oculta, heartbeat periódico + `sendBeacon` ao sair), tempo por tela/aba (`learn`, `lesson`, `alphabet`, `conversation`, `live_call`, `review`, `profile`), duração real por lição e horários de pico.
   - Eventos de produto (`AnalyticsEvent`) para funil, abandono de lição, exames oficiais, chamadas IA e acessibilidade (Modo Calmo/Som).
3. **Inteligência para melhorias do app + Relatórios persistentes:**
   - Cálculo dinâmico de idioma(s) estudado(s) e nível CEFR exato (`A1`–`C2`) por perfil usando `computeCourseLevelProgress`.
   - Diagnóstico pedagógico: lições mais difíceis (menor precisão / mais tentativas / abandono), aprovação em Exames Oficiais, adoção de funcionalidades e lista de insights/recomendações automáticas.
   - Geração e persistência de relatórios históricos (`SavedReport`) no SQLite/Cloudflare KV, exportação CSV (UTF-8 com BOM para Excel BR), JSON, impressão/PDF executivo e envio opcional por e-mail via NovaMail/Resend/Brevo + cron semanal `/api/cron/weekly-report`.
4. **Unificação do Painel Admin:**
   - Absorve Mailing LGPD, Campanhas NovaMail, Feedbacks e Configurações (IA/Ollama/Stripe/Versão) dentro do `/dashboard`, em visual editorial claro na paleta Núcleo Afetar (sem roxo).

## 3. Fases de Execução
- **Fase 1 (Banco):** Atualizar `apps/api/prisma/schema.prisma`, endurecer `.gitignore` e rodar `prisma generate` + `prisma db push`.
- **Fase 2 (Backend & Segurança):** Implementar `services/geo.ts`, `services/admin-auth.ts`, `services/analytics.ts`, `routes/telemetry.ts`, `routes/admin-dashboard.ts`; integrar hooks em `auth.ts`, `courses.ts`, `ai.ts`, `seo.ts`, `feedback-admin.ts`, `server.ts`, `config.ts`, `nexacloud.json`.
- **Fase 3 (Cliente & Telemetria):** Criar `apps/app/src/lib/telemetry.ts`, adicionar campo opcional Cidade/Estado em `AuthScreen.tsx` e `ProfileView.tsx`, remover botão Admin do `ProfileView.tsx`, conectar rastreamento de sessões/telas/eventos em `App.tsx`, `LessonPlayer.tsx` e `ConversationView.tsx`.
- **Fase 4 (UI `/dashboard`):** Construir `AdminDashboard.tsx` (lazy-loaded) + subcomponentes modulares de gráficos SVG, tabela/dossiê de perfis, acessos/cidades, pedagógico/melhorias, relatórios/impressão PDF, mailing/feedbacks e segurança/sistema.
- **Fase 5 (Verificação):** Escrever testes de integração cobrindo auth admin, brute-force, telemetria, GeoIP, níveis CEFR por perfil, agregações, relatórios e exportação CSV; rodar `typecheck`, `test`, `build` e scripts de auditoria de segurança.
