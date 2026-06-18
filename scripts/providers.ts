import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { env } from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_DIR = join(__dirname, ".llm-config");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export type ProviderId = "gemini" | "openai" | "ollama" | "lmstudio";

export interface LLMProvider {
  id: ProviderId;
  name: string;
  listModels(): Promise<string[]>;
  generateContent(prompt: string, options: {
    model: string;
    temperature?: number;
    responseMimeType?: string;
  }): Promise<string>;
}

interface ProviderConfig {
  baseUrl?: string;
}

export type AnalysisMode = "basic" | "advanced";

interface AppConfig {
  lastProvider: ProviderId;
  lastModel: string;
  lastMode: AnalysisMode;
  lastTarget?: "votes" | "proposals";
  providers: Partial<Record<ProviderId, ProviderConfig>>;
}

function defaultConfig(): AppConfig {
  return {
    lastProvider: "gemini",
    lastModel: "gemini-2.5-flash",
    lastMode: "basic",
    providers: {
      openai: { baseUrl: "https://api.openai.com" },
      ollama: { baseUrl: "http://localhost:11434" },
      lmstudio: { baseUrl: "http://localhost:1234" },
    },
  };
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const defaults = defaultConfig();
    const providers = { ...defaults.providers, ...(parsed.providers ?? {}) };
    if (providers.openai?.baseUrl === "https://api.deepseek.com") {
      providers.openai = { ...providers.openai, baseUrl: "https://api.openai.com" };
    }
    return { ...defaults, ...parsed, providers };
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readStringArray(value: unknown, field = "id") {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item)[field])
    .filter((item): item is string => typeof item === "string");
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 3000,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        if (attempt >= maxRetries - 1) return response;
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`  ⚠️ API retornou status ${response.status}. Tentativa ${attempt + 1}/${maxRetries}. Aguardando ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      return response;
    } catch (err: unknown) {
      if (attempt >= maxRetries - 1) throw err;
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`  ⚠️ Falha de rede (${errorMessage(err)}). Tentativa ${attempt + 1}/${maxRetries}. Aguardando ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
  throw new Error("Falha na chamada HTTP após múltiplas tentativas.");
}

class GeminiProvider implements LLMProvider {
  id: ProviderId = "gemini";
  name = "Google Gemini";

  private getApiKey() {
    const key = env.GEMINI_API_KEY;
    if (!key) throw new Error("Variável GEMINI_API_KEY não definida.");
    return key;
  }

  async listModels(): Promise<string[]> {
    const key = this.getApiKey();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!res.ok) throw new Error(`Erro ao listar modelos: ${res.status}`);
    const data = asRecord(await res.json());
    return readStringArray(data.models, "name").map((name) => name.replace("models/", ""));
  }

  async generateContent(prompt: string, options: { model: string; temperature?: number; responseMimeType?: string }): Promise<string> {
    const key = this.getApiKey();
    const generationConfig: Record<string, unknown> = { temperature: options.temperature ?? 0.1 };
    if (options.responseMimeType) {
      generationConfig.responseMimeType = options.responseMimeType;
    }
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    };
    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!res.ok) throw new Error(`Erro na API Gemini: ${res.status} - ${res.statusText}`);
    const json = asRecord(await res.json());
    const candidates = Array.isArray(json.candidates) ? json.candidates : [];
    const first = asRecord(candidates[0]);
    const content = asRecord(first.content);
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const text = asRecord(parts[0]).text;
    if (!text) throw new Error("Resposta da API Gemini vazia ou inválida.");
    return String(text);
  }
}

class OpenAICompatibleProvider implements LLMProvider {
  id: ProviderId = "openai";
  name = "OpenAI";

  private baseUrl: string;
  constructor(baseUrl: string) { this.baseUrl = baseUrl.replace(/\/+$/, ""); }

  private getApiKey() {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error("Variável OPENAI_API_KEY não definida.");
    return key;
  }

  async listModels(): Promise<string[]> {
    const key = this.getApiKey();
    const res = await fetch(`${this.baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Erro ao listar modelos: ${res.status}`);
    const data = asRecord(await res.json());
    return readStringArray(data.data);
  }

  async generateContent(prompt: string, options: { model: string; temperature?: number; responseMimeType?: string }): Promise<string> {
    const key = this.getApiKey();
    const body = {
      model: options.model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.1,
    };
    const res = await fetchWithRetry(
      `${this.baseUrl}/v1/chat/completions`,
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Erro na API OpenAI: ${res.status} - ${res.statusText} ${errBody}`);
    }
    const json = asRecord(await res.json());
    const choices = Array.isArray(json.choices) ? json.choices : [];
    const text = asRecord(asRecord(choices[0]).message).content;
    if (!text) throw new Error("Resposta da API OpenAI vazia ou inválida.");
    return String(text);
  }
}

class OllamaProvider implements LLMProvider {
  id: ProviderId = "ollama";
  name = "Ollama (local)";

  private baseUrl: string;
  constructor(baseUrl: string) { this.baseUrl = baseUrl.replace(/\/+$/, ""); }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Erro ao listar modelos Ollama: ${res.status}`);
    const data = asRecord(await res.json());
    return readStringArray(data.models, "name");
  }

  async generateContent(prompt: string, options: { model: string; temperature?: number; responseMimeType?: string }): Promise<string> {
    const body = {
      model: options.model,
      messages: [{ role: "user", content: prompt }],
      options: { temperature: options.temperature ?? 0.1 },
    };
    const res = await fetchWithRetry(
      `${this.baseUrl}/api/chat`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!res.ok) throw new Error(`Erro na API Ollama: ${res.status} - ${res.statusText}`);
    const lines = (await res.text()).split("\n").filter(Boolean);
    let fullContent = "";
    for (const line of lines) {
      try {
        const chunk = asRecord(JSON.parse(line) as unknown);
        const content = asRecord(chunk.message).content;
        if (typeof content === "string") fullContent += content;
      } catch { /* skip malformed */ }
    }
    if (!fullContent) throw new Error("Resposta da API Ollama vazia ou inválida.");
    return fullContent;
  }
}

class LMStudioProvider implements LLMProvider {
  id: ProviderId = "lmstudio";
  name = "LM Studio (local)";

  private baseUrl: string;
  constructor(baseUrl: string) { this.baseUrl = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, ""); }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/v1/models`);
    if (!res.ok) throw new Error(`Erro ao listar modelos LM Studio: ${res.status}`);
    const data = asRecord(await res.json());
    return readStringArray(data.data);
  }

  async generateContent(prompt: string, options: { model: string; temperature?: number; responseMimeType?: string }): Promise<string> {
    const body = {
      model: options.model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.1,
      stream: false,
    };
    const res = await fetchWithRetry(
      `${this.baseUrl}/v1/chat/completions`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Erro na API LM Studio: ${res.status} - ${res.statusText} ${errBody}`);
    }
    const json = asRecord(await res.json());
    const apiError = asRecord(json.error);
    if (json.error) throw new Error(`Erro do LM Studio: ${apiError.message || JSON.stringify(json.error)}`);
    const choices = Array.isArray(json.choices) ? json.choices : [];
    const text = asRecord(asRecord(choices[0]).message).content;
    if (!text) {
      const snippet = JSON.stringify(json).substring(0, 500);
      throw new Error(`Resposta da API LM Studio vazia ou inválida. Resposta bruta (início): ${snippet}`);
    }
    return String(text);
  }
}

export function getProvider(id: ProviderId, config?: ProviderConfig): LLMProvider {
  switch (id) {
    case "gemini": return new GeminiProvider();
    case "openai": return new OpenAICompatibleProvider(config?.baseUrl || "https://api.openai.com");
    case "ollama": return new OllamaProvider(config?.baseUrl || "http://localhost:11434");
    case "lmstudio": return new LMStudioProvider(config?.baseUrl || "http://localhost:1234");
  }
}

export async function listAvailableProviders(): Promise<LLMProvider[]> {
  return [
    getProvider("gemini"),
    getProvider("openai"),
    getProvider("ollama"),
    getProvider("lmstudio"),
  ];
}

export async function interactiveSelect(
  config: AppConfig,
  purpose: "classificar" | "listar modelos",
): Promise<{ provider: LLMProvider; model: string }> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const providers = await listAvailableProviders();

  console.log(`\nProvedores disponíveis para ${purpose}:`);
  providers.forEach((p, i) => {
    const mark = p.id === config.lastProvider ? " (último)" : "";
    console.log(`  ${i + 1}) ${p.name}${mark}`);
  });

  const defaultIdx = providers.findIndex((p) => p.id === config.lastProvider);
  const choiceRaw = await rl.question(
    `Escolha o provedor [${defaultIdx + 1}]: `,
  );
  const choice = choiceRaw.trim() ? parseInt(choiceRaw, 10) - 1 : defaultIdx;
  const provider = providers[choice] || providers[defaultIdx];
  console.log(`  => ${provider.name}\n`);

  if (provider.id === "openai" && !env.OPENAI_API_KEY) {
    const key = (await rl.question("OPENAI_API_KEY (usada só nesta sessão): ")).trim();
    if (key) env.OPENAI_API_KEY = key;
  }
  if (provider.id === "gemini" && !env.GEMINI_API_KEY) {
    const key = (await rl.question("GEMINI_API_KEY (usada só nesta sessão): ")).trim();
    if (key) env.GEMINI_API_KEY = key;
  }

  let model: string;
  const argsModel = provider.id === config.lastProvider ? config.lastModel : undefined;

  const models = await provider.listModels().catch(() => null);
  if (models && models.length > 0) {
    console.log(`Modelos disponíveis para ${provider.name}:`);
    models.forEach((m, i) => {
      const mark = m === argsModel ? " (último)" : "";
      console.log(`  ${i + 1}) ${m}${mark}`);
    });
    const lastIdx = argsModel ? models.indexOf(argsModel) : -1;
    const defaultModelIdx = lastIdx >= 0 ? lastIdx + 1 : 1;
    const modelRaw = await rl.question(
      `Escolha o modelo [${defaultModelIdx}]: `,
    );
    model = modelRaw.trim()
      ? models[parseInt(modelRaw, 10) - 1]
      : models[defaultModelIdx - 1];
    if (!model) model = models[0];
  } else {
    model = argsModel || (await rl.question("Nome do modelo: ")).trim();
    if (!model) model = argsModel || "";
  }

  rl.close();
  console.log(`  => Modelo: ${model}\n`);
  return { provider, model };
}
