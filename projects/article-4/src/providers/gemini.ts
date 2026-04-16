/**
 * Gemini Provider — `@google/genai` を `ProviderClient` 抽象で包む薄いアダプタ。
 *
 * `claude.ts` とシンボル名・構造をミラーすることで、`council.ts` 側が両 provider を
 * 完全に同形で扱えるようにする (`claudeProvider` / `geminiProvider` の差は name と
 * model alias の union だけ)。
 *
 * model alias ("flash" / "pro") は Gemini の正式 model ID にマップする。PRD 執筆時点の
 * デフォルトは `gemini-2.5-flash` / `gemini-2.5-pro` で、実 API 疎通 (次 todo) で確定
 * できなければ ここを書き換える。`response.modelVersion` が取れた場合はそちらを
 * `modelUsed` に採用するため、マップ値は "リクエストに使う値" に過ぎない。
 */

import { GoogleGenAI, ApiError } from "@google/genai";
import type {
  AskOptions,
  ProviderClient,
  ProviderResponse,
  Result,
} from "./types.js";

const MODEL_MAP = {
  flash: "gemini-2.5-flash",
  pro: "gemini-2.5-pro",
} as const;

export type GeminiModel = keyof typeof MODEL_MAP;

// gemini-2.5-pro は AUTOMATIC thinking budget を使い、thinking トークンも
// maxOutputTokens の配分に含まれる。`response.text` は thought parts を除外する
// 仕様のため、1024 だと pro のときに thinking だけで使い切って visible text が
// 空 (= `invalid_response`) になる。Claude の 1024 より広めに取る必要がある。
const DEFAULT_MAX_TOKENS = 4096;

let cachedClient: GoogleGenAI | null = null;

function getClient(): Result<GoogleGenAI> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return {
      ok: false,
      error: {
        code: "unauthenticated",
        message:
          "GOOGLE_API_KEY is not set. Copy .env.example to .env and add your key.",
      },
    };
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return { ok: true, data: cachedClient };
}

async function askGemini(
  question: string,
  options: AskOptions<GeminiModel> = {},
): Promise<Result<ProviderResponse>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const modelAlias: GeminiModel = options.model ?? "flash";
  const modelId = MODEL_MAP[modelAlias];

  const start = Date.now();
  try {
    const response = await clientResult.data.models.generateContent({
      model: modelId,
      contents: question,
      config: {
        maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      },
    });
    const latencyMs = Date.now() - start;

    const text = response.text;
    if (typeof text !== "string" || text.length === 0) {
      return {
        ok: false,
        error: {
          code: "invalid_response",
          message: "Gemini returned no text in the response.",
        },
      };
    }

    return {
      ok: true,
      data: {
        text,
        modelUsed: response.modelVersion ?? modelId,
        latencyMs,
      },
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        return {
          ok: false,
          error: {
            code: "unauthenticated",
            message: err.message,
          },
        };
      }
      if (err.status === 429) {
        return {
          ok: false,
          error: {
            code: "rate_limited",
            message: err.message,
          },
        };
      }
      if (err.status >= 400 && err.status < 500) {
        return {
          ok: false,
          error: {
            code: "invalid_response",
            message: err.message,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: "network_error",
          message: err.message,
        },
      };
    }
    const anyErr = err as { message?: string };
    return {
      ok: false,
      error: {
        code: "network_error",
        message: anyErr.message ?? String(err),
      },
    };
  }
}

export const geminiProvider: ProviderClient<GeminiModel> = {
  name: "gemini",
  ask: askGemini,
};
