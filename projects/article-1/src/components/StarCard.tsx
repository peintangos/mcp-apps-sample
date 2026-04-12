export function StarCard({ stars }: { stars: number }) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          color: "#64748b",
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
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {stars.toLocaleString()}
      </div>
    </div>
  );
}
