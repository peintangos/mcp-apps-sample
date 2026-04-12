import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

type Status = "connecting" | "connected" | "error";

function HelloTimeApp() {
  const [time, setTime] = useState<string | null>(null);

  const { isConnected, error } = useApp({
    appInfo: { name: "article-1-github-dashboard", version: "0.0.1" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (params) => {
        const textBlock = params.content?.find(
          (block): block is { type: "text"; text: string } =>
            block.type === "text",
        );
        if (textBlock) {
          setTime(textBlock.text);
        }
      };
    },
  });

  const status: Status = error ? "error" : isConnected ? "connected" : "connecting";

  return (
    <main
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', sans-serif",
        padding: "2rem",
        color: "#0f172a",
        maxWidth: "32rem",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>hello_time</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
          spec-001 minimal MCP Apps round-trip
        </p>
      </header>

      <section
        aria-label="Tool result"
        style={{
          padding: "1.5rem",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
        }}
      >
        <StatusBadge status={status} />
        <div
          style={{
            marginTop: "1rem",
            fontFamily:
              "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
            fontSize: "1.25rem",
            color: "#1e293b",
            wordBreak: "break-all",
          }}
        >
          {error
            ? `Error: ${error.message}`
            : time
              ? time
              : "Waiting for tool result…"}
        </div>
      </section>

      <footer style={{ marginTop: "1.5rem", color: "#94a3b8", fontSize: "0.75rem" }}>
        Replaced in spec-003 by the GitHub dashboard.
      </footer>
    </main>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const config = {
    connecting: { label: "Connecting…", color: "#94a3b8", bg: "#f1f5f9" },
    connected: { label: "Connected", color: "#15803d", bg: "#dcfce7" },
    error: { label: "Error", color: "#b91c1c", bg: "#fee2e2" },
  }[status];

  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.625rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: config.color,
        background: config.bg,
      }}
    >
      {config.label}
    </span>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <HelloTimeApp />
    </StrictMode>,
  );
}
