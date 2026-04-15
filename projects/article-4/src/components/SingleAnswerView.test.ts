import { describe, expect, it } from "vitest";
import { buildSingleAnswerViewModel } from "./SingleAnswerView.js";

describe("buildSingleAnswerViewModel", () => {
  it("maps Claude structured content to the Claude presentation", () => {
    expect(
      buildSingleAnswerViewModel({
        provider: "claude",
        structured: {
          question: "Rust か Go か",
          claude_answer: "Go を勧めます",
          model_used: "claude-sonnet-4-6",
          latency_ms: 1234,
        },
      }),
    ).toMatchObject({
      label: "Claude",
      question: "Rust か Go か",
      content: "Go を勧めます",
      meta: {
        model: "claude-sonnet-4-6",
        latencyMs: 1234,
      },
    });
  });

  it("maps Gemini structured content to the Gemini presentation", () => {
    expect(
      buildSingleAnswerViewModel({
        provider: "gemini",
        structured: {
          question: "Gemini の強みは？",
          gemini_answer: "Google 連携です",
          model_used: "gemini-2.5-flash",
        },
      }),
    ).toMatchObject({
      label: "Gemini",
      question: "Gemini の強みは？",
      content: "Google 連携です",
      meta: {
        model: "gemini-2.5-flash",
      },
    });
  });

  it("keeps the pending question during loading", () => {
    expect(
      buildSingleAnswerViewModel({
        provider: "gemini",
        pendingQuestion: "まだ結果がない質問",
      }).question,
    ).toBe("まだ結果がない質問");
  });

  it("formats provider errors and suppresses content", () => {
    const viewModel = buildSingleAnswerViewModel({
      provider: "claude",
      structured: {
        question: "X",
        claude_answer: "should be hidden",
        error: {
          code: "unauthenticated",
          message: "missing key",
        },
      },
    });

    expect(viewModel.errorMessage).toBe("unauthenticated: missing key");
    expect(viewModel.content).toBeNull();
  });
});
