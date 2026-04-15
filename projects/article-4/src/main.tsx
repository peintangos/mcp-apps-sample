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
import { SingleAnswerView } from "./components/SingleAnswerView.js";
import {
  extractToolName,
  isCouncilStructured,
  resolveToolView,
  type PendingToolCall,
  type SingleAnswerStructured,
  type ToolView,
} from "./ui-router.js";

// Claude ブランドカラー (オレンジ系、両テーマ共通)
// - BASE は strong / aggressive な濃いオレンジ (ヘッダ背景・ボーダー用)
// - STRONG は最も濃いオレンジ (グラデーションのダーク端・強調テキスト用)
// soft 系の背景色は Palette の claudeSoftBg で theme-aware に切り替える
const CLAUDE_COLOR = "#d97757";
const CLAUDE_COLOR_STRONG = "#c85a34";
const GEMINI_COLOR = "#2f6fed";
const GEMINI_COLOR_STRONG = "#1d4ed8";
const COUNCIL_COLOR = "#b45309";
const COUNCIL_COLOR_STRONG = "#7c2d12";

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

function AppRouter() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [pendingInput, setPendingInput] = useState<PendingToolCall | null>(null);
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
        const args = params.arguments as { question?: string } | undefined;
        // ローディング中も view を安定して切り替えられるよう、tool 名を保持する。
        setPendingInput({
          toolName: extractToolName(params),
          question: args?.question,
        });
        setToolResult(null);
        setIsToolRunning(true);
      };
      app.ontoolresult = (params) => {
        setToolResult(params);
        setPendingInput((current) => ({
          toolName: extractToolName(params) ?? current?.toolName ?? null,
          question:
            (params.structuredContent as { question?: string } | undefined)
              ?.question ?? current?.question,
        }));
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
  const view = resolveToolView({
    toolResult,
    pendingToolName: pendingInput?.toolName ?? null,
  });

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
            maxWidth: view.kind === "council" ? "52rem" : "42rem",
            margin: "0 auto",
          }}
        >
          <Header status={status} view={view} />
          <Body
            status={status}
            view={view}
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

function Header({
  status,
  view,
}: {
  status: Status;
  view: ToolView;
}) {
  const { title, subtitle, color, strongColor } = getHeaderTheme(view);
  return (
    <header
      style={{
        marginBottom: "1rem",
        padding: "1rem 1.25rem",
        background: `linear-gradient(135deg, ${color} 0%, ${strongColor} 100%)`,
        borderRadius: "0.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        boxShadow: `0 4px 16px ${color}44`,
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
          {title}
        </h1>
        <p
          style={{
            margin: "0.25rem 0 0",
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.75rem",
          }}
        >
          {subtitle}
        </p>
      </div>
      <StatusBadge status={status} />
    </header>
  );
}

function Body({
  status,
  view,
  toolResult,
  pendingInput,
  isToolRunning,
  error,
}: {
  status: Status;
  view: ToolView;
  toolResult: CallToolResult | null;
  pendingInput: PendingToolCall | null;
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
    return <InfoCard text="Waiting for a tool call…" />;
  }

  if (view.kind === "single_answer") {
    return (
      <SingleAnswerBody
        provider={view.provider}
        toolResult={toolResult}
        pendingInput={pendingInput}
        isToolRunning={isToolRunning}
      />
    );
  }

  if (view.kind === "council") {
    return (
      <CouncilBranchBody
        toolResult={toolResult}
        pendingInput={pendingInput}
        isToolRunning={isToolRunning}
      />
    );
  }

  return (
    <RawResultCard
      text={
        toolResult?.content?.find(
          (block): block is { type: "text"; text: string } => block.type === "text",
        )?.text ?? "(no text)"
      }
    />
  );
}

function SingleAnswerBody({
  provider,
  toolResult,
  pendingInput,
  isToolRunning,
}: {
  provider: "claude" | "gemini";
  toolResult: CallToolResult | null;
  pendingInput: PendingToolCall | null;
  isToolRunning: boolean;
}) {
  const structured =
    (toolResult?.structuredContent as SingleAnswerStructured | undefined) ??
    undefined;

  return (
    <SingleAnswerView
      provider={provider}
      structured={structured}
      pendingQuestion={pendingInput?.question}
      isLoading={isToolRunning}
    />
  );
}

function CouncilBranchBody({
  toolResult,
  pendingInput,
  isToolRunning,
}: {
  toolResult: CallToolResult | null;
  pendingInput: PendingToolCall | null;
  isToolRunning: boolean;
}) {
  const structured = toolResult?.structuredContent;
  const transcript = isCouncilStructured(structured) ? structured : null;
  const question = transcript?.question ?? pendingInput?.question ?? "";
  const topLevelError = transcript?.error;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {question ? (
        <QuestionCard
          accentColor={COUNCIL_COLOR}
          accentStrongColor={COUNCIL_COLOR_STRONG}
          question={question}
        />
      ) : null}

      <section
        style={{
          padding: "1rem 1.125rem",
          border: `1px solid ${COUNCIL_COLOR}55`,
          borderRadius: "0.875rem",
          background:
            "linear-gradient(180deg, rgba(251, 191, 36, 0.08) 0%, rgba(180, 83, 9, 0.02) 100%)",
          boxShadow: "0 10px 24px rgba(180, 83, 9, 0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: COUNCIL_COLOR,
              }}
            >
              LLM Council
            </div>
            <div
              style={{
                fontSize: "0.9375rem",
                marginTop: "0.25rem",
              }}
            >
              {isToolRunning
                ? "合議を実行中です。タイムライン UI は次タスクで実装します。"
                : "分岐ロジックは council 用に切り替わりました。タイムライン部品は次タスクで追加します。"}
            </div>
          </div>
          {transcript ? (
            <span
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: "9999px",
                background: "#fff7ed",
                border: `1px solid ${COUNCIL_COLOR}44`,
                color: COUNCIL_COLOR_STRONG,
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {transcript.consensus}
            </span>
          ) : null}
        </div>

        {topLevelError ? (
          <ErrorCard
            title={`Council: ${topLevelError.code}`}
            message={topLevelError.message}
          />
        ) : null}

        {transcript ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <CouncilMetric
              label="Consensus"
              value={transcript.consensus}
            />
            <CouncilMetric
              label="Rounds"
              value={String(transcript.rounds.length)}
            />
            <CouncilMetric
              label="Latency"
              value={`${transcript.total_latency_ms}ms`}
            />
          </div>
        ) : (
          <InfoCard text="Council transcript を待っています…" />
        )}
      </section>
    </div>
  );
}

function QuestionCard({
  accentColor,
  accentStrongColor,
  question,
}: {
  accentColor: string;
  accentStrongColor: string;
  question: string;
}) {
  const colors = useColors();

  return (
    <section
      aria-label="Question"
      style={{
        padding: "0.875rem 1rem",
        background: colors.claudeSoftBg,
        border: `1px solid ${accentColor}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: "0.5rem",
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: accentStrongColor,
          marginBottom: "0.25rem",
        }}
      >
        Question
      </div>
      <div style={{ fontSize: "0.9375rem", color: colors.text }}>{question}</div>
    </section>
  );
}

function CouncilMetric({ label, value }: { label: string; value: string }) {
  const colors = useColors();

  return (
    <div
      style={{
        padding: "0.75rem 0.875rem",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "0.9375rem",
          color: colors.text,
          fontWeight: 700,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RawResultCard({ text }: { text: string }) {
  const colors = useColors();

  return (
    <div
      style={{
        padding: "1.25rem",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "0.75rem",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        fontSize: "0.875rem",
        color: colors.text,
        wordBreak: "break-word",
      }}
    >
      {text}
    </div>
  );
}

function getHeaderTheme(view: ToolView): {
  title: string;
  subtitle: string;
  color: string;
  strongColor: string;
} {
  if (view.kind === "single_answer" && view.provider === "gemini") {
    return {
      title: "Gemini の答え",
      subtitle:
        "Single-answer branch for ask_gemini · Article 4",
      color: GEMINI_COLOR,
      strongColor: GEMINI_COLOR_STRONG,
    };
  }

  if (view.kind === "council") {
    return {
      title: "LLM Council",
      subtitle:
        "Council branch for start_council · Claude + Gemini + ChatGPT",
      color: COUNCIL_COLOR,
      strongColor: COUNCIL_COLOR_STRONG,
    };
  }

  return {
    title: "Claude の答え",
    subtitle:
      "Single-answer branch for ask_claude · Article 4",
    color: CLAUDE_COLOR,
    strongColor: CLAUDE_COLOR_STRONG,
  };
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

function ErrorCard({
  title = "Error",
  message,
}: {
  title?: string;
  message: string;
}) {
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
      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{title}</div>
      <div style={{ fontSize: "0.875rem" }}>{message}</div>
    </div>
  );
}

if (typeof document !== "undefined") {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    createRoot(rootEl).render(
      <StrictMode>
        <AppRouter />
      </StrictMode>,
    );
  }
}
