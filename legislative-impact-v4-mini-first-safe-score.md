# legislative-impact-v4-mini-first-safe-score

Esta e a metodologia de classificacao segura usada para votacoes legislativas
quando o fluxo roda com IA em nivel 3. Ela foi criada para evitar que o modelo
mini aplique bonus ou penalidade no score quando a votacao nao esta clara o
suficiente.

## Objetivo

O metodo tenta responder seis perguntas antes de deixar uma votacao afetar o
score:

1. Qual era o objeto real da votacao?
2. O que o voto SIM fazia na pratica?
3. O que o voto NAO fazia na pratica?
4. O efeito publico era positivo, negativo, misto, neutro ou incerto?
5. O texto analisado corresponde ao objeto realmente votado?
6. Existe seguranca suficiente para pontuar o parlamentar?

Se qualquer parte essencial ficar ambigua, a votacao pode ser registrada como
analisada, mas sem impacto no score.

## Por que "mini-first-safe-score"

O primeiro passo usa um modelo mini como triagem economica. Por isso, o metodo
tem limites conservadores:

- nao julga ideologia, governo, oposicao ou intencao presumida;
- nao confunde projeto principal com emenda, destaque, substitutivo ou
  requerimento;
- trata urgencia, retirada de pauta, adiamento, recurso e destaque como objetos
  especificos ou procedimentais;
- bloqueia pontuacao quando o texto do objeto votado nao aparece;
- marca revisao avancada quando existe risco de escopo, excecao escondida,
  jabuti, impacto fiscal relevante ou efeito misto;
- exige impacto claro, objeto claro e confianca alta para aplicar pontos.

## Entradas

O classificador usa dados oficiais ja coletados:

- ID da votacao;
- data;
- descricao oficial da votacao;
- resumo da proposicao associada;
- tipo legislativo inferido;
- tipo do objeto votado;
- subtipo do objeto votado;
- texto do objeto votado, quando encontrado;
- texto relacionado, quando o objeto especifico nao esta disponivel.

Texto relacionado serve como contexto. Ele nao deve substituir o texto do objeto
votado quando a decisao depende de emenda, destaque, substitutivo ou outro
recorte especifico.

## Saidas

A analise gera campos de auditoria e decisao:

| Campo | Papel |
| --- | --- |
| `analysisMethodVersion` | identifica esta metodologia |
| `modelRole` | indica se o modelo atuou como triagem |
| `classification` | classifica o efeito publico geral |
| `publicInterestVote` | indica se o interesse publico estava no sim, no nao, em qualquer voto, em nenhum ou se ficou indeterminado |
| `voteObjectType` | informa se era projeto principal, emenda, destaque, urgencia, procedimento etc. |
| `yesMeans` / `noMeans` | explica o efeito pratico de cada voto |
| `netPublicEffect` | resume o efeito liquido: positivo, negativo, misto, neutro, incerto ou insuficiente |
| `needsStrongReview` | marca casos que nao devem ser decididos so pelo mini |
| `analysisStatus` | informa se foi validado, neutralizado, ficou pendente ou sem dados |
| `affectsScore` | diz se a votacao entra no score |
| `scorePoints` | guarda a pontuacao aplicada ou `null` quando nao deve pontuar |
| `coverageCategory` | separa votacoes pontuadas, neutras, pendentes, insuficientes ou inelegiveis |
| `scoreSafetyReason` | explica por que o score foi aplicado, zerado ou bloqueado |

## Regras de seguranca

Uma votacao nao deve afetar score quando:

- precisa de revisao forte;
- o voto de interesse publico ficou indeterminado;
- o texto analisado nao bate com o objeto votado;
- o objeto e emenda, destaque, substitutivo ou votacao separada sem texto
  especifico;
- o efeito liquido e misto ou insuficiente;
- ha risco de escopo, jabuti, excecao escondida, privilegio setorial ou impacto
  fiscal sem evidencia suficiente;
- a confianca fica abaixo do minimo exigido.

Votacoes neutras, simbolicas ou procedimentais podem contar como analisadas,
mas normalmente ficam sem impacto positivo ou negativo no score.

## Como a decisao vira score

Depois da analise, o projeto compara o voto individual do parlamentar com a
direcao de interesse publico:

```text
analise da votacao
  -> direcao de interesse publico
  -> voto individual do parlamentar
  -> decisao segura de pontuacao
  -> agregacao no periodo
```

Se a direcao for clara e o voto estiver alinhado, pode haver bonus. Se a direcao
for clara e o voto estiver desalinhado, pode haver penalidade. Se a direcao nao
for clara, a votacao fica pendente ou neutra.

O score final ainda passa por limitadores: impacto maximo por modelo, limite por
confianca, limite por tipo de objeto e limite para votacoes procedimentais.

## Onde aparece no produto

Os resultados desta metodologia aparecem principalmente em:

- tabelas de votacoes no perfil do candidato;
- impacto de Valor Publico;
- motivos de pendencia ou neutralizacao;
- campos de auditoria tecnica;
- cobertura publica de dados analisados.

O ponto mais importante: uma votacao pode estar analisada e, ainda assim, nao
entrar no score. Isso e intencional quando a evidencia nao permite uma
pontuacao segura.
