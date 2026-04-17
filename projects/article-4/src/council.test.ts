/**
 * Unit tests for council.ts — 擬似合議型 (Round 1 = 3 者独立 + Round 2 = 相互参照 stance) の契約検証。
 *
 * テスト戦略:
 *   - vitest のモック API (`vi.mock`) を使わず、`ProviderClient` interface を
 *     満たす plain object を手で作って runCouncil() に渡す。ProviderClient を
 *     loose generic で設計した恩恵をここで回収する。
 *   - `mockOkProvider` は Round 1 (独立回答文) と Round 2 (stance JSON) で
 *     別テキストを返す 2-step モック。`runCouncil` が 1 speaker につき 2 回 `ask()`
 *     を呼ぶ前提をここで再現する。
 *   - parseStanceResponse の単体テストも同梱し、council.ts の挙動契約の
 *     single source of truth にする。
 *
 * カバー対象:
 *   - consensus 3 分岐 (unanimous_agree / mixed / unanimous_disagree)
 *   - Round 1 部分失敗 / 両方失敗 → Round 2 自動 skip (round1_failed)
 *   - Round 1 ok + Round 2 provider error
 *   - Round 1 network throw (settledToSpeaker)
 *   - stance parse 失敗 (invalid_response)
 *   - buildRevisionPrompt の 3 consensus ヘッダ分岐 + Round 1 の 3 者引用
 */

import { describe, it, expect } from "vitest";
import {
  runCouncil,
  computeConsensus,
  parseStanceResponse,
  buildRevisionPrompt,
  summarizeCouncilFailure,
  type CouncilTranscript,
  type Speaker,
  type Stance,
} from "./council.js";

// ----------------------------------------------------------------------------
// mock ProviderClient factories
// ----------------------------------------------------------------------------

import type {
  AskOptions,
  ProviderClient,
  ProviderError,
  ProviderResponse,
  Result,
} from "./providers/types.js";

/**
 * Returns a ProviderClient that returns a different text on the first call
 * (Round 1 = free-form answer) vs the second call (Round 2 = stance JSON).
 *
 * 擬似合議型では `runCouncil` が 1 speaker につき 2 回 `ask()` を呼ぶ。1 回目は
 * 質問本体、2 回目は `buildRound2Prompt` の出力。テストはその 2 段を別々に
 * stub できる必要がある。
 */
function mockOkProvider(
  name: "claude" | "gemini",
  round2Text: string,
  round1Text = `round 1 independent answer from ${name}`,
  modelUsed = `${name}-mock`,
): ProviderClient {
  let call = 0;
  return {
    name,
    ask: async (_q: string, _o?: AskOptions): Promise<Result<ProviderResponse>> => {
      const text = call++ === 0 ? round1Text : round2Text;
      return { ok: true, data: { text, modelUsed, latencyMs: 10 } };
    },
  };
}

/**
 * Returns a ProviderClient that always errors on every call.
 * 擬似合議型では Round 1 で error になると Round 2 は自動的に skip される
 * (`error.code = "round1_failed"`)。
 */
function mockErrorProvider(
  name: "claude" | "gemini",
  code: ProviderError["code"],
  message = "mock failure",
): ProviderClient {
  return {
    name,
    ask: async (): Promise<Result<ProviderResponse>> => ({
      ok: false,
      error: { code, message },
    }),
  };
}

/**
 * Returns a ProviderClient that succeeds on Round 1 but errors on Round 2.
 * Round 1 で独立回答を成功させ、Round 2 の独立評価 API 呼び出しのみ失敗する
 * ケースを検証するために使う。
 */
function mockRound2ErrorProvider(
  name: "claude" | "gemini",
  code: ProviderError["code"],
  message = "round 2 failed",
  round1Text = `round 1 independent answer from ${name}`,
): ProviderClient {
  let call = 0;
  return {
    name,
    ask: async (): Promise<Result<ProviderResponse>> => {
      if (call++ === 0) {
        return {
          ok: true,
          data: { text: round1Text, modelUsed: `${name}-mock`, latencyMs: 10 },
        };
      }
      return { ok: false, error: { code, message } };
    },
  };
}

/** Returns a ProviderClient whose `ask()` throws on Round 1 (simulates network reject). */
function mockThrowingProvider(name: "claude" | "gemini", err: Error): ProviderClient {
  return {
    name,
    ask: async () => {
      throw err;
    },
  };
}

/** stance を埋め込んだ JSON レスポンス生成ヘルパー */
function stanceJson(stance: Stance, reason = "test reason"): string {
  return JSON.stringify({ stance, reason });
}

const baseInput = {
  question: "test question",
  chatgpt_initial_answer: "test initial answer",
};

function makeTranscript(
  consensus: CouncilTranscript["consensus"],
  round2Speakers: Speaker[],
  round1Overrides: Partial<Record<"claude" | "gemini", Speaker>> = {},
): CouncilTranscript {
  return {
    ...baseInput,
    rounds: [
      {
        label: "round_1",
        speakers: [
          { name: "chatgpt", content: baseInput.chatgpt_initial_answer },
          round1Overrides.claude ?? { name: "claude", content: "claude round 1" },
          round1Overrides.gemini ?? { name: "gemini", content: "gemini round 1" },
        ],
      },
      { label: "round_2", speakers: round2Speakers },
    ],
    consensus,
    revision_prompt: "",
    total_latency_ms: 0,
  };
}

// ----------------------------------------------------------------------------
// parseStanceResponse
// ----------------------------------------------------------------------------

describe("parseStanceResponse", () => {
  it("parses plain JSON with all 4 stances", () => {
    for (const stance of ["agree", "extend", "partial", "disagree"] as const) {
      const parsed = parseStanceResponse(stanceJson(stance, "ok"));
      expect(parsed).toEqual({ stance, reason: "ok" });
    }
  });

  it("strips ```json code fences", () => {
    const input = '```json\n{"stance": "disagree", "reason": "bad"}\n```';
    expect(parseStanceResponse(input)).toEqual({ stance: "disagree", reason: "bad" });
  });

  it("strips bare ``` code fences", () => {
    const input = '```\n{"stance": "extend", "reason": "plus"}\n```';
    expect(parseStanceResponse(input)).toEqual({ stance: "extend", reason: "plus" });
  });

  it("returns null for invalid stance value", () => {
    expect(parseStanceResponse('{"stance": "maybe", "reason": "..."}')).toBeNull();
  });

  it("returns null for missing reason", () => {
    expect(parseStanceResponse('{"stance": "agree"}')).toBeNull();
  });

  it("returns null for empty reason", () => {
    expect(parseStanceResponse('{"stance": "agree", "reason": ""}')).toBeNull();
  });

  it("returns null for non-JSON text", () => {
    expect(parseStanceResponse("I agree with you.")).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// computeConsensus
// ----------------------------------------------------------------------------

function makeSpeaker(
  name: "claude" | "gemini",
  stance: Stance | undefined,
  opts: { error?: true } = {},
): Speaker {
  const s: Speaker = { name };
  if (stance !== undefined) s.stance = stance;
  if (opts.error) s.error = { code: "network_error", message: "err" };
  return s;
}

describe("computeConsensus", () => {
  it("unanimous_agree when both speakers are agree", () => {
    expect(
      computeConsensus([makeSpeaker("claude", "agree"), makeSpeaker("gemini", "agree")]),
    ).toBe("unanimous_agree");
  });

  it("unanimous_agree when one is agree and one is extend", () => {
    expect(
      computeConsensus([makeSpeaker("claude", "extend"), makeSpeaker("gemini", "agree")]),
    ).toBe("unanimous_agree");
  });

  it("unanimous_disagree when both are disagree", () => {
    expect(
      computeConsensus([
        makeSpeaker("claude", "disagree"),
        makeSpeaker("gemini", "disagree"),
      ]),
    ).toBe("unanimous_disagree");
  });

  it("mixed when stances differ (agree + disagree)", () => {
    expect(
      computeConsensus([
        makeSpeaker("claude", "agree"),
        makeSpeaker("gemini", "disagree"),
      ]),
    ).toBe("mixed");
  });

  it("mixed when one is partial (partial blocks unanimous_agree)", () => {
    expect(
      computeConsensus([makeSpeaker("claude", "agree"), makeSpeaker("gemini", "partial")]),
    ).toBe("mixed");
  });

  it("mixed when only 1 speaker has a stance (single-speaker unanimous guard)", () => {
    expect(
      computeConsensus([
        makeSpeaker("claude", "agree"),
        makeSpeaker("gemini", undefined, { error: true }),
      ]),
    ).toBe("mixed");
  });

  it("mixed when 0 speakers have a stance", () => {
    expect(
      computeConsensus([
        makeSpeaker("claude", undefined, { error: true }),
        makeSpeaker("gemini", undefined, { error: true }),
      ]),
    ).toBe("mixed");
  });
});

// ----------------------------------------------------------------------------
// runCouncil — 6 ケース網羅 (spec-003 task 8)
// ----------------------------------------------------------------------------

describe("runCouncil", () => {
  it("case (a) unanimous_agree: both providers return agree", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider(
        "claude",
        stanceJson("agree", "claude agrees"),
        "claude round 1 answer",
      ),
      gemini: mockOkProvider(
        "gemini",
        stanceJson("agree", "gemini agrees"),
        "gemini round 1 answer",
      ),
    });
    expect(transcript.consensus).toBe("unanimous_agree");
    expect(transcript.rounds).toHaveLength(2);

    // Round 1: ChatGPT + Claude + Gemini の 3 者独立回答
    const round1 = transcript.rounds[0];
    expect(round1.speakers).toHaveLength(3);
    expect(round1.speakers.find((s) => s.name === "chatgpt")?.content).toBe(
      baseInput.chatgpt_initial_answer,
    );
    expect(round1.speakers.find((s) => s.name === "claude")?.content).toBe(
      "claude round 1 answer",
    );
    expect(round1.speakers.find((s) => s.name === "gemini")?.content).toBe(
      "gemini round 1 answer",
    );

    // Round 2: Claude / Gemini の stance 表明
    const round2 = transcript.rounds[1];
    expect(round2.speakers).toHaveLength(2);
    expect(round2.speakers[0].stance).toBe("agree");
    expect(round2.speakers[0].content).toBe("claude agrees");
    expect(round2.speakers[1].stance).toBe("agree");
    expect(transcript.revision_prompt).toContain("改訂は原則不要");
  });

  it("case (b) mixed: one agree + one disagree", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", stanceJson("agree", "claude yes")),
      gemini: mockOkProvider("gemini", stanceJson("disagree", "gemini no")),
    });
    expect(transcript.consensus).toBe("mixed");
    expect(transcript.revision_prompt).toContain("3 者の Round 1 に不整合がある");
  });

  it("case (c) unanimous_disagree: both disagree", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", stanceJson("disagree", "c no")),
      gemini: mockOkProvider("gemini", stanceJson("disagree", "g no")),
    });
    expect(transcript.consensus).toBe("unanimous_disagree");
    expect(transcript.revision_prompt).toContain("根本から書き直し");
  });

  it("case (d) 部分失敗: gemini が Round 1 で error → Round 2 が skip されて mixed", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", stanceJson("agree", "claude ok")),
      gemini: mockErrorProvider("gemini", "unauthenticated", "no key"),
    });
    expect(transcript.consensus).toBe("mixed");

    // Round 1: gemini は provider error、claude は独立回答を取得できている
    const round1 = transcript.rounds[0];
    const geminiR1 = round1.speakers.find((s) => s.name === "gemini")!;
    const claudeR1 = round1.speakers.find((s) => s.name === "claude")!;
    expect(geminiR1.error?.code).toBe("unauthenticated");
    expect(geminiR1.content).toBeUndefined();
    expect(claudeR1.error).toBeUndefined();
    expect(claudeR1.content).toBeDefined();

    // Round 2: gemini は Round 1 failure により skip、claude は stance 表明済み
    const round2 = transcript.rounds[1];
    const claudeR2 = round2.speakers.find((s) => s.name === "claude")!;
    const geminiR2 = round2.speakers.find((s) => s.name === "gemini")!;
    expect(claudeR2.stance).toBe("agree");
    expect(claudeR2.error).toBeUndefined();
    expect(geminiR2.stance).toBeUndefined();
    expect(geminiR2.error?.code).toBe("round1_failed");

    // revision_prompt は利用可能な speaker (claude) のみを引用する
    expect(transcript.revision_prompt).toContain("Claude");
    expect(transcript.revision_prompt).toContain("claude ok");
  });

  it("case (e) 両方 Round 1 で失敗: Round 2 は両方 round1_failed で skip", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockErrorProvider("claude", "rate_limited", "429"),
      gemini: mockErrorProvider("gemini", "network_error", "ECONNRESET"),
    });
    expect(transcript.consensus).toBe("mixed");

    const round1 = transcript.rounds[0];
    expect(round1.speakers.find((s) => s.name === "chatgpt")?.error).toBeUndefined();
    expect(round1.speakers.find((s) => s.name === "claude")?.error?.code).toBe("rate_limited");
    expect(round1.speakers.find((s) => s.name === "gemini")?.error?.code).toBe("network_error");

    const round2Speakers = transcript.rounds[1].speakers;
    expect(round2Speakers.every((s) => s.stance === undefined)).toBe(true);
    expect(round2Speakers.every((s) => s.error?.code === "round1_failed")).toBe(true);

    // revision_prompt は 0 speakers の場合に fallback 文言を出す
    expect(transcript.revision_prompt).toContain("(Round 2 の有効な発言はありませんでした)");
  });

  it("case (e2) Round 1 ok + Round 2 provider error: Round 2 は provider error を保持", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockRound2ErrorProvider("claude", "rate_limited", "429"),
      gemini: mockRound2ErrorProvider("gemini", "network_error", "ECONNRESET"),
    });
    expect(transcript.consensus).toBe("mixed");

    const round1 = transcript.rounds[0];
    expect(round1.speakers.find((s) => s.name === "claude")?.error).toBeUndefined();
    expect(round1.speakers.find((s) => s.name === "claude")?.content).toBeDefined();
    expect(round1.speakers.find((s) => s.name === "gemini")?.error).toBeUndefined();

    const round2Speakers = transcript.rounds[1].speakers;
    expect(round2Speakers.find((s) => s.name === "claude")?.error?.code).toBe("rate_limited");
    expect(round2Speakers.find((s) => s.name === "gemini")?.error?.code).toBe("network_error");
    expect(round2Speakers.every((s) => s.stance === undefined)).toBe(true);
  });

  it("case (f) stance parse 失敗: provider returned text but it's not parseable JSON", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", "I agree without stance field"),
      gemini: mockOkProvider("gemini", stanceJson("agree", "gemini ok")),
    });
    expect(transcript.consensus).toBe("mixed"); // 1 人しか stance を持たない

    const claudeSpeaker = transcript.rounds[1].speakers.find((s) => s.name === "claude")!;
    const geminiSpeaker = transcript.rounds[1].speakers.find((s) => s.name === "gemini")!;
    expect(claudeSpeaker.stance).toBeUndefined();
    expect(claudeSpeaker.error?.code).toBe("invalid_response");
    expect(claudeSpeaker.content).toBe("I agree without stance field"); // 原文保持
    expect(geminiSpeaker.stance).toBe("agree");
  });

  it("handles rejected promises via settledToSpeaker (Round 1 network throw)", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockThrowingProvider("claude", new Error("boom")),
      gemini: mockOkProvider("gemini", stanceJson("agree", "g ok")),
    });

    // Round 1: Claude の throw を settledToSpeaker が拾って network_error として記録
    const claudeR1 = transcript.rounds[0].speakers.find((s) => s.name === "claude")!;
    expect(claudeR1.error?.code).toBe("network_error");
    expect(claudeR1.error?.message).toBe("boom");

    // Round 2: Round 1 が失敗したので skip (round1_failed)
    const claudeR2 = transcript.rounds[1].speakers.find((s) => s.name === "claude")!;
    expect(claudeR2.error?.code).toBe("round1_failed");
    expect(transcript.consensus).toBe("mixed");
  });

  it("total_latency_ms is set to a non-negative number", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", stanceJson("agree", "x")),
      gemini: mockOkProvider("gemini", stanceJson("agree", "y")),
    });
    expect(typeof transcript.total_latency_ms).toBe("number");
    expect(transcript.total_latency_ms).toBeGreaterThanOrEqual(0);
  });
});

// ----------------------------------------------------------------------------
// buildRevisionPrompt (3 consensus branches) — quick sanity
// ----------------------------------------------------------------------------

describe("buildRevisionPrompt", () => {
  it("unanimous_agree: header says 改訂不要, still quotes round 2", () => {
    const t = makeTranscript("unanimous_agree", [
      { name: "claude", stance: "extend", content: "補足視点 A" },
      { name: "gemini", stance: "agree", content: "同意 B" },
    ]);
    const prompt = buildRevisionPrompt(t, "unanimous_agree");
    expect(prompt).toContain("改訂は原則不要");
    expect(prompt).toContain("補足視点 A");
    expect(prompt).toContain("同意 B");
  });

  it("mixed: header says 3 者の Round 1 に不整合がある + 意見が割れた", () => {
    const t = makeTranscript("mixed", [
      { name: "claude", stance: "agree", content: "yes" },
      { name: "gemini", stance: "partial", content: "half" },
    ]);
    const prompt = buildRevisionPrompt(t, "mixed");
    expect(prompt).toContain("3 者の Round 1 に不整合がある");
    expect(prompt).toContain("見解が分かれました");
  });

  it("includes all 3 Round 1 quotes in the revision prompt", () => {
    const t = makeTranscript("unanimous_agree", [
      { name: "claude", stance: "agree", content: "r2 claude reason" },
      { name: "gemini", stance: "agree", content: "r2 gemini reason" },
    ]);
    const prompt = buildRevisionPrompt(t, "unanimous_agree");
    expect(prompt).toContain("【ChatGPT の Round 1】");
    expect(prompt).toContain("【Claude の Round 1】");
    expect(prompt).toContain("【Gemini の Round 1】");
    expect(prompt).toContain("claude round 1");
    expect(prompt).toContain("gemini round 1");
  });

  it("marks failed Round 1 speakers as 回答取得失敗", () => {
    const t = makeTranscript(
      "mixed",
      [
        { name: "claude", stance: "agree", content: "ok" },
        { name: "gemini", error: { code: "round1_failed", message: "skipped" } },
      ],
      {
        gemini: {
          name: "gemini",
          error: { code: "network_error", message: "down" },
        },
      },
    );
    const prompt = buildRevisionPrompt(t, "mixed");
    expect(prompt).toContain("【Gemini の Round 1】(回答取得失敗)");
    expect(prompt).toContain("claude round 1");
  });

  it("unanimous_disagree: header says 根本から書き直し", () => {
    const t = makeTranscript("unanimous_disagree", [
      { name: "claude", stance: "disagree", content: "no" },
      { name: "gemini", stance: "disagree", content: "nope" },
    ]);
    expect(buildRevisionPrompt(t, "unanimous_disagree")).toContain("根本から書き直し");
  });
});

describe("summarizeCouncilFailure", () => {
  it("collects round 2 provider errors into structuredContent.error payload", () => {
    const transcript = makeTranscript("mixed", [
      { name: "claude", error: { code: "rate_limited", message: "429" } },
      { name: "gemini", error: { code: "network_error", message: "ECONNRESET" } },
    ]);

    expect(summarizeCouncilFailure(transcript)).toEqual({
      code: "all_providers_failed",
      message: "Round 2 failed for all providers (Claude=rate_limited, Gemini=network_error).",
      providers: [
        { name: "claude", error: { code: "rate_limited", message: "429" } },
        { name: "gemini", error: { code: "network_error", message: "ECONNRESET" } },
      ],
    });
  });
});
