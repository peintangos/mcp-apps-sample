import { useColors } from "../main.js";

export function StarCard({ stars }: { stars: number }) {
  const colors = useColors();
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
        }}
      >
        ⭐ Stars
      </div>
      <div
        style={{
          fontSize: "1.875rem",
          fontWeight: 700,
          color: colors.text,
          lineHeight: 1.1,
        }}
      >
        {stars.toLocaleString()}
      </div>
    </div>
  );
}
