# Pipeline de dados e classificacoes

Este documento descreve o fluxo operacional atual: os dados entram no banco SQL
CockroachDB/Postgres, as classificacoes sao gravadas no banco e o site le esse banco. Arquivos
locais podem existir apenas como cache tecnico de download, nunca como fonte de
verdade de classificacao ou score.

## Visao geral

O pipeline tem tres comandos principais:

```bash
npm run data:supabase:ingest
npm run data:regex
npm run data:classify
```

- `data:db:ingest` carrega CSV/ZIP em tabelas do banco.
- `data:supabase:ingest` ainda existe como alias de compatibilidade.
- `data:regex` aplica classificacao nivel 1 por regra deterministica.
- `data:classify` roda IA nivel 2 ou 3 por wizard e grava direto no banco.

Variaveis exigidas para escrita no banco:

- `DATABASE_URL`
- `DATABASE_POOL_MAX` opcional, padrao `10`

Chaves de IA, quando usadas:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

O wizard tambem pode pedir a chave no terminal para uso apenas na sessao.

## Fontes externas

| Fonte | Host | Dados usados |
| --- | --- | --- |
| Camara dos Deputados | `dadosabertos.camara.leg.br` | Deputados, proposicoes, votacoes, presenca, gastos parlamentares |
| TSE | `cdn.tse.jus.br` | Candidatos, bens, votos eleitorais, receitas e despesas de campanha |
| Transferegov / dados.gov.br | `repositorio.dados.gov.br` | Emendas parlamentares |

## Tabelas principais

| Tabela | Conteudo |
| --- | --- |
| `legislators` | Identidade basica dos parlamentares |
| `legislator_details` | Dados pessoais e detalhes complementares |
| `periods` | Periodos de ranking |
| `legislator_period_metrics` | Metricas agregadas por parlamentar e periodo |
| `proposals` | Proposicoes globais |
| `legislator_proposals` | Relacao parlamentar-proposicao-periodo |
| `proposal_classifications` | Classificacao de valor publico das proposicoes |
| `votes` | Votacoes globais |
| `vote_classifications` | Classificacao de valor publico das votacoes |
| `legislator_votes` | Voto de cada parlamentar e pontuacao calculada |
| `legislator_amendments` | Emendas parlamentares |
| `sources` | Fontes usadas |
| `snapshot_metadata` | Metadados gerais do processamento |

## Niveis de analise

### Nivel 1: regra automatica

```bash
npm run data:regex
```

O comando:

- le `proposals` e `votes` diretamente do banco;
- aplica regras de `src/lib/public-value.ts`;
- grava `source = 'rule'` e `analysis_level = 1`;
- nao substitui classificacoes nivel 2, nivel 3 ou revisadas;
- recalcula metricas afetadas em `legislator_period_metrics`;
- atualiza `legislator_votes` quando a classificacao de voto muda.

### Nivel 2: IA com resumo

```bash
npm run data:classify
```

No wizard, escolha `Nível 2 · IA com resumo`.

O comando:

- usa ementa, descricao e resumo ja salvos no banco;
- grava `source = 'llm'` e `analysis_level = 2`;
- pode substituir nivel 1;
- nao substitui nivel 3;
- recalcula metricas no final do lote.

### Nivel 3: IA com inteiro teor

```bash
npm run data:classify
```

No wizard, escolha `Nível 3 · IA com inteiro teor`.

O comando:

- busca o inteiro teor da proposicao pela API da Camara;
- usa cache tecnico em `scripts/.llm-cache` para evitar baixar o mesmo arquivo
  repetidamente;
- grava `source = 'llm'` e `analysis_level = 3`;
- pode substituir nivel 1 e 2;
- pula itens sem inteiro teor disponivel;
- recalcula metricas no final do lote.

## Precedencia

A prioridade correta e:

1. Revisao manual (`source = 'reviewed'`), quando existir.
2. Nivel 3: IA com inteiro teor.
3. Nivel 2: IA com resumo.
4. Nivel 1: regra automatica.
5. Sem classificacao: pendente.

Na operacao automatizada:

- nivel 1 nao derruba nivel 2/3;
- nivel 2 pode melhorar nivel 1, mas nao derruba nivel 3;
- nivel 3 pode melhorar nivel 1/2;
- o modo de sobrescrita do wizard reprocessa apenas o mesmo nivel ou inferior.

## Como o ranking usa as classificacoes

Proposicoes:

- a classificacao fica em `proposal_classifications`;
- a relacao com parlamentar fica em `legislator_proposals`;
- a metrica agregada entra em `legislator_period_metrics.public_contribution_points`;
- tambem atualiza `public_classified_proposals` e `public_total_proposals`.

Votacoes:

- a classificacao global fica em `vote_classifications`;
- cada parlamentar tem seu voto em `legislator_votes`;
- o alinhamento do voto gera `score_delta`;
- os agregados entram em `public_vote_positive_points`,
  `public_vote_negative_penalties`, `public_vote_absence_penalties`,
  `public_votes_analyzed`, `public_vote_average_confidence` e
  `public_vote_score`.

## Fluxo mental

```text
fontes oficiais
  -> tabelas CockroachDB/Postgres
  -> classificacao nivel 1/2/3 no banco
  -> metricas agregadas no banco
  -> site le o banco
```

O ponto central: classificacao e score vivem em tabelas normalizadas do
banco SQL, nao em arquivos intermediarios.
