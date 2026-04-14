/**
 * 薄い Anthropic API クライアント。
 *
 * `ANTHROPIC_API_KEY` 環境変数から API キーを読み込み、Claude Messages API を
 * 呼び出す。エラーは throw せず `Result<T>` で返す (Article 1 の `github.ts`
 * と同じ pattern)。呼び出し側はまず `result.ok` を見て分岐する。
 *
 * chatgpt_answer (呼び出し元 LLM の回答) は **あえて Claude に渡さない**。
 * これにより Claude は "ChatGPT の回答を見ない状態での独立した意見" を返し、
 * UI 側で side-by-side 比較した時に中立な対比になる。
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL_MAP = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
} as const;

export type AskClaudeModel = keyof typeof MODEL_MAP;

export type AskClaudeError =
  | { code: "unauthenticated"; message: string }
  | { code: "rate_limited"; message: string; resetAt?: string }
  | { code: "invalid_response"; message: string }
  | { code: "network_error"; message: string };

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AskClaudeError };

export type AskClaudeSuccess = {
  text: string;
  modelUsed: string;
  latencyMs: number;
};

let cachedClient: Anthropic | null = null;

function getClient(): Result<Anthropic> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return {
      ok: false,
      error: {
        code: "unauthenticated",
        message:
          "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
      },
    };
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey });
  }
  return { ok: true, data: cachedClient };
}

export async function askClaude(
  question: string,
  options: { model?: AskClaudeModel } = {},
): Promise<Result<AskClaudeSuccess>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const modelAlias = options.model ?? "sonnet";
  const modelId = MODEL_MAP[modelAlias];

  const start = Date.now();
  try {
    const response = await clientResult.data.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: question,
        },
      ],
    });
    const latencyMs = Date.now() - start;

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text",
    );
    if (!textBlock) {
      return {
        ok: false,
        error: {
          code: "invalid_response",
          message: "Claude returned no text blocks in the response.",
        },
      };
    }

    return {
      ok: true,
      data: {
        text: textBlock.text,
        modelUsed: response.model,
        latencyMs,
      },
    };
  } catch (err) {
    const anyErr = err as {
      status?: number;
      message?: string;
      headers?: Record<string, string>;
    };
    if (anyErr.status === 401 || anyErr.status === 403) {
      return {
        ok: false,
        error: {
          code: "unauthenticated",
          message: anyErr.message ?? "Claude API authentication failed",
        },
      };
    }
    if (anyErr.status === 429) {
      const resetAt =
        anyErr.headers?.["anthropic-ratelimit-requests-reset"] ??
        anyErr.headers?.["anthropic-ratelimit-tokens-reset"];
      return {
        ok: false,
        error: {
          code: "rate_limited",
          message: anyErr.message ?? "Claude API rate limit reached",
          resetAt,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: "network_error",
        message: anyErr.message ?? String(err),
      },
    };
  }
}
