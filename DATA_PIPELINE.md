# Pipeline de dados e classificacoes

Este documento explica como os dados saem das fontes publicas do governo,
entram no banco Supabase e como o sistema classifica proposicoes e votacoes.

## Visao geral

O runtime da aplicacao le dados do Supabase. A tela do site nao depende de
arquivos JSON locais para funcionar.

O fluxo operacional atual tem dois caminhos:

1. Ingestao direta para Supabase, usada para carregar CSV/ZIP em tabelas do
   banco.
2. Scripts legados que ainda podem gerar arquivos em `.data/` e publicar esses
   dados no Supabase.

A direcao correta para novas rotinas e usar Supabase como fonte operacional.
O comando de regex nivel 1 ja segue esse modelo.

## Fontes externas

As fontes principais sao:

| Fonte | Host | Dados usados |
| --- | --- | --- |
| Camara dos Deputados | `dadosabertos.camara.leg.br` | Deputados, proposicoes, votacoes, presenca, gastos parlamentares |
| TSE | `cdn.tse.jus.br` | Candidatos, bens, votos eleitorais, receitas e despesas de campanha |
| Transferegov / dados.gov.br | `repositorio.dados.gov.br` | Emendas parlamentares |

Essas fontes entregam dados por API, CSV ou ZIP com CSV.

## Como os dados chegam ao Supabase

### Ingestao direta

O comando principal para carregar arquivo direto no banco e:

```bash
npm run data:supabase:ingest -- --file dados.csv --table nome_da_tabela
npm run data:supabase:ingest -- --file dados.zip --zip-entry arquivo.csv --table nome_da_tabela
```

Arquivo responsavel:

- `scripts/supabase-ingest.ts`

O que ele faz:

- abre CSV ou ZIP;
- parseia as linhas;
- normaliza campos vazios para `null`;
- grava em lotes no Supabase;
- usa `insert` ou `upsert` quando recebe `--on-conflict`.

Esse comando nao classifica proposicoes nem votacoes. Ele so carrega dados para
tabelas do banco.

### Publicacao legada via `.data`

Ainda existem scripts que trabalham com arquivos locais em `.data/`, por
exemplo:

- `.data/ranking-snapshot.json`
- `.data/profile-details.json`
- `.data/public-value-classifications.json`
- `.data/public-vote-classifications.json`

O script `scripts/sync-to-supabase.ts` le esses arquivos e distribui os dados em
varias tabelas do Supabase. Esse caminho ainda existe, mas nao e o modelo ideal
para novas rotinas.

## Para quais tabelas os dados vao

O banco nao recebe "um arquivo unico". Os dados sao quebrados em varias tabelas
normalizadas.

Principais tabelas:

| Tabela | Conteudo |
| --- | --- |
| `legislators` | Identidade basica dos parlamentares |
| `legislator_details` | Dados pessoais e detalhes complementares |
| `legislator_assets` | Bens declarados |
| `legislator_staff` | Servidores vinculados ao parlamentar |
| `periods` | Periodos de ranking, como ano e legislatura |
| `legislator_period_metrics` | Metricas agregadas por parlamentar e periodo |
| `proposals` | Proposicoes globais |
| `legislator_proposals` | Relacao parlamentar-proposicao-periodo |
| `proposal_classifications` | Classificacao de valor publico das proposicoes |
| `votes` | Votacoes globais |
| `vote_classifications` | Classificacao de valor publico das votacoes |
| `legislator_votes` | Voto de cada parlamentar e pontuacao calculada |
| `legislator_amendments` | Emendas parlamentares |
| `sources` | Fontes usadas no snapshot |
| `snapshot_metadata` | Metadados gerais do processamento |

Isso significa que uma ingestao completa pode terminar gravando em muitas
tabelas. A aplicacao depois remonta essas informacoes a partir do Supabase.

## Classificacoes

Existem duas familias de classificacao:

1. Proposicoes: classificam o tema e valor publico da proposicao.
2. Votacoes: classificam o impacto publico da votacao e qual voto era alinhado
   ao interesse publico.

As tabelas principais sao:

- `proposal_classifications`
- `vote_classifications`

Elas guardam, entre outros campos:

| Campo | Significado |
| --- | --- |
| `source` | Origem da classificacao: `rule`, `llm` ou `reviewed` |
| `analysis_level` | Nivel da analise: 1, 2 ou 3 |
| `methodology_version` | Versao da metodologia usada |
| `confidence` | Confianca da classificacao |
| `updated_at` | Ultima atualizacao do registro |

## Niveis de analise

### Nivel 1: regex automatico

Status: ativo.

O nivel 1 usa regras deterministicas em codigo. Ele nao chama IA.

Arquivos principais:

- `src/lib/public-value.ts`
- `scripts/apply-regex-supabase.ts`

Comando:

```bash
npm run data:regex
```

O que o comando faz:

- le `proposals` e `votes` diretamente do Supabase;
- aplica `classifyProposal(...)` para proposicoes;
- aplica `classifyPublicVote(...)` para votacoes;
- grava resultados em `proposal_classifications` e `vote_classifications`;
- marca `source = 'rule'`;
- marca `analysis_level = 1`;
- recalcula metricas afetadas em `legislator_period_metrics`;
- atualiza pontuacao de votos em `legislator_votes`.

Regra de protecao:

- nivel 1 so pode criar ou recalcular classificacoes de nivel 1;
- se ja existir nivel 2 ou nivel 3 para o mesmo item, o regex ignora;
- isso impede que uma classificacao melhor seja substituida por regex.

### Nivel 2: IA por snippet/resumo

Status: em teste.

O nivel 2 usa IA com o texto curto disponivel:

- ementa da proposicao;
- descricao da votacao;
- resumo ou objeto associado.

Ele nao baixa o teor integral do projeto.

Arquivos principais:

- `scripts/classify-proposals-llm.ts`
- `scripts/classify-votes-llm.ts`
- `scripts/classify.ts`

Quando usado em modo basico, o classificador grava:

- `source = 'llm'`;
- `analysis_level = 2`.

Regra esperada:

- nivel 2 pode substituir nivel 1;
- nivel 2 nao deve substituir nivel 3.

### Nivel 3: IA por teor integral

Status: em teste.

O nivel 3 usa IA com texto integral quando disponivel. Para isso, o sistema
busca a proposicao relacionada, baixa PDF/HTML/texto da Camara e extrai o texto.

Arquivo principal de apoio:

- `scripts/analyzer.ts`

Quando usado em modo avancado, o classificador grava:

- `source = 'llm'`;
- `analysis_level = 3`.

Regra esperada:

- nivel 3 e a analise automatizada mais forte;
- nivel 1 e nivel 2 nao devem substituir nivel 3.

## Ordem de prioridade

A prioridade correta e:

1. Nivel 3: IA por teor integral.
2. Nivel 2: IA por snippet/resumo.
3. Nivel 1: regex automatico.
4. Sem classificacao: pendente.

Na pratica:

- se so existe regex, o sistema usa regex;
- se depois for feita IA nivel 2, ela pode substituir o regex;
- se depois for feita IA nivel 3, ela pode substituir nivel 2;
- se o sync ou regex rodar de novo, ele nao deve derrubar nivel 2 ou 3.

## Como o ranking usa as classificacoes

Proposicoes:

- a classificacao fica em `proposal_classifications`;
- a relacao com parlamentar fica em `legislator_proposals`;
- a metrica agregada entra em `legislator_period_metrics.public_contribution_points`;
- tambem atualiza `public_classified_proposals` e `public_total_proposals`.

Votacoes:

- a classificacao global da votacao fica em `vote_classifications`;
- cada parlamentar tem seu voto em `legislator_votes`;
- o alinhamento do voto gera `score_delta`;
- os agregados entram em:
  - `public_vote_positive_points`;
  - `public_vote_negative_penalties`;
  - `public_vote_absence_penalties`;
  - `public_votes_analyzed`;
  - `public_vote_average_confidence`;
  - `public_vote_score`.

## Quando rodar cada coisa

### Chegaram dados novos do governo

1. Ingerir ou sincronizar os dados para o Supabase.
2. Rodar `npm run data:regex` para aplicar nivel 1 nos itens novos.
3. Rodar nivel 2 ou 3 somente se quiser classificar pendencias por IA.

### Quero reprocessar regex sem baixar tudo de novo

Use:

```bash
npm run data:regex
```

Esse comando trabalha direto no Supabase. Ele nao baixa novamente os arquivos do
governo.

### Quero melhorar classificacoes ja existentes

Use os classificadores de IA em modo basico ou avancado. Eles estao em teste.
Depois, a classificacao precisa ser sincronizada para o Supabase respeitando
`analysis_level`.

## Resumo mental

O fluxo ideal e:

```text
APIs/CSVs/ZIPs do governo
  -> scripts de ingestao/processamento
  -> tabelas Supabase normalizadas
  -> classificacao nivel 1/2/3
  -> metricas agregadas por parlamentar e periodo
  -> site le Supabase
```

O ponto mais importante: classificacao nao e um arquivo unico. Ela vira linhas
em tabelas especificas, e cada linha tem um nivel para impedir que uma analise
mais simples substitua uma analise melhor.
