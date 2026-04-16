import { AnswerColumn } from "./AnswerColumn.js";
import type { CouncilStructured } from "../ui-router.js";

type Speaker = CouncilStructured["rounds"][number]["speakers"][number];
type Stance = NonNullable<Speaker["stance"]>;

export type SpeakerCardProps = {
  speaker: Speaker;
  showStance?: boolean;
};

const SPEAKER_DISPLAY: Record<
  Speaker["name"],
  { label: string; color: string }
> = {
  chatgpt: { label: "ChatGPT", color: "#10a37f" },
  claude: { label: "Claude", color: "#d97757" },
  gemini: { label: "Gemini", color: "#2f6fed" },
};

const STANCE_STYLE: Record<Stance, { label: string; color: string }> = {
  agree: { label: "agree", color: "#16a34a" },
  extend: { label: "extend", color: "#2563eb" },
  partial: { label: "partial", color: "#ca8a04" },
  disagree: { label: "disagree", color: "#dc2626" },
};

export function SpeakerCard({ speaker, showStance }: SpeakerCardProps) {
  const display = SPEAKER_DISPLAY[speaker.name];
  const errorMessage = speaker.error
    ? `${speaker.error.code}: ${speaker.error.message}`
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
      }}
    >
      {showStance && (
        <StanceTag stance={speaker.stance} hasError={!!speaker.error} />
      )}
      <AnswerColumn
        label={display.label}
        labelColor={display.color}
        content={speaker.content ?? null}
        errorMessage={errorMessage}
      />
    </div>
  );
}

function StanceTag({
  stance,
  hasError,
}: {
  stance?: Stance;
  hasError?: boolean;
}) {
  if (!stance && !hasError) return null;

  const style = stance
    ? STANCE_STYLE[stance]
    : { label: "未表明", color: "#6b7280" };

  return (
    <span
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem 0.625rem",
        borderRadius: "9999px",
        background: `${style.color}18`,
        color: style.color,
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      <span
        style={{
          width: "0.375rem",
          height: "0.375rem",
          borderRadius: "50%",
          background: style.color,
          flexShrink: 0,
        }}
      />
      {style.label}
    </span>
  );
}
