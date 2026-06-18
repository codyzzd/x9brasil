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

## Dados

A aplicação lê dados diretamente do Supabase. Os snapshots JSON locais em
`src/data/` foram removidos e não fazem parte do fluxo de runtime.

Para entender o caminho completo dos dados, da ingestão nas fontes públicas até
o Supabase e os níveis de classificação, veja
[`DATA_PIPELINE.md`](./DATA_PIPELINE.md).

### Ingestão direta para Supabase

Use `data:supabase:ingest` quando precisar carregar um CSV/ZIP diretamente para
uma tabela de staging ou destino:

```bash
npm run data:supabase:ingest -- --file dados.csv --table staging_table
npm run data:supabase:ingest -- --file dados.zip --zip-entry arquivo.csv --table staging_table
```

Variáveis exigidas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Fontes

Os dados vêm de APIs públicas:

| Fonte | URL | Dados |
|-------|-----|-------|
| Câmara dos Deputados | `dadosabertos.camara.leg.br` | Deputados, votações, proposições, gastos |
| TSE | `cdn.tse.jus.br` | Candidatos, bens, votos, campanha |
| Transferegov | `repositorio.dados.gov.br` | Emendas parlamentares |

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
