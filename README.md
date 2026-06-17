# Score Brasil

Ranking de deputados federais brasileiros baseado em dados públicos. O sistema coleta dados da Câmara dos Deputados e do TSE, classifica proposições e votações por valor público, e gera um ranking transparente e auditável.

## Desenvolvimento

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Pipeline de Dados

O sistema usa um pipeline de 4 estágios para processar dados públicos:

```
fetch → process → classify → apply
```

### Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run data` | Menu interativo para escolher o estágio |
| `npm run data:fetch` | Baixar dados da Câmara e TSE (com cache) |
| `npm run data:fetch -- --fresh` | Forçar re-download de todos os dados |
| `npm run data:process` | Parsear CSVs e compilar ranking (12GB RAM) |
| `npm run data:process -- --fresh` | Reprocessar sem usar cache de download |
| `npm run data:sync` | Pipeline completo (fetch + process) |
| `npm run data:sync -- --fresh` | Pipeline completo, forçar re-download |
| `npm run data:apply` | Aplicar classificações nos dados existentes |
| `npm run data:classify` | Classificar proposições/votações com IA (interativo) |
| `npm run data:classify:votes` | Classificar votações com LLM |
| `npm run data:classify:proposals` | Classificar proposições com LLM |
| `npm run data:classifications:pending` | Gerar lista de itens pendentes |
| `npm run data:public-value:rebuild` | Reconstruir valor público do snapshot existente |

### Estágios em Detalhe

#### 1. Fetch (`data:fetch`)

Baixa ~33 arquivos CSV/ZIP da Câmara dos Deputados e do TSE. Os dados ficam em cache (`scripts/.data-cache/`) com hash SHA-256. Rodar `--fresh` ignora o cache e re-baixa tudo.

Fontes:
- **Câmara dos Deputados**: Deputados, eventos, presença, votações, proposições, autores, tramitações, gastos parlamentares, servidores
- **TSE**: Candidatos, bens declarados, votações municipais, receitas e despesas de campanha
- **Transferegov**: Emendas parlamentares

#### 2. Process (`data:process`)

Parseia todos os CSVs/ZIPs, cruza dados entre fontes, e compila:

- `ranking-snapshot.json` — Ranking por período (métricas por deputado)
- `profile-details.json` — Detalhes por deputado (gastos, proposições, votações públicas)
- `public-value-classification-pending.json` — Proposições sem classificação
- `public-vote-classification-pending.json` — Votações sem classificação
- `banner-metadata.json` — Metadados para o banner (cobertura, progresso IA)

**Requer 12GB de RAM** (`NODE_OPTIONS=--max-old-space-size=12288`).

#### 3. Classify (`data:classify`)

Classifica proposições e votações que não foram classificadas por regras regex. Usa LLMs (Gemini, OpenAI/DeepSeek, Ollama, LM Studio) para categorizar cada item. Pode levar horas dependendo do volume.

Duas modalidades:
- **Básico** — Usa só o resumo da proposição/votação
- **Avançado** — Baixa o texto completo (PDF/HTML) antes de classificar

#### 4. Apply (`data:apply`)

Re-aplica as regras de classificação (regex + revisadas) nos dados já processados, sem re-download ou re-processamento de CSVs. Atualiza:

- Pontuações de valor público das proposições
- Pontuações de valor público das votações
- Métricas no ranking
- Lista de pendentes
- Banner metadata

### Fluxo Típico

```bash
# Primeira vez: baixar e processar tudo
npm run data:sync

# Depois de classificar proposições com IA
npm run data:apply

# Novo mês: baixar dados atualizados
npm run data:fetch
npm run data:process

# Re-aplicar classificações sem re-processar
npm run data:apply

# Forçar re-download completo
npm run data:sync -- --fresh

# Classificar itens pendentes com IA
npm run data:classify
```

### Dados de Entrada

Os dados vêm de APIs públicas:

| Fonte | URL | Dados |
|-------|-----|-------|
| Câmara dos Deputados | `dadosabertos.camara.leg.br` | Deputados, votações, proposições, gastos |
| TSE | `cdn.tse.jus.br` | Candidatos, bens, votos, campanha |
| Transferegov | `repositorio.dados.gov.br` | Emendas parlamentares |

### Arquivos de Saída

Todos em `src/data/`:

| Arquivo | Descrição |
|---------|-----------|
| `ranking-snapshot.json` | Ranking completo por período |
| `profile-details.json` | Detalhes por deputado |
| `public-value-classifications.json` | Classificações revisadas (manual/IA) |
| `public-vote-classifications.json` | Classificações de votações revisadas |
| `public-value-classification-pending.json` | Proposições pendentes de classificação |
| `public-vote-classification-pending.json` | Votações pendentes de classificação |
| `banner-metadata.json` | Metadados do banner |

### Sistema de Classificação de Valor Público

Cada proposição é classificada em duas camadas:

1. **Revisadas** (`public-value-classifications.json`) — Maior prioridade, inclui classificações manuais e de IA
2. **Regras regex** (`classifyProposal()`) — Pattern matching para casos óbvios (homenagens, datas comemorativas, etc.)
3. **Pendente** — Itens não classificados por nenhuma camada, candidatos para classificação por IA

### Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **CSV Parse** para processamento de dados
- **tsx** para scripts TypeScript