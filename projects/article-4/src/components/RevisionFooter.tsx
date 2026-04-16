import { useColors } from "../theme.js";
import type { CouncilStructured } from "../ui-router.js";

type Consensus = CouncilStructured["consensus"];

export type RevisionFooterProps = {
  consensus: Consensus;
};

const COUNCIL_COLOR = "#b45309";

export function RevisionFooter({ consensus }: RevisionFooterProps) {
  const colors = useColors();
  const isUnanimousAgree = consensus === "unanimous_agree";

  const message = isUnanimousAgree
    ? "全員同意を得ました。改訂は原則不要ですが、補足があれば下のチャットに 1–2 行で。"
    : "Round 3 — ChatGPT 改訂案は下のチャットメッセージに出力されます";

  return (
    <footer
      style={{
        padding: "0.75rem 1rem",
        background: colors.surfaceAlt,
        border: `1px solid ${COUNCIL_COLOR}33`,
        borderLeft: `4px solid ${COUNCIL_COLOR}`,
        borderRadius: "0.5rem",
        fontSize: "0.8125rem",
        color: colors.textMuted,
        lineHeight: 1.6,
      }}
    >
      <span
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: COUNCIL_COLOR,
          display: "block",
          marginBottom: "0.25rem",
        }}
      >
        {isUnanimousAgree ? "Consensus" : "Next Step"}
      </span>
      {message}
    </footer>
  );
}
