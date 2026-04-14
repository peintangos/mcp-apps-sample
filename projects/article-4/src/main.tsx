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
import { AnswerColumn } from "./components/AnswerColumn.js";

// Claude ブランドカラー (オレンジ系、両テーマ共通)
// - BASE は strong / aggressive な濃いオレンジ (ヘッダ背景・ボーダー用)
// - STRONG は最も濃いオレンジ (グラデーションのダーク端・強調テキスト用)
// soft 系の背景色は Palette の claudeSoftBg で theme-aware に切り替える
const CLAUDE_COLOR = "#d97757";
const CLAUDE_COLOR_STRONG = "#c85a34";

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
  claudeSoftBg: string;
};

const LIGHT_PALETTE: ColorPalette = {
  bg: "#fffaf5", // 全体を薄いオレンジ寄りに
  surface: "#ffffff",
  surfaceAlt: "#fef7f0", // クリーム寄り
  border: "#fce3d1",
  text: "#1f1208",
  textMuted: "#8a5a3c",
  codeBg: "#fff3e9",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  errorText: "#7f1d1d",
  badgeConnectingColor: "#b38a6a",
  badgeConnectingBg: "#fef7f0",
  badgeConnectedColor: "#15803d",
  badgeConnectedBg: "#dcfce7",
  badgeErrorColor: "#b91c1c",
  badgeErrorBg: "#fee2e2",
  claudeSoftBg: "#fef1ea",
};

const DARK_PALETTE: ColorPalette = {
  bg: "#1a0f07", // 濃茶 (オレンジ系 dark)
  surface: "#261811",
  surfaceAlt: "#1f130a",
  border: "#523022",
  text: "#fef1ea",
  textMuted: "#c9a48c",
  codeBg: "#0f0803",
  errorBg: "#450a0a",
  errorBorder: "#7f1d1d",
  errorText: "#fecaca",
  badgeConnectingColor: "#c9a48c",
  badgeConnectingBg: "#261811",
  badgeConnectedColor: "#4ade80",
  badgeConnectedBg: "#14532d",
  badgeErrorColor: "#fca5a5",
  badgeErrorBg: "#7f1d1d",
  claudeSoftBg: "#3a1e12",
};

const ThemeContext = createContext<ColorPalette>(LIGHT_PALETTE);

export function useColors(): ColorPalette {
  return useContext(ThemeContext);
}

type AskClaudeStructured = {
  question?: string;
  claude_answer?: string;
  model_used?: string;
  latency_ms?: number;
  error?: { code: string; message: string };
};

type PendingInput = {
  question?: string;
};

function AppRouter() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const [isToolRunning, setIsToolRunning] = useState(false);
  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  const { app, isConnected, error } = useApp({
    appInfo: {
      name: "article-4-llm-council",
      version: "0.0.1",
    },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = (params) => {
        // tool 呼び出しが始まった瞬間: 引数 (question) を拾って UI に先出しする
        const args = params.arguments as PendingInput | undefined;
        setPendingInput(args ?? null);
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
            maxWidth: "42rem",
            margin: "0 auto",
          }}
        >
          <Header status={status} />
          <Body
            status={status}
            toolResult={toolResult}
            pendingInput={pendingInput}
            isToolRunning={isToolRunning}
            error={error}
          />
        </main>
      </div>
    </ThemeContext.Provider>
  );
}

function Header({ status }: { status: Status }) {
  return (
    <header
      style={{
        marginBottom: "1rem",
        padding: "1rem 1.25rem",
        background: `linear-gradient(135deg, ${CLAUDE_COLOR} 0%, ${CLAUDE_COLOR_STRONG} 100%)`,
        borderRadius: "0.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        boxShadow: "0 4px 16px rgba(217, 119, 87, 0.28)",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "1.375rem",
            color: "#ffffff",
            letterSpacing: "-0.01em",
          }}
        >
          Claudeの答え
        </h1>
        <p
          style={{
            margin: "0.25rem 0 0",
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.75rem",
          }}
        >
          LLM Council powered by Anthropic + Google Generative AI · Article 4
        </p>
      </div>
      <StatusBadge status={status} />
    </header>
  );
}

function Body({
  status,
  toolResult,
  pendingInput,
  isToolRunning,
  error,
}: {
  status: Status;
  toolResult: CallToolResult | null;
  pendingInput: PendingInput | null;
  isToolRunning: boolean;
  error: Error | null;
}) {
  const colors = useColors();

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
  // question は結果が出る前 (pendingInput) にも、結果が出た後 (structured) にも取れる
  const question = structured?.question ?? pendingInput?.question ?? "";
  const claudeAnswer = structured?.claude_answer ?? null;
  const claudeError = structured?.error;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {question && (
        <section
          aria-label="Question"
          style={{
            padding: "0.875rem 1rem",
            background: colors.claudeSoftBg,
            border: `1px solid ${CLAUDE_COLOR}`,
            borderLeft: `4px solid ${CLAUDE_COLOR}`,
            borderRadius: "0.5rem",
          }}
        >
          <div
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: CLAUDE_COLOR_STRONG,
              marginBottom: "0.25rem",
            }}
          >
            Question
          </div>
          <div style={{ fontSize: "0.9375rem", color: colors.text }}>
            {question}
          </div>
        </section>
      )}

      <AnswerColumn
        label="Claude"
        labelColor={CLAUDE_COLOR}
        content={claudeError ? null : claudeAnswer}
        meta={{
          model: structured?.model_used,
          latencyMs: structured?.latency_ms,
        }}
        isLoading={isToolRunning}
        errorMessage={
          claudeError
            ? `${claudeError.code}: ${claudeError.message}`
            : undefined
        }
      />
    </div>
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
