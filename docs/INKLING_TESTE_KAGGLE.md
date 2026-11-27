# Integração Inkling (Thinking Machines, Apache 2.0) + Kaggle no NAidioma

Resumo técnico consolidado dos testes reais na conta Kaggle e da arquitetura de IA do NAidioma.

## 1. Aprendizados validados no Kaggle (`andreajoa/nexacloud-inkling-2-mini`)
1. **GPU só pelo navegador:** nas contas `andreajoa` e `andreeajoa`, notebooks enviados via terminal (`kaggle kernels push`) ficam presos em `Queued` por horas. Abrindo pelo navegador (**Edit → Run All** com `Accelerator: GPU T4 x2` e `Internet: ON`), a GPU liga na hora.
2. **Notebook base validado:** `https://www.kaggle.com/code/andreajoa/nexacloud-inkling-2-mini` (Ollama + `inkling-2-mini`, GPU T4 x2, Internet ligada).
3. **Desempenho medido:** ~11–13 tokens/s, excelente em JSON e classificação, português médio para conversa/reescrita livre.
4. **Papel correto do Kaggle:** o Kaggle é usado **apenas como fábrica de conteúdo em lote** (gerar novas lições/unidades JSON para os 8 idiomas em `scripts/kaggle-content-factory/naidioma_kaggle_ollama_factory.ipynb`), **nunca como servidor ao vivo do app** (zero túnel `cloudflared` em produção).

## 2. Arquitetura do Tutor ao Vivo 24h (`apps/api`)
- **Provedor principal futuro:** Ollama Cloud (`OLLAMA_BASE_URL=https://ollama.com`, `OLLAMA_MODEL=inkling-2-small`, `OLLAMA_API_KEY` apenas em variável de ambiente/secret no NexaCloud — nunca no código).
- **Timeout + Fallback automático:** se o Ollama falhar ou demorar mais de **15 segundos** (`15_000 ms` em `apps/api/src/services/ai-gateway.ts`), a API cai automaticamente para o **Gemini** (`GEMINI_API_KEY`) e, na ausência dele, para o motor pedagógico local.
- **Regra de liberação (Gate de Qualidade):** o Inkling só deve ser ativado para responder alunos após rodar e empatar/vencer o benchmark de 20 interações reais contra o Gemini:
  ```bash
  OLLAMA_API_KEY="..." GEMINI_API_KEY="..." node scripts/kaggle-content-factory/benchmark_inkling_vs_gemini.mjs
  ```
- O próprio benchmark consulta `GET https://ollama.com/api/tags` para confirmar o nome exato do modelo `inkling-2-small` na API do Ollama Cloud.
