import { createInterface } from "node:readline/promises";
import {
  loadConfig,
  saveConfig,
  interactiveSelect,
  getProvider,
} from "./providers";
import type { AnalysisMode } from "./providers";
import { classifyVotes } from "./classify-votes-llm";
import { classifyProposals } from "./classify-proposals-llm";

type ClassifyTarget = "votes" | "proposals";

async function selectTarget(lastTarget?: ClassifyTarget): Promise<ClassifyTarget> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const defaultOption = lastTarget === "proposals" ? "2" : "1";
  console.log(`\nO que você quer classificar?`);
  console.log(`  1) Votações (${lastTarget === "votes" ? "último" : "pendentes"})`);
  console.log(`  2) Proposições (${lastTarget === "proposals" ? "último" : "pendentes"})`);
  const choice = (await rl.question(`Escolha [${defaultOption}]: `)).trim() || defaultOption;
  rl.close();
  return choice === "2" ? "proposals" : "votes";
}

async function selectProcessAll(target: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\nEscopo de classificação para ${target}:`);
  console.log(`  1) Só pendentes — processa apenas itens ainda não classificados`);
  console.log(`  2) Todas — processa TODAS, sobrescrevendo classificações existentes (regex ou LLM anterior)`);
  const choice = (await rl.question(`Escolha [1]: `)).trim();
  rl.close();
  return choice === "2";
}

async function interactForMode(config: Awaited<ReturnType<typeof loadConfig>>): Promise<AnalysisMode> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const defaultMode = config.lastMode === "advanced" ? "2" : "1";
  console.log(`\nModo de análise:`);
  console.log(`  1) Básico — usa só resumo`);
  console.log(`  2) Avançado — baixa texto completo (PDF/HTML via Câmara)`);
  const choice = (await rl.question(`Escolha o modo [${defaultMode}]: `)).trim() || defaultMode;
  rl.close();
  return choice === "2" ? "advanced" : "basic";
}

async function main() {
  const config = await loadConfig();

  const argsProvider = process.argv.find((a) => a.startsWith("--provider="));
  const argsModel = process.argv.find((a) => a.startsWith("--model="));
  const argsTarget = process.argv.find((a) => a.startsWith("--target="));
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

  const target = argsTarget?.split("=")[1] as ClassifyTarget | undefined
    ?? await selectTarget(config.lastTarget);

  config.lastTarget = target;
  await saveConfig(config);

  const processAll = await selectProcessAll(target === "votes" ? "votações" : "proposições");

  let providerId = argsProvider?.split("=")[1];
  let model = argsModel?.split("=")[1];

  if (providerId && model) {
    const providerConfig = config.providers[providerId as keyof typeof config.providers];
    const provider = getProvider(providerId as any, providerConfig);
    console.log(`Usando provedor: ${provider.name} | Modelo: ${model}`);
    const mode = await interactForMode(config);
    if (target === "votes") {
      await classifyVotes(provider, model, limit, config, mode, processAll);
    } else {
      await classifyProposals(provider, model, limit, config, mode, processAll);
    }
  } else {
    const selection = await interactiveSelect(config, "classificar");
    const mode = await interactForMode(config);
    if (target === "votes") {
      await classifyVotes(selection.provider, selection.model, limit, config, mode, processAll);
    } else {
      await classifyProposals(selection.provider, selection.model, limit, config, mode, processAll);
    }
  }
}

main().catch((error) => {
  console.error("Erro fatal durante o processamento:", error);
  process.exitCode = 1;
});
