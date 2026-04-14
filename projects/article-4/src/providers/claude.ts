/**
 * Claude Provider — `@anthropic-ai/sdk` を `ProviderClient` 抽象で包む薄いアダプタ。
 *
 * Article 3 の `src/claude.ts` は `askClaude()` 関数 + ローカル型 (`Result` / `AskClaudeError`)
 * を直接 export していた。Article 4 では型は `./types.js` から import し、この
 * ファイルは `claudeProvider: ProviderClient<ClaudeModel>` を 1 つ export する。
 *
 * `chatgpt_answer` (呼び出し元 LLM の回答) はあえて Claude に渡さない: Claude は
 * "他モデルの回答を見ない独立した意見" として答え、council.ts 側で side-by-side
 * 比較や stance 判定が中立になるようにする設計を Article 3 から踏襲。
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  AskOptions,
  ProviderClient,
  ProviderResponse,
  Result,
} from "./types.js";

const MODEL_MAP = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
} as const;

export type ClaudeModel = keyof typeof MODEL_MAP;

const DEFAULT_MAX_TOKENS = 1024;

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

async function askClaude(
  question: string,
  options: AskOptions<ClaudeModel> = {},
): Promise<Result<ProviderResponse>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const modelAlias: ClaudeModel = options.model ?? "sonnet";
  const modelId = MODEL_MAP[modelAlias];

  const start = Date.now();
  try {
    const response = await clientResult.data.messages.create({
      model: modelId,
      max_tokens: options.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
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
          ...(resetAt ? { resetAt } : {}),
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

export const claudeProvider: ProviderClient<ClaudeModel> = {
  name: "claude",
  ask: askClaude,
};
