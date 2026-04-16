import type { ReactNode } from "react";
import { useColors } from "../main.js";
import type { CouncilStructured } from "../ui-router.js";
import { ConsensusBadge } from "./ConsensusBadge.js";
import { SpeakerCard } from "./SpeakerCard.js";
import { RevisionFooter } from "./RevisionFooter.js";

export type RoundTimelineProps = {
  transcript: CouncilStructured | null;
  isLoading?: boolean;
};

const COUNCIL_COLOR = "#b45309";

export function RoundTimeline({ transcript, isLoading }: RoundTimelineProps) {
  const colors = useColors();
  const round1 = transcript?.rounds.find((r) => r.label === "round_1");
  const round2 = transcript?.rounds.find((r) => r.label === "round_2");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Consensus Badge */}
      <ConsensusBadge
        consensus={transcript?.consensus ?? null}
        round2Speakers={round2?.speakers}
        isLoading={isLoading && !transcript}
      />

      {/* Round 1: ChatGPT Initial Answer */}
      <RoundSection
        label="Round 1"
        subtitle="ChatGPT の初案"
        isLoading={isLoading && !round1}
      >
        {round1 ? (
          round1.speakers.map((speaker) => (
            <SpeakerCard
              key={speaker.name}
              speaker={speaker}
              showStance={false}
            />
          ))
        ) : isLoading ? (
          <SkeletonCard />
        ) : null}
      </RoundSection>

      {/* Round 2: Independent Evaluations (2-column responsive) */}
      <RoundSection
        label="Round 2"
        subtitle="独立評価"
        isLoading={isLoading && !round2}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            gap: "0.75rem",
          }}
        >
          {round2 ? (
            round2.speakers.map((speaker) => (
              <SpeakerCard
                key={speaker.name}
                speaker={speaker}
                showStance
              />
            ))
          ) : isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : null}
        </div>
      </RoundSection>

      {/* Total Latency */}
      {transcript && (
        <div
          style={{
            textAlign: "right",
            fontSize: "0.6875rem",
            color: colors.textMuted,
            fontFamily:
              "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
          }}
        >
          Total: {transcript.total_latency_ms}ms
        </div>
      )}

      {/* Revision Footer */}
      {transcript && <RevisionFooter consensus={transcript.consensus} />}
    </div>
  );
}

function RoundSection({
  label,
  subtitle,
  isLoading,
  children,
}: {
  label: string;
  subtitle: string;
  isLoading?: boolean;
  children: ReactNode;
}) {
  const colors = useColors();

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "0.75rem",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COUNCIL_COLOR,
          }}
        >
          {label}
        </h3>
        <span style={{ fontSize: "0.6875rem", color: colors.textMuted }}>
          {subtitle}
        </span>
        {isLoading && (
          <span
            style={{
              fontSize: "0.625rem",
              color: colors.textMuted,
              fontStyle: "italic",
            }}
          >
            — pending
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function SkeletonCard() {
  const colors = useColors();

  return (
    <div
      style={{
        padding: "1rem",
        background: colors.surfaceAlt,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          height: "0.875rem",
          width: "40%",
          background: colors.border,
          borderRadius: "0.25rem",
        }}
      />
      <div
        style={{
          height: "0.75rem",
          width: "80%",
          background: colors.border,
          borderRadius: "0.25rem",
        }}
      />
      <div
        style={{
          height: "0.75rem",
          width: "60%",
          background: colors.border,
          borderRadius: "0.25rem",
        }}
      />
    </div>
  );
}
