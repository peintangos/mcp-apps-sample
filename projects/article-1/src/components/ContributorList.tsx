type Contributor = {
  login: string;
  avatarUrl: string;
  contributions: number;
};

export function ContributorList({ contributors }: { contributors: Contributor[] }) {
  if (contributors.length === 0) {
    return (
      <div style={{ padding: "1rem", color: "#94a3b8", textAlign: "center" }}>
        No contributors
      </div>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {contributors.map((c) => (
        <li
          key={c.login}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.625rem 0",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <img
            src={c.avatarUrl}
            alt={`${c.login} avatar`}
            width={32}
            height={32}
            style={{ borderRadius: "50%", flexShrink: 0 }}
            loading="lazy"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: "#0f172a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.login}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {c.contributions.toLocaleString()} contributions
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
