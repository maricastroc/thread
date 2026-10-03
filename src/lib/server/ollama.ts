import "server-only";
import { config } from "./config";

export class ModelServiceError extends Error {
  constructor(
    message: string,
    readonly detail: string,
  ) {
    super(message);
  }
}

async function call<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.ollamaHost}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ModelServiceError(
      "The local model service (Ollama) isn’t reachable.",
      `${config.ollamaHost}${endpoint}: ${(error as Error).message}. Start it with: ollama serve`,
    );
  }
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404 && /not found/i.test(text)) {
      throw new ModelServiceError(`The model ${String(body.model)} isn’t installed.`, `Run: ollama pull ${String(body.model)}\n${text}`);
    }
    throw new ModelServiceError(`Ollama answered with status ${response.status}.`, text);
  }
  return (await response.json()) as T;
}

type ChatResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
};

export type ChatStats = { promptTokens: number; outputTokens: number; ms: number };

export async function chatJson(options: {
  model: string;
  system: string;
  user: string;
  schema: object;
  numCtx: number;
}): Promise<{ data: unknown; stats: ChatStats }> {
  const body = {
    model: options.model,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    format: options.schema,
    stream: false,
    think: false,
    keep_alive: "15m",
    options: { temperature: 0, seed: 42, num_ctx: options.numCtx },
  };
  const response = await call<ChatResponse>("/api/chat", body);
  const content = response.message?.content ?? "";
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new ModelServiceError("The archivist model returned something that isn’t valid JSON.", content.slice(0, 2000));
  }
  return {
    data,
    stats: {
      promptTokens: response.prompt_eval_count ?? 0,
      outputTokens: response.eval_count ?? 0,
      ms: Math.round((response.total_duration ?? 0) / 1e6),
    },
  };
}

export async function embed(model: string, input: string[]): Promise<number[][]> {
  const response = await call<{ embeddings: number[][] }>("/api/embed", { model, input, keep_alive: "15m", truncate: true });
  return response.embeddings;
}
