import { useColors } from "../main.js";
import type { CouncilStructured } from "../ui-router.js";

type Consensus = CouncilStructured["consensus"];
type Speaker = CouncilStructured["rounds"][number]["speakers"][number];
type Stance = NonNullable<Speaker["stance"]>;

export type ConsensusBadgeProps = {
  consensus: Consensus | null;
  round2Speakers?: Speaker[];
  isLoading?: boolean;
};

const CONSENSUS_STYLE: Record<
  Consensus,
  { label: string; color: string }
> = {
  unanimous_agree: { label: "Unanimous Agree", color: "#16a34a" },
  mixed: { label: "Mixed", color: "#ca8a04" },
  unanimous_disagree: { label: "Split (all disagree)", color: "#dc2626" },
};

function buildStanceSummary(speakers: Speaker[]): string {
  const counts: Partial<Record<Stance | "failed", number>> = {};
  for (const s of speakers) {
    if (s.error && !s.stance) {
      counts.failed = (counts.failed ?? 0) + 1;
    } else if (s.stance) {
      counts[s.stance] = (counts[s.stance] ?? 0) + 1;
    }
  }
  const parts: string[] = [];
  for (const key of [
    "agree",
    "extend",
    "partial",
    "disagree",
    "failed",
  ] as const) {
    const n = counts[key];
    if (n) parts.push(`${n} ${key}`);
  }
  return parts.length > 0 ? `(${parts.join(", ")})` : "";
}

export function ConsensusBadge({
  consensus,
  round2Speakers,
  isLoading,
}: ConsensusBadgeProps) {
  const colors = useColors();

  if (isLoading) {
    return (
      <div
        style={{
          padding: "0.75rem 1rem",
          background: colors.surfaceAlt,
          border: `1px solid ${colors.border}`,
          borderRadius: "0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: "0.75rem",
            height: "0.75rem",
            borderRadius: "50%",
            background: colors.border,
          }}
        />
        <div
          style={{
            height: "1rem",
            width: "10rem",
            background: colors.border,
            borderRadius: "0.25rem",
          }}
        />
      </div>
    );
  }

  if (!consensus) return null;

  const style = CONSENSUS_STYLE[consensus];
  const summary = round2Speakers
    ? buildStanceSummary(round2Speakers)
    : "";

  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        background: colors.surface,
        border: `2px solid ${style.color}44`,
        borderRadius: "0.75rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.25rem 0.75rem",
          borderRadius: "9999px",
          background: `${style.color}18`,
          color: style.color,
          fontSize: "0.8125rem",
          fontWeight: 700,
        }}
      >
        <span
          style={{
            width: "0.5rem",
            height: "0.5rem",
            borderRadius: "50%",
            background: style.color,
            flexShrink: 0,
          }}
        />
        {style.label}
      </span>
      {summary && (
        <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
          {summary}
        </span>
      )}
    </div>
  );
}
