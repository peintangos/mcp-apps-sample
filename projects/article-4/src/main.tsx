import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { SingleAnswerView } from "./components/SingleAnswerView.js";
import { RoundTimeline } from "./components/RoundTimeline.js";
import { PreviewGallery } from "./preview-gallery.js";
import {
  ThemeContext,
  LIGHT_PALETTE,
  DARK_PALETTE,
  useColors,
} from "./theme.js";
import {
  extractToolName,
  isCouncilStructured,
  resolveToolView,
  type PendingToolCall,
  type SingleAnswerStructured,
  type ToolView,
} from "./ui-router.js";

export { useColors, type ColorPalette } from "./theme.js";

const CLAUDE_COLOR = "#d97757";
const CLAUDE_COLOR_STRONG = "#c85a34";
const GEMINI_COLOR = "#2f6fed";
const GEMINI_COLOR_STRONG = "#1d4ed8";
const COUNCIL_COLOR = "#b45309";
const COUNCIL_COLOR_STRONG = "#7c2d12";

type Status = "connecting" | "connected" | "error";

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

  // view.kind === "unknown" — tool 名が未確定。
  // pending 中は中立の loading UI を出し、結果受信後は生テキスト表示にフォールバックする。
  if (isToolRunning) {
    return <InfoCard text="ツールを呼んでいます…" />;
  }

  const fallbackText = toolResult?.content?.find(
    (block): block is { type: "text"; text: string } => block.type === "text",
  )?.text;
  return (
    <RawResultCard text={fallbackText ?? "(結果を表示できませんでした)"} />
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

      {topLevelError ? (
        <ErrorCard
          title={`Council: ${topLevelError.code}`}
          message={topLevelError.message}
        />
      ) : null}

      <RoundTimeline transcript={transcript} isLoading={isToolRunning} />
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

  if (view.kind === "single_answer" && view.provider === "claude") {
    return {
      title: "Claude の答え",
      subtitle:
        "Single-answer branch for ask_claude · Article 4",
      color: CLAUDE_COLOR,
      strongColor: CLAUDE_COLOR_STRONG,
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

  // view.kind === "unknown" — ツール名が未確定のローディング/フォールバック
  return {
    title: "Article 4 MCP App",
    subtitle: "Claude + Gemini + ChatGPT 合議デモ",
    color: COUNCIL_COLOR,
    strongColor: COUNCIL_COLOR_STRONG,
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

function PreviewApp() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

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
          <PreviewGallery
            currentTheme={theme}
            onToggleTheme={() =>
              setTheme((t) => (t === "light" ? "dark" : "light"))
            }
          />
        </main>
      </div>
    </ThemeContext.Provider>
  );
}

if (typeof document !== "undefined") {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    const isPreview = window.location.hash === "#preview";
    createRoot(rootEl).render(
      <StrictMode>
        {isPreview ? <PreviewApp /> : <AppRouter />}
      </StrictMode>,
    );
  }
}
