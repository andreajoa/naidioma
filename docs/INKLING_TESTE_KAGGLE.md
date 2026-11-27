# Inkling 2 Mini — teste real no Kaggle (27/11/2026)

Teste feito pelo Claude Code na conta Kaggle `andreajoa`, GPU **T4 x2**, Ollama `inkling-2-mini` (17 GB).
Script: `~/nexacloud-ai-orchestrator/ai-studio/kaggle/inkling-2-mini/inkling_kaggle.py`
Notebook: `andreajoa/nexacloud-inkling-2-mini` (privado).

## Resultados medidos

| Teste | Tempo | Tokens | Velocidade | Qualidade |
|---|---|---|---|---|
| Classificação em JSON | 175,7 s (inclui carregar o modelo) | 467 | 12,5 tok/s | JSON válido e correto |
| Paráfrase de notícia | 43,1 s | 545 | 12,9 tok/s | Fatos certos, texto enrolado/pouco natural |
| Atendimento WhatsApp | 25,1 s | 322 | 13,2 tok/s | Não inventou preço, tom robótico |
| HTML motion (GSAP) | 521 s | 5.731 | 11,0 tok/s | Funcional, com 1 bug de centralização dupla |

Memória de GPU usada: 13,8 GB + 9,8 GB (as duas T4 quase cheias).

## O que isso significa para o NAidioma

- **Tutor/conversa ao vivo: NÃO usar Inkling no Kaggle.** ~12 tokens/s é lento demais para chat
  (uma resposta de 300 tokens leva ~25 s) e o Kaggle não fica ligado 24h — a sessão tem limite
  de horas e cota de 30 h de GPU por semana.
- **Geração de conteúdo em lote (lições, exercícios, frases): pode usar.** A IA liga a sessão,
  gera tudo, salva em `/kaggle/working/` e desliga. O padrão já existente em
  `scripts/kaggle-content-factory/` (Ollama + `gpt-oss:20b`) serve; basta trocar o modelo
  por `inkling-2-mini` se quiser compará-lo.
- **Para o app em produção (sempre ligado)** usar um serviço que já fica no ar:
  - Gemini (`gemini-2.5-flash`, já configurado em `apps/api/src/lib/config.ts`), ou
  - Ollama Cloud `inkling-2-small:cloud` (pago por uso: US$ 0,30/M entrada, US$ 1,00/M saída) —
    configurar via `ollamaBaseUrl` / `ollamaApiKey` / `ollamaModel`.
  - O Inkling 2 **Mini** NÃO existe no Ollama Cloud.

## Como rodar no Kaggle (importante)

- Pelo **terminal/API** (`kaggle kernels push`) a GPU fica presa em **fila (QUEUED) por horas** nessa conta.
- Pelo **navegador** (abrir o notebook → Edit → Run All) a GPU sai na hora. A IA consegue fazer isso
  sozinha controlando o Chrome do Mac logado no Kaggle, e também desligar a sessão no fim
  (botão "Stop session") para não gastar cota.
- Configuração obrigatória: Accelerator **GPU T4 x2**, Internet **ligada**.
