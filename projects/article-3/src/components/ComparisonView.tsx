import { AnswerColumn } from "./AnswerColumn.js";
import { useColors } from "../main.js";

// ブランドカラー: ChatGPT は OpenAI 緑、Claude は Anthropic オレンジ系
const CHATGPT_COLOR = "#10a37f";
const CLAUDE_COLOR = "#d97757";

export type ComparisonViewProps = {
  question: string;
  chatgptAnswer: string | null;
  claudeAnswer: string | null;
  claudeMeta?: { model?: string; latencyMs?: number };
  isLoading?: boolean;
  claudeError?: { code: string; message: string };
};

export function ComparisonView({
  question,
  chatgptAnswer,
  claudeAnswer,
  claudeMeta,
  isLoading,
  claudeError,
}: ComparisonViewProps) {
  const colors = useColors();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <section
        aria-label="Question"
        style={{
          padding: "0.875rem 1rem",
          background: colors.surfaceAlt,
          border: `1px dashed ${colors.border}`,
          borderRadius: "0.75rem",
        }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: colors.textMuted,
            marginBottom: "0.25rem",
          }}
        >
          Question
        </div>
        <div style={{ fontSize: "0.9375rem", color: colors.text }}>
          {question}
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        <AnswerColumn
          label="ChatGPT"
          labelColor={CHATGPT_COLOR}
          content={chatgptAnswer}
          placeholderMessage={
            chatgptAnswer === null
              ? "ChatGPT の回答を tool call の chatgpt_answer 引数で渡してください。basic-host で試す場合は、手動で入力してください。"
              : undefined
          }
        />
        <AnswerColumn
          label="Claude"
          labelColor={CLAUDE_COLOR}
          content={claudeError ? null : claudeAnswer}
          meta={claudeMeta}
          isLoading={isLoading}
          errorMessage={
            claudeError
              ? `${claudeError.code}: ${claudeError.message}`
              : undefined
          }
        />
      </div>
    </div>
  );
}
