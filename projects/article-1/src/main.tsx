import { createContext, StrictMode, useContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AnalyzeRepoResult } from "./github.js";
import { LanguageDonut } from "./components/LanguageDonut.js";
import { StarCard } from "./components/StarCard.js";
import { ContributorList } from "./components/ContributorList.js";

type Status = "connecting" | "connected" | "error";

export type ColorPalette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  badgeConnectingColor: string;
  badgeConnectingBg: string;
  badgeConnectedColor: string;
  badgeConnectedBg: string;
  badgeErrorColor: string;
  badgeErrorBg: string;
  tooltipBg: string;
  tooltipBorder: string;
};

const LIGHT_PALETTE: ColorPalette = {
  bg: "#ffffff",
  surface: "#f8fafc",
  surfaceAlt: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  errorText: "#7f1d1d",
  badgeConnectingColor: "#94a3b8",
  badgeConnectingBg: "#f1f5f9",
  badgeConnectedColor: "#15803d",
  badgeConnectedBg: "#dcfce7",
  badgeErrorColor: "#b91c1c",
  badgeErrorBg: "#fee2e2",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
};

const DARK_PALETTE: ColorPalette = {
  bg: "#0f172a",
  surface: "#1e293b",
  surfaceAlt: "#111827",
  border: "#334155",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  errorBg: "#450a0a",
  errorBorder: "#7f1d1d",
  errorText: "#fecaca",
  badgeConnectingColor: "#94a3b8",
  badgeConnectingBg: "#1e293b",
  badgeConnectedColor: "#4ade80",
  badgeConnectedBg: "#14532d",
  badgeErrorColor: "#fca5a5",
  badgeErrorBg: "#7f1d1d",
  tooltipBg: "#1e293b",
  tooltipBorder: "#334155",
};

const ThemeContext = createContext<ColorPalette>(LIGHT_PALETTE);

export function useColors(): ColorPalette {
  return useContext(ThemeContext);
}

function AppRouter() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  const { app, isConnected, error } = useApp({
    appInfo: { name: "article-1-github-dashboard", version: "0.0.1" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = () => {
        setToolResult(null);
      };
      app.ontoolresult = (params) => {
        setToolResult(params);
      };
      app.onhostcontextchanged = (ctx) => {
        if (ctx.theme === "light" || ctx.theme === "dark") {
          setTheme(ctx.theme);
        }
      };
    },
  });

  useEffect(() => {
    if (app && isConnected) {
      const ctx = app.getHostContext();
      if (ctx?.theme === "light" || ctx?.theme === "dark") {
        setTheme(ctx.theme);
      }
    }
  }, [app, isConnected]);

  const status: Status = error ? "error" : isConnected ? "connected" : "connecting";
  const isDashboardResult =
    toolResult !== null && isAnalyzeRepoResult(toolResult.structuredContent);

  return (
    <ThemeContext.Provider value={palette}>
      <div style={{ minHeight: "100vh", background: palette.bg, transition: "background 150ms" }}>
        <main
          style={{
            fontFamily:
              "system-ui, -apple-system, 'Segoe UI', sans-serif",
            padding: "1.5rem",
            color: palette.text,
            maxWidth: "40rem",
            margin: "0 auto",
          }}
        >
          <Header status={status} isDashboard={isDashboardResult} />
          <Body status={status} toolResult={toolResult} error={error} />
        </main>
      </div>
    </ThemeContext.Provider>
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
  const colors = useColors();
  const title = isDashboard ? "GitHub Repository Dashboard" : "hello_time";
  const subtitle = isDashboard
    ? "spec-003 — powered by MCP Apps"
    : "spec-001 minimal MCP Apps round-trip";

  return (
    <header style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.25rem", color: colors.text }}>{title}</h1>
        <p style={{ margin: "0.25rem 0 0", color: colors.textMuted, fontSize: "0.75rem" }}>
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
  const colors = useColors();

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
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        fontSize: "1rem",
        color: colors.text,
        wordBreak: "break-all",
      }}
    >
      {text}
    </div>
  );
}

function AnalyzeRepoView({ data }: { data: AnalyzeRepoResult }) {
  const colors = useColors();
  const cardStyle = {
    padding: "1rem",
    background: colors.surfaceAlt,
    border: `1px solid ${colors.border}`,
    borderRadius: "0.75rem",
  };
  const headingStyle = {
    margin: "0 0 0.5rem",
    fontSize: "0.875rem",
    color: colors.textMuted,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ fontSize: "0.875rem", color: colors.textMuted }}>
        <strong style={{ color: colors.text }}>
          {data.owner}/{data.repo}
        </strong>
      </div>
      <StarCard stars={data.stars} />
      <section style={cardStyle}>
        <h2 style={headingStyle}>Languages</h2>
        <LanguageDonut languages={data.languages} />
      </section>
      <section style={cardStyle}>
        <h2 style={headingStyle}>Top Contributors</h2>
        <ContributorList contributors={data.contributors} />
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const colors = useColors();
  const config = {
    connecting: { label: "Connecting…", color: colors.badgeConnectingColor, bg: colors.badgeConnectingBg },
    connected: { label: "Connected", color: colors.badgeConnectedColor, bg: colors.badgeConnectedBg },
    error: { label: "Error", color: colors.badgeErrorColor, bg: colors.badgeErrorBg },
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
  const colors = useColors();
  return (
    <div
      style={{
        padding: "1.25rem",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        color: colors.textMuted,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function ErrorCard({ title, message }: { title?: string; message: string }) {
  const colors = useColors();
  return (
    <div
      style={{
        padding: "1.25rem",
        background: colors.errorBg,
        border: `1px solid ${colors.errorBorder}`,
        borderRadius: "0.75rem",
        color: colors.errorText,
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
