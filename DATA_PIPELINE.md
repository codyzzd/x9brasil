# Pipeline de dados

Este documento descreve de onde os dados publicos do projeto saem, como eles
sao transformados e onde aparecem depois. A ideia central e separar tres coisas:
fonte oficial, processamento interno e leitura pelo produto.

## Visao geral

```text
fontes oficiais
  -> ingestao e normalizacao
  -> classificacao e calculos derivados
  -> metricas por parlamentar e periodo
  -> ranking, perfil, comparacao, partidos e metodologia publica
```

Arquivos locais podem existir como cache tecnico ou material de auditoria, mas
nao sao a fonte operacional do score exibido no site.

## Fontes de entrada

| Origem | O que entra no projeto | Para que serve depois |
| --- | --- | --- |
| Camara dos Deputados | Deputados, proposicoes, autores, relatorias, votacoes nominais, presencas e despesas parlamentares | ranking, perfil do parlamentar, tabelas de votacoes, producao legislativa, gastos e presenca |
| TSE | Candidaturas, bens declarados, votos eleitorais, receitas e despesas de campanha | contexto eleitoral, patrimonio, financiadores e fornecedores de campanha |
| Transferegov / dados.gov.br | Emendas parlamentares e execucao ligada a transferencias publicas | emendas, valores destinados e contexto orcamentario |
| Regras do projeto | Pesos, criterios de valor publico, limites de pontuacao e regras de seguranca | transforma dado bruto em metricas comparaveis |
| IA, quando acionada | Analise de proposicoes e votacoes com resumo ou inteiro teor | melhora a cobertura de valor publico e decide se uma votacao pode ou nao afetar score |

## Caminho dos dados

1. **Coleta oficial**

   O projeto baixa ou le dados publicados por orgaos oficiais. Nesta etapa, o
   dado ainda e bruto: nomes, IDs, datas, proposicoes, votacoes, despesas,
   emendas e registros eleitorais.

2. **Normalizacao**

   Os dados brutos viram entidades consistentes: parlamentar, periodo,
   proposicao, votacao, voto individual, despesa, emenda, candidatura, doador e
   fornecedor. Essa etapa resolve chaves, formatos e relacoes entre tabelas.

3. **Classificacao**

   Proposicoes e votacoes passam por camadas de analise:

   - regras deterministicas para uma primeira cobertura;
   - IA com resumo quando o texto resumido e suficiente;
   - IA com inteiro teor quando a decisao depende de leitura mais completa;
   - revisao manual, quando existir, sempre como prioridade maxima.

4. **Calculo derivado**

   As classificacoes alimentam metricas por parlamentar e periodo: producao
   legislativa, valor publico de proposicoes, impacto de votacoes, presenca,
   gastos, emendas e dados eleitorais.

5. **Publicacao no produto**

   O site le as metricas ja calculadas e as apresenta em superficies diferentes:
   ranking geral, ranking de Valor Publico, pagina do candidato, comparacao,
   partidos, tabelas detalhadas e pagina de metodologia.

## Comandos operacionais

```bash
npm run data:db:ingest
npm run data:regex
npm run data:classify
```

- `data:db:ingest` importa CSV/ZIP e normaliza dados oficiais.
- `data:regex` aplica a primeira classificacao automatica por regra.
- `data:classify` roda o wizard de IA para nivel 2 ou nivel 3.

## Niveis de analise

| Nivel | Entrada principal | Saida | Quando usar |
| --- | --- | --- | --- |
| Nivel 1 | Ementa, descricao e regras locais | classificacao inicial | cobertura rapida e deterministica |
| Nivel 2 | Resumo ja coletado | classificacao por IA com explicacao curta | quando o resumo basta para entender o impacto |
| Nivel 3 | Inteiro teor ou texto mais completo | classificacao mais cautelosa | quando a votacao ou proposicao exige mais evidencias |
| Revisao manual | Decisao humana auditada | classificacao revisada | quando a maquina nao deve decidir sozinha |

Precedencia:

1. Revisao manual.
2. Nivel 3.
3. Nivel 2.
4. Nivel 1.
5. Pendente.

## Como isso vira score

Proposicoes:

- a classificacao de valor publico identifica a categoria e a relevancia;
- a relacao parlamentar-proposicao define autoria, coautoria, relatoria ou
  participacao;
- o periodo define onde a contribuicao entra;
- o resultado alimenta a dimensao de producao legislativa com valor publico.

Votacoes:

- a classificacao global explica o objeto votado, o que significa votar sim ou
  nao e se existe interesse publico claro;
- cada voto individual e comparado com a direcao de interesse publico;
- casos ambiguos, procedimentais, mistos ou sem texto suficiente ficam
  analisados sem afetar score;
- apenas votacoes com evidencia suficiente entram no impacto de Valor Publico.

Outras dimensoes:

- presenca, despesas, emendas, patrimonio, receitas e despesas eleitorais entram
  como metricas de contexto e comparacao;
- dados ausentes reduzem cobertura, mas nao devem virar penalidade automatica
  sem regra explicita.

## Para onde os dados vao

| Saida | O que mostra |
| --- | --- |
| Ranking | posicao, score e dimensoes comparaveis por periodo |
| Perfil do candidato | detalhes, evolucao anual, votacoes, proposicoes, gastos, emendas e dados eleitorais |
| Comparacao | diferencas entre candidatos nas mesmas dimensoes |
| Partidos | agregacao dos parlamentares elegiveis por partido |
| Metodologia | explicacao publica dos criterios, pesos, cobertura e limites |
| Auditoria interna | classificacoes, motivos, confianca, status de revisao e versao metodologica |

## Contrato importante

O pipeline deve preservar rastreabilidade:

- todo dado exibido precisa ter uma origem reconhecivel;
- toda classificacao automatica precisa indicar nivel, fonte e versao;
- todo score derivado precisa ser recalculavel a partir das metricas-base;
- casos duvidosos devem ficar pendentes ou neutros, nao receber pontuacao
  agressiva por falta de evidencia.
