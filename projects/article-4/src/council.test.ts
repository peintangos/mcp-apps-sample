/**
 * Unit tests for council.ts — spec-003 task 6-8 を網羅する。
 *
 * テスト戦略:
 *   - vitest のモック API (`vi.mock`) を使わず、`ProviderClient` interface を
 *     満たす plain object を手で作って runCouncil() に渡す。ProviderClient を
 *     loose generic で設計した恩恵をここで回収する。
 *   - parseStanceResponse の単体テストも同梱し、council.ts の挙動契約の
 *     single source of truth にする。
 *
 * カバー対象の spec-003 Implementation Steps:
 *   - task 6: Round 2 部分失敗 (片方 OK / 片方 error) でも合議継続
 *   - task 7: Round 2 両方失敗ケース (`isError` 相当は handler 側、ここでは
 *     transcript が allFailed 状態になることを検証)
 *   - task 8: consensus 3 分岐 + 部分失敗 + stance parse 失敗 の 6 ケース
 */

import { describe, it, expect } from "vitest";
import {
  runCouncil,
  computeConsensus,
  parseStanceResponse,
  buildRevisionPrompt,
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

/** Returns a ProviderClient that always resolves to a successful text response. */
function mockOkProvider(
  name: "claude" | "gemini",
  text: string,
  modelUsed = `${name}-mock`,
): ProviderClient {
  return {
    name,
    ask: async (_q: string, _o?: AskOptions): Promise<Result<ProviderResponse>> => ({
      ok: true,
      data: { text, modelUsed, latencyMs: 10 },
    }),
  };
}

/** Returns a ProviderClient that always resolves to an error Result. */
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

/** Returns a ProviderClient whose `ask()` throws (simulates network reject). */
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
      claude: mockOkProvider("claude", stanceJson("agree", "claude agrees")),
      gemini: mockOkProvider("gemini", stanceJson("agree", "gemini agrees")),
    });
    expect(transcript.consensus).toBe("unanimous_agree");
    expect(transcript.rounds).toHaveLength(2);
    expect(transcript.rounds[0].speakers[0].name).toBe("chatgpt");
    expect(transcript.rounds[0].speakers[0].content).toBe(baseInput.chatgpt_initial_answer);
    expect(transcript.rounds[1].speakers[0].stance).toBe("agree");
    expect(transcript.rounds[1].speakers[0].content).toBe("claude agrees");
    expect(transcript.rounds[1].speakers[1].stance).toBe("agree");
    expect(transcript.revision_prompt).toContain("改訂は原則不要");
  });

  it("case (b) mixed: one agree + one disagree", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", stanceJson("agree", "claude yes")),
      gemini: mockOkProvider("gemini", stanceJson("disagree", "gemini no")),
    });
    expect(transcript.consensus).toBe("mixed");
    expect(transcript.revision_prompt).toContain("意見が割れた");
  });

  it("case (c) unanimous_disagree: both disagree", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", stanceJson("disagree", "c no")),
      gemini: mockOkProvider("gemini", stanceJson("disagree", "g no")),
    });
    expect(transcript.consensus).toBe("unanimous_disagree");
    expect(transcript.revision_prompt).toContain("根本から書き直し");
  });

  it("case (d) 部分失敗: claude ok + gemini error → mixed (1 人だけでは unanimous を名乗らない)", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockOkProvider("claude", stanceJson("agree", "claude ok")),
      gemini: mockErrorProvider("gemini", "unauthenticated", "no key"),
    });
    expect(transcript.consensus).toBe("mixed");

    const round2 = transcript.rounds[1];
    const claudeSpeaker = round2.speakers.find((s) => s.name === "claude")!;
    const geminiSpeaker = round2.speakers.find((s) => s.name === "gemini")!;
    expect(claudeSpeaker.stance).toBe("agree");
    expect(claudeSpeaker.error).toBeUndefined();
    expect(geminiSpeaker.stance).toBeUndefined();
    expect(geminiSpeaker.error?.code).toBe("unauthenticated");

    // revision_prompt は利用可能な speaker (claude) のみを引用する
    expect(transcript.revision_prompt).toContain("Claude");
    expect(transcript.revision_prompt).toContain("claude ok");
  });

  it("case (e) 両方失敗: both providers error → consensus=mixed, both speakers have error, no stance", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockErrorProvider("claude", "rate_limited", "429"),
      gemini: mockErrorProvider("gemini", "network_error", "ECONNRESET"),
    });
    expect(transcript.consensus).toBe("mixed");

    const providerSpeakers = transcript.rounds[1].speakers;
    expect(providerSpeakers.every((s) => s.stance === undefined)).toBe(true);
    expect(providerSpeakers.every((s) => s.error !== undefined)).toBe(true);
    expect(providerSpeakers.find((s) => s.name === "claude")?.error?.code).toBe("rate_limited");
    expect(providerSpeakers.find((s) => s.name === "gemini")?.error?.code).toBe("network_error");

    // revision_prompt は 0 speakers の場合に fallback 文言を出す
    expect(transcript.revision_prompt).toContain("(Round 2 の有効な発言はありませんでした)");
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

  it("handles rejected promises via settledToSpeaker (network throw)", async () => {
    const transcript = await runCouncil(baseInput, {
      claude: mockThrowingProvider("claude", new Error("boom")),
      gemini: mockOkProvider("gemini", stanceJson("agree", "g ok")),
    });

    const claudeSpeaker = transcript.rounds[1].speakers.find((s) => s.name === "claude")!;
    expect(claudeSpeaker.error?.code).toBe("network_error");
    expect(claudeSpeaker.error?.message).toBe("boom");
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
  function makeTranscript(
    consensus: CouncilTranscript["consensus"],
    speakers: Speaker[],
  ): CouncilTranscript {
    return {
      ...baseInput,
      rounds: [
        { label: "round_1", speakers: [{ name: "chatgpt", content: baseInput.chatgpt_initial_answer }] },
        { label: "round_2", speakers },
      ],
      consensus,
      revision_prompt: "",
      total_latency_ms: 0,
    };
  }

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

  it("mixed: header says 意見が割れた", () => {
    const t = makeTranscript("mixed", [
      { name: "claude", stance: "agree", content: "yes" },
      { name: "gemini", stance: "partial", content: "half" },
    ]);
    expect(buildRevisionPrompt(t, "mixed")).toContain("意見が割れた");
  });

  it("unanimous_disagree: header says 根本から書き直し", () => {
    const t = makeTranscript("unanimous_disagree", [
      { name: "claude", stance: "disagree", content: "no" },
      { name: "gemini", stance: "disagree", content: "nope" },
    ]);
    expect(buildRevisionPrompt(t, "unanimous_disagree")).toContain("根本から書き直し");
  });
});
