/**
 * Provider 抽象 — Article 4 の Claude / Gemini クライアントが共通で満たす契約。
 *
 * Article 3 は `askClaude()` 関数を 1 つ直接 export する設計だったが、Article 4
 * は 2 つ以上の provider を同一シグネチャで扱う必要があるため、この types.ts に
 * 共通の型だけを置き、各 provider 実装 (`src/providers/claude.ts` /
 * `src/providers/gemini.ts`) が `ProviderClient` を実装する。
 *
 * 依存方針: このファイルは `@anthropic-ai/sdk` / `@google/genai` を含む外部
 * SDK に一切依存しない。SDK import は各 provider 実装側でのみ行う。
 */

export type ProviderName = "claude" | "gemini";

export type ProviderErrorCode =
  | "unauthenticated"
  | "rate_limited"
  | "network_error"
  | "invalid_response";

export type ProviderError = {
  code: ProviderErrorCode;
  message: string;
  /** `code === "rate_limited"` のときのみ provider から取得できれば入る */
  resetAt?: string;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProviderError };

export type ProviderResponse = {
  text: string;
  /** 実際に API に渡った model ID (options.model の alias ではなく生の値) */
  modelUsed: string;
  latencyMs: number;
};

export type AskOptions<M extends string = string> = {
  /**
   * provider 固有の alias (Claude: "sonnet" | "opus"、Gemini: "flash" | "pro")。
   * 各実装が内部で実 model ID にマップする。省略時は各実装のデフォルト
   */
  model?: M;
  maxOutputTokens?: number;
};

/**
 * Article 4 の Provider 抽象。`ask()` は throw せず必ず `Result<T>` で返す契約。
 * generic 引数 `M` は各実装が狭い union で束縛する (例: `ProviderClient<"sonnet" | "opus">`)。
 */
export type ProviderClient<M extends string = string> = {
  readonly name: ProviderName;
  ask(
    question: string,
    options?: AskOptions<M>,
  ): Promise<Result<ProviderResponse>>;
};
