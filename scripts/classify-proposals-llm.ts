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
  getFullTextForProposal,
  detectContextLimit,
  estimateTokens,
  formatEta,
  formatCompletionDate,
} from "./analyzer";
import type { FullTextResult } from "./analyzer";

const pendingPath = join(process.cwd(), "src/data/public-value-classification-pending.json");
const classificationsPath = join(process.cwd(), "src/data/public-value-classifications.json");

interface PendingProposal {
  id: string;
  type: string;
  number: string;
  year: string;
  date: string;
  summary: string;
  status: string;
  url: string;
}

interface PendingFile {
  generatedAt: string;
  methodologyVersion: string;
  total: number;
  proposals: PendingProposal[];
}

interface ProposalClassification {
  category: string;
  confidence: string;
  justification: string;
}

interface ClassificationsFile {
  version: number;
  methodologyVersion: string;
  reviewedAt: string;
  classifications: Record<string, ProposalClassification>;
}

const VALID_CATEGORIES = [
  "anti_corruption",
  "public_transparency",
  "waste_reduction",
  "health",
  "education",
  "security",
  "infrastructure",
  "jobs_economy",
  "state_modernization",
  "technology_innovation",
  "deregulation",
  "tribute",
  "commemorative_date",
  "motion",
  "place_naming",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  anti_corruption: "Combate à corrupção",
  public_transparency: "Transparência pública",
  waste_reduction: "Redução de desperdício público",
  health: "Saúde",
  education: "Educação",
  security: "Segurança",
  infrastructure: "Infraestrutura",
  jobs_economy: "Emprego e economia",
  state_modernization: "Modernização do Estado",
  technology_innovation: "Tecnologia e inovação",
  deregulation: "Desburocratização",
  tribute: "Homenagem ou título honorífico",
  commemorative_date: "Data comemorativa",
  motion: "Moção",
  place_naming: "Denominação de bem público",
};

const VALID_CONFIDENCES: ClassificationConfidence[] = ["high", "medium", "low"];
type ClassificationConfidence = "high" | "medium" | "low";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function interactiveMode(config: Awaited<ReturnType<typeof loadConfig>>): Promise<AnalysisMode> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const defaultMode = config.lastMode === "advanced" ? "2" : "1";
  console.log(`\nModo de análise:`);
  console.log(`  1) Básico (atual) — usa só ementa + dados da proposição`);
  console.log(`  2) Avançado — baixa texto completo da proposição (PDF/HTML via Câmara)`);
  const choice = (await rl.question(`Escolha o modo [${defaultMode}]: `)).trim() || defaultMode;
  rl.close();
  return choice === "2" ? "advanced" : "basic";
}

const INSTRUCTION = `Você é um analista político sênior especializado no processo legislativo brasileiro.
Classifique a seguinte proposição (projeto de lei, PEC, requerimento, etc.) da Câmara dos Deputados de acordo com seu valor público e interesse social.`;

function proposalSummary(p: PendingProposal): string {
  return `DADOS DA PROPOSIÇÃO:
ID: ${p.id}
Tipo: ${p.type} ${p.number}/${p.year}
Data de Apresentação: ${p.date}
Ementa: ${p.summary}
Situação: ${p.status}`;
}

const CATEGORIES_INSTRUCTION = `CATEGORIAS DE VALOR PÚBLICO (escolha UMA):

Grupo 1 — Alto valor público (peso 8-10):
- "anti_corruption": Combate à corrupção, improbidade administrativa, enriquecimento ilícito, lavagem de dinheiro.
- "public_transparency": Transparência pública, acesso à informação, dados abertos, prestação de contas.
- "waste_reduction": Redução de desperdício, gasto público, despesa pública, economia de recursos.
- "health": Saúde pública, SUS, medicamentos, hospitais, doenças, vacinas.
- "education": Educação, escolas, ensino, universidades, professores, estudantes.
- "security": Segurança pública, polícia, crime, criminalidade, violência, política penal.
- "infrastructure": Infraestrutura, saneamento, rodovias, ferrovias, transporte público, habitação.
- "jobs_economy": Emprego, trabalho, economia, tributos, impostos, empresas, crédito, renda.

Grupo 2 — Valor público médio (peso 6):
- "state_modernization": Modernização da administração pública, serviço público, gestão pública, governo digital.
- "technology_innovation": Tecnologia, inovação, digital, inteligência artificial, software, internet.
- "deregulation": Desburocratização, simplificação, licenciamento, dispensa de autorização.

Grupo 3 — Baixo valor público (peso 1):
- "tribute": Concessão de medalha, título honorífico ou homenagem.
- "commemorative_date": Instituição de dia nacional, semana nacional ou data comemorativa.
- "motion": Moção, voto de louvor/pesar/repúdio.
- "place_naming": Denominação de bem público (aeroporto, rodovia, ponte, prédio).`;

const JSON_FORMAT = `Você deve responder APENAS com um objeto JSON válido contendo exatamente a estrutura abaixo:
{
  "category": "anti_corruption" | "public_transparency" | "waste_reduction" | "health" | "education" | "security" | "infrastructure" | "jobs_economy" | "state_modernization" | "technology_innovation" | "deregulation" | "tribute" | "commemorative_date" | "motion" | "place_naming",
  "confidence": "high" | "medium" | "low",
  "justification": "Explicação curta em português (1 frase) justificando por que esta proposição se enquadra nessa categoria."
}`;

function buildPrompt(
  proposal: PendingProposal,
  mode: AnalysisMode,
  fullTextResult?: FullTextResult,
): string {
  const segments: string[] = [
    INSTRUCTION,
    proposalSummary(proposal),
    CATEGORIES_INSTRUCTION,
    JSON_FORMAT,
  ];
  if (mode === "advanced" && fullTextResult) {
    segments.splice(1, 0, `\nTEXTO COMPLETO DA PROPOSIÇÃO:\n${fullTextResult.text}\n`);
  }
  return segments.join("\n");
}

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
    await classifyProposals(provider, model, limit, config, mode);
  } else {
    const selection = await interactiveSelect(config, "classificar");
    const mode = await interactiveMode(config);
    await classifyProposals(selection.provider, selection.model, limit, config, mode);
  }
}

export async function classifyProposals(
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

  const pendingProposals = processAll
    ? pendingData.proposals
    : pendingData.proposals.filter(
        (p) => !classificationsData.classifications[p.id],
      );

  const totalLabel = processAll
    ? `Todas as proposições no arquivo: ${pendingProposals.length}`
    : `Proposições pendentes totais: ${pendingProposals.length}`;
  console.log(totalLabel);
  if (pendingProposals.length === 0) {
    console.log("\x1b[32mNenhuma proposição encontrada para classificação!\x1b[0m");
    return;
  }

  if (processAll) {
    console.log(`  \x1b[33m⚠ Modo "todas": classificações existentes serão sobrescritas\x1b[0m`);
  }

  const toProcess = limit > 0 ? pendingProposals.slice(0, limit) : pendingProposals;
  const label = limit > 0 ? `lote de ${toProcess.length}` : `todas as ${toProcess.length}`;
  const modeLabel = mode === "advanced" ? "avançado" : "básico";
  console.log(`Processando \x1b[33m${label}\x1b[0m proposições em modo \x1b[36m${modeLabel}\x1b[0m\n`);

  const contextLimit = detectContextLimit(model);
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
    const proposal = toProcess[i];
    const remaining = toProcess.length - i - 1;

    console.log(`\x1b[36m▸ [${i + 1}/${toProcess.length}] Faltam ${remaining}\x1b[0m`);

    if (i > 0) {
      const avgTime = recentTimes.length > 0
        ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length
        : 0;
      const etaMs = avgTime * remaining * 1000;
      const etaStr = formatEta(etaMs);
      const completionStr = formatCompletionDate(etaMs);
      console.log(`  ⏱  Média: ${avgTime.toFixed(1)}s/prop. | Previsão: ${etaStr} (${completionStr})`);
    }

    const label = `${proposal.type} ${proposal.number}/${proposal.year}`;
    const desc = proposal.summary.substring(0, 80);
    console.log(`  ${label}: ${desc}`);

    // --- Obter texto completo (modo avançado) ---
    let fullTextResult: FullTextResult | undefined;
    if (mode === "advanced") {
      const startFetch = performance.now();
      try {
        const proposicaoId = Number(proposal.id);
        const result = await getFullTextForProposal(proposicaoId);
        const fetchElapsed = ((performance.now() - startFetch) / 1000).toFixed(1);
        if (result) {
          fullTextResult = result;
          const cacheIcon = result.fromCache ? "\x1b[36m📦 cache\x1b[0m" : "\x1b[33m🌐 baixado\x1b[0m";
          const fileSize = result.fileSize > 0
            ? result.fileSize >= 1_048_576
              ? `${(result.fileSize / 1_048_576).toFixed(1)} MB`
              : `${(result.fileSize / 1024).toFixed(1)} KB`
            : "?";
          const wordLabel = `${result.wordCount} palavras`;
          const charLabel = `${result.charCount.toLocaleString("pt-BR")} caracteres`;
          const tokenLabel = `~${result.tokenEstimate} tokens`;
          console.log(`  \x1b[90m[analyzer] #${proposicaoId} | ${result.format.toUpperCase()} | ${fileSize} | ${wordLabel} | ${charLabel} | ${tokenLabel} | ${cacheIcon} (${fetchElapsed}s)\x1b[0m`);
        } else {
          console.log(`  \x1b[90m[analyzer] Texto completo não disponível (${fetchElapsed}s)\x1b[0m`);
        }
      } catch (err: any) {
        const fetchElapsed = ((performance.now() - startFetch) / 1000).toFixed(1);
        console.log(`  \x1b[33m[analyzer] Falha: ${err.message?.substring(0, 80) || "erro"} (${fetchElapsed}s)\x1b[0m`);
      }
    }

    // --- Montar prompt ---
    const promptMemo = buildPrompt(proposal, mode, fullTextResult);

    // --- Verificar/truncar contexto ---
    let prompt = promptMemo;
    const totalTokens = estimateTokens(prompt);
    if (totalTokens > contextLimit * 0.8) {
      const maxChars = Math.floor(contextLimit * 0.75 * 4);
      prompt = promptMemo.slice(0, maxChars) + "\n\n[... TEXTO TRUNCADO por limite de contexto ...]";
      console.log(`  \x1b[33m⚠ Prompt ~${totalTokens} tokens (limite ${contextLimit}), truncado\x1b[0m`);
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
      const parsedResult = JSON.parse(cleaned) as ProposalClassification;

      if (!VALID_CATEGORIES.includes(parsedResult.category as any)) {
        throw new Error(`categoria inválida: ${parsedResult.category}`);
      }
      if (!VALID_CONFIDENCES.includes(parsedResult.confidence as ClassificationConfidence)) {
        throw new Error(`confiança inválida: ${parsedResult.confidence}`);
      }
      if (!parsedResult.justification || parsedResult.justification.length < 10) {
        throw new Error("justificativa muito curta ou ausente");
      }

      classificationsData.classifications[proposal.id] = {
        category: parsedResult.category,
        confidence: parsedResult.confidence,
        justification: parsedResult.justification,
      };

      await writeFile(classificationsPath, `${JSON.stringify(classificationsData, null, 2)}\n`);
      count++;

      recentTimes.push(elapsed);
      if (recentTimes.length > WINDOW) recentTimes.shift();
      sumElapsed += elapsed;
      countElapsed++;

      const catLabel = CATEGORY_LABELS[parsedResult.category] || parsedResult.category;
      console.log(`  ${elapsedStr}  \x1b[32m✓\x1b[0m ${catLabel} (${parsedResult.confidence})`);
      console.log(`  ${parsedResult.justification}\n`);

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
  const elapsedSuffix = countElapsed > 0 ? ` (média ${(sumElapsed / countElapsed).toFixed(1)}s/prop.)` : "";
  console.log(`\x1b[32mConcluído! ${count} sucesso, ${countError} erro(s) em ${toProcess.length} proposições${elapsedSuffix}\x1b[0m`);
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
