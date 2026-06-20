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

A aplicação lê dados diretamente do CockroachDB/Postgres. Classificações e métricas também
são gravadas diretamente no banco.

Para entender o caminho completo dos dados, da ingestão nas fontes públicas até
o banco e os níveis de classificação, veja
[`DATA_PIPELINE.md`](./DATA_PIPELINE.md).

### Ingestão direta para o banco

Use `data:db:ingest` quando precisar carregar um CSV/ZIP diretamente para
uma tabela de staging ou destino:

```bash
npm run data:db:ingest -- --file dados.csv --table staging_table
npm run data:db:ingest -- --file dados.zip --zip-entry arquivo.csv --table staging_table
```

Variáveis exigidas:

- `DATABASE_URL`

### Classificação de valor público

Use regex nível 1 para classificar casos óbvios diretamente no banco:

```bash
npm run data:regex
```

Use o wizard de IA para nível 2 ou 3:

```bash
npm run data:classify
```

O wizard permite escolher votações, proposições ou ambos; nível 2 com resumo ou
nível 3 com inteiro teor; provedor/modelo; limite; e escopo de reprocessamento.
Os resultados são gravados em `proposal_classifications`,
`vote_classifications`, `legislator_votes` e `legislator_period_metrics`.

Chaves opcionais para IA:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

### Fontes

Os dados vêm de APIs públicas:

| Fonte | URL | Dados |
|-------|-----|-------|
| Câmara dos Deputados | `dadosabertos.camara.leg.br` | Deputados, votações, proposições, gastos |
| TSE | `cdn.tse.jus.br` | Candidatos, bens, votos, campanha |
| Transferegov | `repositorio.dados.gov.br` | Emendas parlamentares |

### Sistema de Classificação de Valor Público

As classificações ficam em tabelas do banco e respeitam níveis:

1. **Nível 3** — IA com inteiro teor.
2. **Nível 2** — IA com resumo/descrição.
3. **Nível 1** — Regras determinísticas para casos óbvios.
4. **Pendente** — Itens ainda não classificados.

### Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **CSV Parse** para processamento de dados
- **tsx** para scripts TypeScript
