import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".llm-cache", "proposicoes");
const propositionIdCache = new Map<string, Promise<number | null>>();
const fullTextCache = new Map<number, Promise<FullTextResult>>();

export interface FullTextResult {
  text: string;
  proposicaoId: number;
  format: "pdf" | "html" | "texto";
  fileSize: number;
  charCount: number;
  wordCount: number;
  tokenEstimate: number;
  url: string;
  cachePath: string;
  fromCache: boolean;
}

async function readCache(cachePath: string): Promise<string | null> {
  try {
    return await readFile(cachePath, "utf8");
  } catch {
    return null;
  }
}

async function writeCache(cachePath: string, text: string): Promise<void> {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, text);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function downloadPdfText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao baixar PDF: ${res.status}`);
  const buf = await res.arrayBuffer();
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  return result.text;
}

async function downloadHtmlText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao baixar HTML: ${res.status}`);
  const html = await res.text();
  return stripHtml(html);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function fetchPropositionId(voteId: string): Promise<number | null> {
  const url = `https://dadosabertos.camara.leg.br/api/v2/votacoes/${voteId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = asRecord(await res.json());
    const objetos = asRecord(data.dados).objetosPossiveis;
    if (!objetos || objetos.length === 0) return null;
    return Number(asRecord(objetos[0]).id);
  } catch {
    return null;
  }
}

export async function getPropositionId(voteId: string): Promise<number | null> {
  const cached = propositionIdCache.get(voteId);
  if (cached) return cached;
  const promise = fetchPropositionId(voteId);
  propositionIdCache.set(voteId, promise);
  return promise;
}

async function fetchFullText(proposicaoId: number): Promise<FullTextResult> {
  const cachePath = join(CACHE_DIR, `${proposicaoId}.txt`);
  const cached = await readCache(cachePath);
  if (cached) {
    const cachedStats = await stat(cachePath);
    return {
      text: cached,
      proposicaoId,
      format: "texto",
      fileSize: cachedStats.size,
      charCount: cached.length,
      wordCount: countWords(cached),
      tokenEstimate: estimateTokens(cached),
      url: "(cache)",
      cachePath,
      fromCache: true,
    };
  }

  const propUrl = `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${proposicaoId}`;
  const propRes = await fetch(propUrl);
  if (!propRes.ok) throw new Error(`Erro ao buscar proposição ${proposicaoId}: ${propRes.status}`);
  const propData = asRecord(await propRes.json());
  const inteiroTeor = asRecord(propData.dados).urlInteiroTeor as string | undefined;
  if (!inteiroTeor) throw new Error(`Proposição ${proposicaoId} não possui urlInteiroTeor`);

  const headRes = await fetch(inteiroTeor, { method: "HEAD" });
  const contentType = headRes.headers.get("content-type") || "";
  const contentLength = headRes.headers.get("content-length");
  const fileSize = contentLength ? Number(contentLength) : 0;

  let text: string;
  let format: "pdf" | "html" | "texto";

  if (contentType.includes("pdf")) {
    text = await downloadPdfText(inteiroTeor);
    format = "pdf";
  } else if (contentType.includes("html")) {
    text = await downloadHtmlText(inteiroTeor);
    format = "html";
  } else {
    const textRes = await fetch(inteiroTeor);
    text = await textRes.text();
    format = "texto";
  }

  await writeCache(cachePath, text);

  return {
    text,
    proposicaoId,
    format,
    fileSize,
    charCount: text.length,
    wordCount: countWords(text),
    tokenEstimate: estimateTokens(text),
    url: inteiroTeor,
    cachePath,
    fromCache: false,
  };
}

export async function getFullTextForVote(voteId: string): Promise<FullTextResult | null> {
  const propId = await getPropositionId(voteId);
  if (!propId) return null;
  return getFullTextForProposal(propId);
}

export async function getFullTextForProposal(proposicaoId: number): Promise<FullTextResult | null> {
  try {
    const cached = fullTextCache.get(proposicaoId);
    if (cached) return await cached;
    const promise = fetchFullText(proposicaoId);
    fullTextCache.set(proposicaoId, promise);
    return await promise;
  } catch {
    fullTextCache.delete(proposicaoId);
    return null;
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const KNOWN_CONTEXT_LIMITS: Record<string, number> = {
  "llama-3.2-3b": 8192,
  "llama-3.2-1b": 8192,
  "llama-3.1-8b": 131072,
  "llama-3.3-70b": 131072,
  "qwen2.5-7b": 32768,
  "qwen2.5-14b": 32768,
  "qwen2.5-32b": 32768,
  "qwen2.5-72b": 32768,
  "qwen3-8b": 131072,
  "qwen3-14b": 32768,
  "qwen3-32b": 32768,
  "qwen3-4b": 32768,
  "gemini-1.5": 1048576,
  "gemini-2.0": 1048576,
  "gemini-2.5": 1048576,
  "deepseek": 65536,
  "gpt-4": 8192,
  "gpt-4o": 128000,
};

export function detectContextLimit(modelName: string): number {
  const lower = modelName.toLowerCase();
  for (const [key, limit] of Object.entries(KNOWN_CONTEXT_LIMITS)) {
    if (lower.includes(key)) return limit;
  }
  return 8192;
}

export function truncateToContext(
  text: string,
  basePromptTokens: number,
  contextLimit: number,
): string {
  const maxTokens = contextLimit - basePromptTokens - 1024;
  if (maxTokens <= 0) return "";
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[... TEXTO TRUNCADO por limite de contexto ...]";
}

export function formatEta(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function formatCompletionDate(ms: number): string {
  const date = new Date(Date.now() + ms);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}
