import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import {
  loadConfig,
  saveConfig,
  interactiveSelect,
  getProvider,
} from "./providers";
import type { AnalysisMode } from "./providers";
import {
  getFullTextForVote,
  detectContextLimit,
  estimateTokens,
  formatEta,
  formatCompletionDate,
} from "./analyzer";
import type { FullTextResult } from "./analyzer";

const pendingPath = join(process.cwd(), ".data/public-vote-classification-pending.json");
const classificationsPath = join(process.cwd(), ".data/public-vote-classifications.json");

interface PendingVote {
  id: string;
  date: string;
  description: string;
  summary: string;
  url: string;
}

interface PendingFile {
  generatedAt: string;
  methodologyVersion: string;
  total: number;
  votes: PendingVote[];
}

interface VoteClassification {
  classification: "positive_public_interest" | "neutral" | "low_relevance" | "negative_public_interest" | "harmful_or_self_serving";
  severity: "low" | "medium" | "high" | "critical";
  publicInterestVote: "yes" | "no" | "any" | "none";
  confidence: number;
  reason: string;
  source?: string;
  analysisLevel?: number;
}

interface ClassificationsFile {
  version: number;
  methodologyVersion: string;
  reviewedAt: string;
  classifications: Record<string, VoteClassification>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function interactiveMode(config: Awaited<ReturnType<typeof loadConfig>>): Promise<AnalysisMode> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const defaultMode = config.lastMode === "advanced" ? "2" : "1";
  console.log(`\nModo de análise:`);
  console.log(`  1) Básico (atual) — usa só description + summary`);
  console.log(`  2) Avançado — baixa texto completo da proposição (PDF/HTML via Câmara)`);
  const choice = (await rl.question(`Escolha o modo [${defaultMode}]: `)).trim() || defaultMode;
  rl.close();
  return choice === "2" ? "advanced" : "basic";
}

function buildPrompt(
  vote: PendingVote,
  mode: AnalysisMode,
  fullTextResult?: FullTextResult,
): string {
  const segments: string[] = [INSTRUCTION, voteSummary(vote), CLASSIFICATION_CRITERIA, JSON_FORMAT];
  if (mode === "advanced" && fullTextResult) {
    segments.splice(1, 0, `\nTEXTO COMPLETO DA PROPOSIÇÃO:\n${fullTextResult.text}\n`);
  }
  return segments.join("\n");
}

const INSTRUCTION = `Você é um analista político sênior especializado no processo legislativo brasileiro.
Classifique a seguinte votação realizada na Câmara dos Deputados de acordo com o impacto público e interesse social.`;

function voteSummary(vote: PendingVote): string {
  return `DADOS DA VOTAÇÃO:
ID da Votação: ${vote.id}
Data da Votação: ${vote.date}
Descrição Oficial: ${vote.description}
Resumo da Proposição associada: ${vote.summary}`;
}

const CLASSIFICATION_CRITERIA = `CRITÉRIOS DE CLASSIFICAÇÃO (field "classification"):
- "positive_public_interest": Promove transparência governamental, combate à corrupção, eficiência de gastos públicos, ou traz melhorias estruturais claras para a sociedade (saúde, educação, segurança) sem privilégios setoriais.
- "negative_public_interest": Reduz transparência, enfraquece a fiscalização e integridade, aumenta gastos supérfluos públicos ou cria privilégios setoriais prejudiciais ao cidadão comum.
- "harmful_or_self_serving": Beneficia diretamente os próprios políticos, partidos ou a classe política (aumento de salários de políticos, aumento da cota parlamentar, verba de gabinete, fundos partidários/eleitorais).
- "low_relevance": Votos de homenagem, denominação de bens públicos (prédios, rodovias), datas comemorativas, moções de pesar/louvor e atos simbólicos de baixo impacto prático.
- "neutral": Temas muito específicos, burocracias internas, ajustes operacionais ou temas técnicos sem viés claro de impacto sobre o interesse público amplo.

VOTO DE INTERESSE PÚBLICO RECOMENDADO (field "publicInterestVote"):
- "yes": Se a atitude favorável ao interesse público é votar "SIM" (ex: aprovar combate à corrupção ou transparência).
- "no": Se a atitude favorável ao interesse público é votar "NÃO" (ex: rejeitar o aumento de salários de parlamentares, votar NÃO na concessão de privilégios).
- "any": Para votações em que tanto SIM quanto NÃO são aceitáveis do ponto de vista de interesse público.
- "none": Para votações de relevância muito baixa (ex: homenagens) ou puramente procedimentais neutras.

GRAVIDADE / SEVERIDADE (field "severity"):
- "critical": Alteração na Constituição (PEC), grandes reformas estruturais, aumento de salários de parlamentares ou impacto fiscal/democrático massivo.
- "high": Leis federais importantes, novos marcos regulatórios de alto impacto social.
- "medium": Alterações menores de leis, temas de impacto regulatório específico ou local.
- "low": Homenagens, datas comemorativas ou ajustes simbólicos de relevância reduzida.`;

const JSON_FORMAT = `Você deve responder APENAS com um objeto JSON válido contendo exatamente a estrutura abaixo:
{
  "classification": "positive_public_interest" | "neutral" | "low_relevance" | "negative_public_interest" | "harmful_or_self_serving",
  "severity": "low" | "medium" | "high" | "critical",
  "publicInterestVote": "yes" | "no" | "any" | "none",
  "confidence": 0.0 a 1.0,
  "reason": "Explicação curta em português justificando por que foi classificado assim e a escolha do publicInterestVote recomendado."
}`;

async function main() {
  const config = await loadConfig();

  const argsProvider = process.argv.find((a) => a.startsWith("--provider="));
  const argsModel = process.argv.find((a) => a.startsWith("--model="));
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

  let providerId = argsProvider?.split("=")[1];
  let model = argsModel?.split("=")[1];

  if (providerId && model) {
    const providerConfig = config.providers[providerId as keyof typeof config.providers];
    const provider = getProvider(providerId as any, providerConfig);
    console.log(`Usando provedor: ${provider.name} | Modelo: ${model}`);
    const mode = await interactiveMode(config);
    await classifyVotes(provider, model, limit, config, mode);
  } else {
    const selection = await interactiveSelect(config, "classificar");
    const mode = await interactiveMode(config);
    await classifyVotes(selection.provider, selection.model, limit, config, mode);
  }
}

export async function classifyVotes(
  provider: ReturnType<typeof getProvider>,
  model: string,
  limit: number,
  config: Awaited<ReturnType<typeof loadConfig>>,
  mode: AnalysisMode,
  processAll: boolean = false,
) {
  config.lastProvider = provider.id;
  config.lastModel = model;
  config.lastMode = mode;
  await saveConfig(config);

  let pendingData: PendingFile;
  let classificationsData: ClassificationsFile;

  try {
    pendingData = JSON.parse(await readFile(pendingPath, "utf8")) as PendingFile;
  } catch (err) {
    console.error(`Erro ao ler arquivo de pendências em ${pendingPath}:`, err);
    process.exit(1);
  }

  try {
    classificationsData = JSON.parse(await readFile(classificationsPath, "utf8")) as ClassificationsFile;
  } catch (err) {
    console.error(`Erro ao ler arquivo de classificações em ${classificationsPath}:`, err);
    process.exit(1);
  }

  const pendingVotes = processAll
    ? pendingData.votes
    : pendingData.votes.filter(
        (vote) => !classificationsData.classifications[vote.id],
      );

  const totalLabel = processAll
    ? `Todas as votações no arquivo: ${pendingVotes.length}`
    : `Votações pendentes totais: ${pendingVotes.length}`;
  console.log(totalLabel);
  if (pendingVotes.length === 0) {
    console.log("\x1b[32mNenhuma votação encontrada para classificação!\x1b[0m");
    return;
  }

  if (processAll) {
    console.log(`  \x1b[33m⚠ Modo "todas": classificações existentes serão sobrescritas\x1b[0m`);
  }

  const toProcess = limit > 0 ? pendingVotes.slice(0, limit) : pendingVotes;
  const label = limit > 0 ? `lote de ${toProcess.length}` : `todas as ${toProcess.length}`;
  const modeLabel = mode === "advanced" ? "avançado" : "básico";
  console.log(`Processando \x1b[33m${label}\x1b[0m votações em modo \x1b[36m${modeLabel}\x1b[0m\n`);

  const contextLimit = detectContextLimit(model);
  const basePromptTokens = estimateTokens(buildPrompt(pendingVotes[0], "basic"));
  if (mode === "advanced") {
    console.log(`  Contexto do modelo: \x1b[33m~${(contextLimit / 1000).toFixed(0)}K tokens\x1b[0m`);
  }

  let count = 0;
  let countError = 0;
  let sumElapsed = 0;
  let countElapsed = 0;
  const recentTimes: number[] = [];
  const WINDOW = 10;

  for (let i = 0; i < toProcess.length; i++) {
    const vote = toProcess[i];
    const remaining = toProcess.length - i - 1;

    console.log(`\x1b[36m▸ [${i + 1}/${toProcess.length}] Faltam ${remaining}\x1b[0m`);

    if (i > 0) {
      const avgTime = recentTimes.length > 0
        ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length
        : 0;
      const etaMs = avgTime * remaining * 1000;
      const etaStr = formatEta(etaMs);
      const completionStr = formatCompletionDate(etaMs);
      console.log(`  ⏱  Média: ${avgTime.toFixed(1)}s/voto | Previsão: ${etaStr} (${completionStr})`);
    }

    const desc = vote.description.substring(0, 70);
    console.log(`  ${desc}`);

    // --- Obter texto completo (modo avançado) ---
    let fullTextResult: FullTextResult | undefined;
    if (mode === "advanced") {
      const startFetch = performance.now();
      try {
        const result = await getFullTextForVote(vote.id);
        const fetchElapsed = ((performance.now() - startFetch) / 1000).toFixed(1);
        if (result) {
          fullTextResult = result;
          const cacheIcon = result.fromCache ? "\x1b[36m📦 cache\x1b[0m" : "\x1b[33m🌐 baixado\x1b[0m";
          const fileSize = result.fileSize > 0
            ? result.fileSize >= 1_048_576
              ? `${(result.fileSize / 1_048_576).toFixed(1)} MB`
              : `${(result.fileSize / 1024).toFixed(1)} KB`
            : "?";
          const idLabel = `#${result.proposicaoId}`;
          const wordLabel = `${result.wordCount} palavras`;
          const charLabel = `${result.charCount.toLocaleString("pt-BR")} caracteres`;
          const tokenLabel = `~${result.tokenEstimate} tokens`;
          console.log(`  \x1b[90m[analyzer] ${idLabel} | ${result.format.toUpperCase()} | ${fileSize} | ${wordLabel} | ${charLabel} | ${tokenLabel} | ${cacheIcon} (${fetchElapsed}s)\x1b[0m`);
        } else {
          console.log(`  \x1b[33m[analyzer] Nenhuma proposição encontrada para esta votação (${fetchElapsed}s)\x1b[0m`);
        }
      } catch (err: any) {
        const fetchElapsed = ((performance.now() - startFetch) / 1000).toFixed(1);
        console.log(`  \x1b[33m[analyzer] Falha: ${err.message?.substring(0, 80) || "erro"} (${fetchElapsed}s)\x1b[0m`);
      }
    }

    // --- Montar prompt ---
    const promptMemo = buildPrompt(vote, mode, fullTextResult);

    // --- Verificar/truncar contexto ---
    let prompt = promptMemo;
    const totalTokens = estimateTokens(prompt);
    if (totalTokens > contextLimit * 0.8) {
      const maxChars = Math.floor(contextLimit * 0.75 * 4);
      prompt = promptMemo.slice(0, maxChars) + "\n\n[... TEXTO TRUNCADO por limite de contexto ...]";
      console.log(`  \x1b[33m⚠ Prompt ~${totalTokens} tokens (limite ${contextLimit}), truncado para ~${(contextLimit * 0.75).toFixed(0)}K tokens\x1b[0m`);
    }

    // --- Enviar para o LLM ---
    const startLlm = performance.now();
    try {
      const textResult = await provider.generateContent(prompt, {
        model,
        temperature: 0.1,
        responseMimeType: "application/json",
      });

      const elapsed = (performance.now() - startLlm) / 1000;
      const elapsedStr = `${elapsed.toFixed(1)}s`.padStart(7);

      const cleaned = textResult.replace(/```json\s*|\s*```/g, "").trim();
      const parsedResult = JSON.parse(cleaned) as VoteClassification;

      const validClassifications = ["positive_public_interest", "neutral", "low_relevance", "negative_public_interest", "harmful_or_self_serving"];
      const validSeverities = ["low", "medium", "high", "critical"];
      const validVotes = ["yes", "no", "any", "none"];

      if (!validClassifications.includes(parsedResult.classification)) {
        throw new Error(`classificação inválida retornada pelo modelo: ${parsedResult.classification}`);
      }
      if (!validSeverities.includes(parsedResult.severity)) {
        throw new Error(`severidade inválida retornada pelo modelo: ${parsedResult.severity}`);
      }
      if (!validVotes.includes(parsedResult.publicInterestVote)) {
        throw new Error(`publicInterestVote inválido retornado pelo modelo: ${parsedResult.publicInterestVote}`);
      }

      classificationsData.classifications[vote.id] = {
        classification: parsedResult.classification,
        severity: parsedResult.severity,
        publicInterestVote: parsedResult.publicInterestVote,
        confidence: parsedResult.confidence || 0.8,
        reason: parsedResult.reason || "Classificado via IA.",
        source: "llm",
        analysisLevel: mode === "advanced" ? 3 : 2,
      };

      await writeFile(classificationsPath, `${JSON.stringify(classificationsData, null, 2)}\n`);
      count++;

      recentTimes.push(elapsed);
      if (recentTimes.length > WINDOW) recentTimes.shift();
      sumElapsed += elapsed;
      countElapsed++;

      console.log(`  ${elapsedStr}  \x1b[32m✓\x1b[0m ${parsedResult.classification}`);
      console.log(`  ID: ${vote.id} | Voto: ${parsedResult.publicInterestVote} | Severidade: ${parsedResult.severity}`);
      console.log(`  ${parsedResult.reason}\n`);

    } catch (err: any) {
      const elapsed = (performance.now() - startLlm) / 1000;
      const elapsedStr = `${elapsed.toFixed(1)}s`.padStart(7);
      console.log(`  ${elapsedStr}  \x1b[31m✗\x1b[0m ${err.message?.substring(0, 100) || "erro"}`);
      countError++;
      console.log("");
    }

    if (i < toProcess.length - 1) {
      const delay = mode === "advanced" ? 3000 : 2000;
      await sleep(delay);
    }
  }

  const totalTime = sumElapsed.toFixed(0);
  const elapsedSuffix = countElapsed > 0 ? ` (média ${(sumElapsed / countElapsed).toFixed(1)}s/voto)` : "";
  console.log(`\x1b[32mConcluído! ${count} sucesso, ${countError} erro(s) em ${toProcess.length} votações${elapsedSuffix}\x1b[0m`);
  console.log(`Tempo total de LLM: ~${formatEta(Number(totalTime) * 1000)}`);
  console.log(`Caminho atualizado: ${classificationsPath}`);
  console.log("\nPara recalcular o score dos deputados no ranking e perfis, execute:");
  console.log("  \x1b[33mnpm run data:sync\x1b[0m\n");
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  main().catch((error) => {
    console.error("Erro fatal durante o processamento:", error);
    process.exitCode = 1;
  });
}
