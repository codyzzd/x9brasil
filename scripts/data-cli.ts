import { createInterface } from "node:readline/promises";
import { runFetch, runProcess, runFullSync, setUseCache } from "./lib/sync-lib";

type Stage = "fetch" | "process" | "sync" | "apply" | "classify";

async function ask(question: string, choices: string[], defaultIdx = 0): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n${question}`);
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  const answer = await rl.question(`Escolha [${defaultIdx + 1}]: `);
  rl.close();
  const idx = answer.trim() ? parseInt(answer, 10) - 1 : defaultIdx;
  return idx >= 0 && idx < choices.length ? idx : defaultIdx;
}

async function askYesNo(question: string, defaultYes = false): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const hint = defaultYes ? "S/n" : "s/N";
  const answer = await rl.question(`${question} (${hint}): `);
  rl.close();
  if (!answer.trim()) return defaultYes;
  return answer.trim().toLowerCase().startsWith("s");
}

async function main() {
  const arg = process.argv[2];

  const stages: Record<string, Stage> = {
    fetch: "fetch",
    process: "process",
    sync: "sync",
    apply: "apply",
    classify: "classify",
  };

  let stage: Stage | undefined = arg ? stages[arg.toLowerCase()] : undefined;

  if (!stage) {
    const { execSync } = await import("node:child_process");
    console.log("\n🇧🇷 X9Candidatos — Pipeline de Dados\n");
    const idx = await ask(
      "O que você quer fazer?",
      [
        "Buscar dados (download de CSVs e APIs)",
        "Processar dados (parse + compilar ranking)",
        "Buscar e processar (sync completo)",
        "Aplicar classificações (atualizar ranking sem reprocessar)",
        "Classificar com IA (LLM)",
      ],
    );
    stage = ["fetch", "process", "sync", "apply", "classify"][idx] as Stage;
  }

  const fresh = arg === "sync" && process.argv.includes("--fresh")
    || arg === "fetch" && process.argv.includes("--fresh")
    || arg === "process" && process.argv.includes("--fresh");

  if (!fresh && (stage === "fetch" || stage === "process" || stage === "sync")) {
    const skipFresh = await askYesNo("Usar cache local? (Pular re-download se possível)", true);
    setUseCache(skipFresh);
  } else {
    setUseCache(!fresh);
  }

  switch (stage) {
    case "fetch":
      console.log("\n📦 Buscando dados...\n");
      await runFetch();
      break;
    case "process":
      console.log("\n⚙️ Processando dados...\n");
      await runProcess();
      break;
    case "sync":
      console.log("\n🔄 Sincronização completa...\n");
      await runFullSync();
      break;
    case "apply":
      console.log("\n🏷️ Aplicando classificações...\n");
      await import("./data-apply");
      break;
    case "classify":
      console.log("\n🤖 Classificação com IA...\n");
      await import("./classify");
      break;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});