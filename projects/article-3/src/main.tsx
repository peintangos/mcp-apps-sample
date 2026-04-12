import {
  createContext,
  StrictMode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ComparisonView } from "./components/ComparisonView.js";

type Status = "connecting" | "connected" | "error";

export type ColorPalette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  codeBg: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  badgeConnectingColor: string;
  badgeConnectingBg: string;
  badgeConnectedColor: string;
  badgeConnectedBg: string;
  badgeErrorColor: string;
  badgeErrorBg: string;
};

const LIGHT_PALETTE: ColorPalette = {
  bg: "#ffffff",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  codeBg: "#f1f5f9",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  errorText: "#7f1d1d",
  badgeConnectingColor: "#94a3b8",
  badgeConnectingBg: "#f1f5f9",
  badgeConnectedColor: "#15803d",
  badgeConnectedBg: "#dcfce7",
  badgeErrorColor: "#b91c1c",
  badgeErrorBg: "#fee2e2",
};

const DARK_PALETTE: ColorPalette = {
  bg: "#0f172a",
  surface: "#1e293b",
  surfaceAlt: "#111827",
  border: "#334155",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  codeBg: "#0b1220",
  errorBg: "#450a0a",
  errorBorder: "#7f1d1d",
  errorText: "#fecaca",
  badgeConnectingColor: "#94a3b8",
  badgeConnectingBg: "#1e293b",
  badgeConnectedColor: "#4ade80",
  badgeConnectedBg: "#14532d",
  badgeErrorColor: "#fca5a5",
  badgeErrorBg: "#7f1d1d",
};

const ThemeContext = createContext<ColorPalette>(LIGHT_PALETTE);

export function useColors(): ColorPalette {
  return useContext(ThemeContext);
}

type AskClaudeStructured = {
  question?: string;
  chatgpt_answer?: string | null;
  claude_answer?: string;
  model_used?: string;
  latency_ms?: number;
  error?: { code: string; message: string };
};

function AppRouter() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [isToolRunning, setIsToolRunning] = useState(false);
  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  const { app, isConnected, error } = useApp({
    appInfo: {
      name: "article-3-claude-second-opinion",
      version: "0.0.1",
    },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = () => {
        setToolResult(null);
        setIsToolRunning(true);
      };
      app.ontoolresult = (params) => {
        setToolResult(params);
        setIsToolRunning(false);
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

  const status: Status = error
    ? "error"
    : isConnected
      ? "connected"
      : "connecting";

  return (
    <ThemeContext.Provider value={palette}>
      <div
        style={{
          minHeight: "100vh",
          background: palette.bg,
          transition: "background 150ms",
        }}
      >
        <main
          style={{
            fontFamily:
              "system-ui, -apple-system, 'Segoe UI', sans-serif",
            padding: "1.5rem",
            color: palette.text,
            maxWidth: "52rem",
            margin: "0 auto",
          }}
        >
          <Header status={status} />
          <Body
            status={status}
            toolResult={toolResult}
            isToolRunning={isToolRunning}
            error={error}
          />
        </main>
      </div>
    </ThemeContext.Provider>
  );
}

function Header({ status }: { status: Status }) {
  const colors = useColors();

  return (
    <header
      style={{
        marginBottom: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: "1.25rem", color: colors.text }}>
          Claude Second Opinion
        </h1>
        <p
          style={{
            margin: "0.25rem 0 0",
            color: colors.textMuted,
            fontSize: "0.75rem",
          }}
        >
          Article 3 — ChatGPT × Claude via MCP Apps
        </p>
      </div>
      <StatusBadge status={status} />
    </header>
  );
}

function Body({
  status,
  toolResult,
  isToolRunning,
  error,
}: {
  status: Status;
  toolResult: CallToolResult | null;
  isToolRunning: boolean;
  error: Error | null;
}) {
  if (status === "error") {
    return <ErrorCard message={error?.message ?? "Unknown error"} />;
  }
  if (status === "connecting") {
    return <InfoCard text="Connecting to MCP host…" />;
  }
  if (!toolResult && !isToolRunning) {
    return <InfoCard text="Waiting for an ask_claude call…" />;
  }

  const structured =
    (toolResult?.structuredContent as AskClaudeStructured | undefined) ??
    undefined;
  const question = structured?.question ?? "";
  const chatgptAnswer =
    typeof structured?.chatgpt_answer === "string"
      ? structured.chatgpt_answer
      : null;
  const claudeAnswer = structured?.claude_answer ?? null;
  const claudeError = structured?.error;

  return (
    <ComparisonView
      question={question || "(no question yet)"}
      chatgptAnswer={chatgptAnswer}
      claudeAnswer={claudeAnswer}
      claudeMeta={{
        model: structured?.model_used,
        latencyMs: structured?.latency_ms,
      }}
      isLoading={isToolRunning}
      claudeError={claudeError}
    />
  );
}

function StatusBadge({ status }: { status: Status }) {
  const colors = useColors();
  const config = {
    connecting: {
      label: "Connecting…",
      color: colors.badgeConnectingColor,
      bg: colors.badgeConnectingBg,
    },
    connected: {
      label: "Connected",
      color: colors.badgeConnectedColor,
      bg: colors.badgeConnectedBg,
    },
    error: {
      label: "Error",
      color: colors.badgeErrorColor,
      bg: colors.badgeErrorBg,
    },
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
        whiteSpace: "nowrap",
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

function ErrorCard({ message }: { message: string }) {
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
      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Error</div>
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
