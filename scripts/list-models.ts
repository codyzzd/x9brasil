import {
  loadConfig,
  interactiveSelect,
  getProvider,
} from "./providers";

async function main() {
  const config = await loadConfig();

  const argsProvider = process.argv.find((a) => a.startsWith("--provider="));

  if (argsProvider) {
    const providerId = argsProvider.split("=")[1];
    const providerConfig = config.providers[providerId as keyof typeof config.providers];
    const provider = getProvider(providerId as any, providerConfig);
    await listModels(provider);
  } else {
    const selection = await interactiveSelect(config, "listar modelos");
    await listModels(selection.provider);
  }
}

async function listModels(provider: ReturnType<typeof getProvider>) {
  console.log(`\nBuscando modelos de ${provider.name}...`);
  try {
    const models = await provider.listModels();
    if (models.length === 0) {
      console.log("Nenhum modelo encontrado.");
      return;
    }
    console.log(`\nModelos disponíveis (${models.length}):`);
    for (const m of models) {
      console.log(`  - ${m}`);
    }
  } catch (err: any) {
    console.error(`Erro ao listar modelos: ${err.message || err}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exitCode = 1;
});
