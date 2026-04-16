import { describe, expect, it } from "vitest";
import {
  extractToolName,
  resolveToolView,
  type CouncilStructured,
} from "./ui-router.js";

describe("extractToolName", () => {
  it("reads direct name", () => {
    expect(extractToolName({ name: "ask_gemini" })).toBe("ask_gemini");
  });

  it("reads ext-apps meta tool_name", () => {
    expect(extractToolName({ _meta: { tool_name: "start_council" } })).toBe(
      "start_council",
    );
  });

  it("returns null for unknown payload", () => {
    expect(extractToolName({ name: "unknown_tool" })).toBeNull();
  });
});

describe("resolveToolView", () => {
  it("routes ask_claude result to the single-answer Claude view", () => {
    expect(
      resolveToolView({
        pendingToolName: null,
        toolResult: {
          structuredContent: { question: "X", claude_answer: "A" },
        } as never,
      }),
    ).toEqual({ kind: "single_answer", provider: "claude" });
  });

  it("routes ask_gemini result to the single-answer Gemini view", () => {
    expect(
      resolveToolView({
        pendingToolName: null,
        toolResult: {
          structuredContent: { question: "X", gemini_answer: "B" },
        } as never,
      }),
    ).toEqual({ kind: "single_answer", provider: "gemini" });
  });

  it("routes council transcripts to the council view", () => {
    const structured: CouncilStructured = {
      question: "X",
      chatgpt_initial_answer: "initial",
      rounds: [
        { label: "round_1", speakers: [{ name: "chatgpt", content: "initial" }] },
        { label: "round_2", speakers: [{ name: "claude", content: "reason", stance: "agree" }] },
      ],
      consensus: "mixed",
      revision_prompt: "revise",
      total_latency_ms: 1200,
    };

    expect(
      resolveToolView({
        pendingToolName: null,
        toolResult: { structuredContent: structured } as never,
      }),
    ).toEqual({ kind: "council" });
  });

  it("uses pending tool name while waiting for a result", () => {
    expect(
      resolveToolView({
        pendingToolName: "start_council",
        toolResult: null,
      }),
    ).toEqual({ kind: "council" });
  });

  it("keeps the pending single-answer provider when the result only has an error payload", () => {
    expect(
      resolveToolView({
        pendingToolName: "ask_gemini",
        toolResult: {
          structuredContent: {
            question: "X",
            error: { code: "unauthenticated", message: "missing key" },
          },
          isError: true,
        } as never,
      }),
    ).toEqual({ kind: "single_answer", provider: "gemini" });
  });

  it("falls back to unknown when neither result nor pending state is identifiable", () => {
    expect(
      resolveToolView({
        pendingToolName: null,
        toolResult: {
          structuredContent: { hello: "world" },
        } as never,
      }),
    ).toEqual({ kind: "unknown" });
  });
});
