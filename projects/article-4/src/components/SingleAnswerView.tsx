import { AnswerColumn } from "./AnswerColumn.js";
import { useColors } from "../main.js";
import type { SingleAnswerStructured } from "../ui-router.js";

export type SingleAnswerProvider = "claude" | "gemini";

export type SingleAnswerViewModel = {
  label: string;
  labelColor: string;
  labelStrongColor: string;
  question: string;
  content: string | null;
  errorMessage?: string;
  meta: {
    model?: string;
    latencyMs?: number;
  };
};

const CLAUDE_COLOR = "#d97757";
const CLAUDE_COLOR_STRONG = "#c85a34";
const GEMINI_COLOR = "#2f6fed";
const GEMINI_COLOR_STRONG = "#1d4ed8";

export function buildSingleAnswerViewModel(args: {
  provider: SingleAnswerProvider;
  structured?: SingleAnswerStructured;
  pendingQuestion?: string;
}): SingleAnswerViewModel {
  const { provider, structured, pendingQuestion } = args;
  const isClaude = provider === "claude";
  const errorMessage = structured?.error
    ? `${structured.error.code}: ${structured.error.message}`
    : undefined;

  return {
    label: isClaude ? "Claude" : "Gemini",
    labelColor: isClaude ? CLAUDE_COLOR : GEMINI_COLOR,
    labelStrongColor: isClaude ? CLAUDE_COLOR_STRONG : GEMINI_COLOR_STRONG,
    question: structured?.question ?? pendingQuestion ?? "",
    content: errorMessage
      ? null
      : isClaude
        ? structured?.claude_answer ?? null
        : structured?.gemini_answer ?? null,
    errorMessage,
    meta: {
      model: structured?.model_used,
      latencyMs: structured?.latency_ms,
    },
  };
}

export function SingleAnswerView({
  provider,
  structured,
  pendingQuestion,
  isLoading,
}: {
  provider: SingleAnswerProvider;
  structured?: SingleAnswerStructured;
  pendingQuestion?: string;
  isLoading?: boolean;
}) {
  const colors = useColors();
  const viewModel = buildSingleAnswerViewModel({
    provider,
    structured,
    pendingQuestion,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {viewModel.question ? (
        <section
          aria-label="Question"
          style={{
            padding: "0.875rem 1rem",
            background: colors.claudeSoftBg,
            border: `1px solid ${viewModel.labelColor}`,
            borderLeft: `4px solid ${viewModel.labelColor}`,
            borderRadius: "0.5rem",
          }}
        >
          <div
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: viewModel.labelStrongColor,
              marginBottom: "0.25rem",
            }}
          >
            Question
          </div>
          <div style={{ fontSize: "0.9375rem", color: colors.text }}>
            {viewModel.question}
          </div>
        </section>
      ) : null}

      <AnswerColumn
        label={viewModel.label}
        labelColor={viewModel.labelColor}
        content={viewModel.content}
        meta={viewModel.meta}
        isLoading={isLoading}
        errorMessage={viewModel.errorMessage}
      />
    </div>
  );
}
