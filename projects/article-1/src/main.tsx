import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AnalyzeRepoResult } from "./github.js";
import { LanguageDonut } from "./components/LanguageDonut.js";
import { StarCard } from "./components/StarCard.js";
import { ContributorList } from "./components/ContributorList.js";

type Status = "connecting" | "connected" | "error";

function AppRouter() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);

  const { isConnected, error } = useApp({
    appInfo: { name: "article-1-github-dashboard", version: "0.0.1" },
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

  const status: Status = error ? "error" : isConnected ? "connected" : "connecting";
  const isDashboardResult =
    toolResult !== null && isAnalyzeRepoResult(toolResult.structuredContent);

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
      <Header status={status} isDashboard={isDashboardResult} />
      <Body status={status} toolResult={toolResult} error={error} />
    </main>
  );
}

function isAnalyzeRepoResult(content: unknown): content is AnalyzeRepoResult {
  return (
    typeof content === "object" &&
    content !== null &&
    "stars" in content &&
    "languages" in content &&
    "contributors" in content
  );
}

function Header({ status, isDashboard }: { status: Status; isDashboard: boolean }) {
  const title = isDashboard ? "GitHub Repository Dashboard" : "hello_time";
  const subtitle = isDashboard
    ? "spec-003 — powered by MCP Apps"
    : "spec-001 minimal MCP Apps round-trip";

  return (
    <header style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.25rem" }}>{title}</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.75rem" }}>
          {subtitle}
        </p>
      </div>
      <StatusBadge status={status} />
    </header>
  );
}

function Body({
  status,
  toolResult,
  error,
}: {
  status: Status;
  toolResult: CallToolResult | null;
  error: Error | null;
}) {
  if (status === "error") {
    return <ErrorCard message={error?.message ?? "Unknown error"} />;
  }
  if (status === "connecting") {
    return <InfoCard text="Connecting to MCP host..." />;
  }
  if (toolResult === null) {
    return <InfoCard text="Waiting for a tool call..." />;
  }

  if (toolResult.isError) {
    const errPayload = (toolResult.structuredContent as { error?: { code: string; message: string } } | undefined)?.error;
    const fallbackText =
      toolResult.content?.find(
        (block): block is { type: "text"; text: string } => block.type === "text",
      )?.text ?? "Unknown error";
    return (
      <ErrorCard
        title={errPayload ? `GitHub: ${errPayload.code}` : "Tool error"}
        message={errPayload?.message ?? fallbackText}
      />
    );
  }

  if (isAnalyzeRepoResult(toolResult.structuredContent)) {
    return <AnalyzeRepoView data={toolResult.structuredContent} />;
  }

  // Default: hello_time or unknown tool — show raw text block
  const text =
    toolResult.content?.find(
      (block): block is { type: "text"; text: string } => block.type === "text",
    )?.text ?? "(no text)";
  return (
    <div
      style={{
        padding: "1.25rem",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "0.75rem",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        fontSize: "1rem",
        color: "#1e293b",
        wordBreak: "break-all",
      }}
    >
      {text}
    </div>
  );
}

function AnalyzeRepoView({ data }: { data: AnalyzeRepoResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ fontSize: "0.875rem", color: "#475569" }}>
        <strong>{data.owner}/{data.repo}</strong>
      </div>
      <StarCard stars={data.stars} />
      <section
        style={{
          padding: "1rem",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#475569" }}>
          Languages
        </h2>
        <LanguageDonut languages={data.languages} />
      </section>
      <section
        style={{
          padding: "1rem",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#475569" }}>
          Top Contributors
        </h2>
        <ContributorList contributors={data.contributors} />
      </section>
    </div>
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

function InfoCard({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "1.25rem",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "0.75rem",
        color: "#64748b",
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function ErrorCard({ title, message }: { title?: string; message: string }) {
  return (
    <div
      style={{
        padding: "1.25rem",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "0.75rem",
        color: "#7f1d1d",
      }}
    >
      {title && (
        <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{title}</div>
      )}
      <div style={{ fontSize: "0.875rem" }}>{message}</div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  );
}
