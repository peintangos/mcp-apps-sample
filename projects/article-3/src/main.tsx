import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type Status = "connecting" | "connected" | "error";

function AskClaudeApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);

  const { isConnected, error } = useApp({
    appInfo: { name: "article-3-claude-second-opinion", version: "0.0.1" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = () => {
        setToolResult(null);
      };
      app.ontoolresult = (params) => {
        setToolResult(params);
      };
    },
  });

  const status: Status = error
    ? "error"
    : isConnected
      ? "connected"
      : "connecting";

  const structured = toolResult?.structuredContent as
    | {
        question?: string;
        chatgpt_answer?: string | null;
        claude_answer?: string;
        model_used?: string;
        latency_ms?: number;
        placeholder?: boolean;
      }
    | undefined;

  return (
    <main
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', sans-serif",
        padding: "1.5rem",
        color: "#0f172a",
        maxWidth: "40rem",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>
            ask_claude (spec-001 placeholder)
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "#64748b",
              fontSize: "0.75rem",
            }}
          >
            Article 3 — ChatGPT × Claude Second Opinion
          </p>
        </div>
        <StatusBadge status={status} />
      </header>

      {structured ? (
        <section
          aria-label="Placeholder result"
          style={{
            padding: "1.25rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
            question
          </div>
          <div
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
              wordBreak: "break-all",
            }}
          >
            {structured.question ?? "(none)"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
            placeholder answer
          </div>
          <div
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
              color: "#1e293b",
              wordBreak: "break-all",
            }}
          >
            {structured.claude_answer ?? "(none)"}
          </div>
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.75rem",
              color: "#94a3b8",
            }}
          >
            model: {structured.model_used ?? "sonnet"} · latency:{" "}
            {structured.latency_ms ?? 0} ms
            {structured.placeholder ? " · placeholder: true" : ""}
          </div>
        </section>
      ) : (
        <section
          aria-label="Waiting"
          style={{
            padding: "1.25rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          {error ? `Error: ${error.message}` : "Waiting for a tool call…"}
        </section>
      )}

      <footer
        style={{
          marginTop: "1.5rem",
          color: "#94a3b8",
          fontSize: "0.75rem",
        }}
      >
        Replaced in spec-003 by the side-by-side comparison view.
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
      <AskClaudeApp />
    </StrictMode>,
  );
}
