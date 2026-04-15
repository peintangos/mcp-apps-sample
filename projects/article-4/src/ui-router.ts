import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolName = "ask_claude" | "ask_gemini" | "start_council";

export type ProviderName = "claude" | "gemini";

export type PendingToolCall = {
  toolName: ToolName | null;
  question?: string;
};

export type ProviderErrorPayload = {
  code: string;
  message: string;
};

export type SingleAnswerStructured = {
  question?: string;
  claude_answer?: string;
  gemini_answer?: string;
  model_used?: string;
  latency_ms?: number;
  error?: ProviderErrorPayload;
};

export type CouncilStructured = {
  question: string;
  chatgpt_initial_answer: string;
  rounds: Array<{
    label: string;
    speakers: Array<{
      name: "chatgpt" | "claude" | "gemini";
      content?: string;
      stance?: "agree" | "extend" | "partial" | "disagree";
      error?: ProviderErrorPayload;
    }>;
  }>;
  consensus: "unanimous_agree" | "mixed" | "unanimous_disagree";
  revision_prompt: string;
  total_latency_ms: number;
  error?: {
    code: string;
    message: string;
    providers?: Array<{
      name: "claude" | "gemini";
      error: ProviderErrorPayload;
    }>;
  };
};

export type ToolView =
  | { kind: "single_answer"; provider: ProviderName }
  | { kind: "council" }
  | { kind: "unknown" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractToolName(payload: unknown): ToolName | null {
  if (!isRecord(payload)) return null;

  const directName = payload.name;
  if (
    directName === "ask_claude" ||
    directName === "ask_gemini" ||
    directName === "start_council"
  ) {
    return directName;
  }

  const toolName = payload.toolName;
  if (
    toolName === "ask_claude" ||
    toolName === "ask_gemini" ||
    toolName === "start_council"
  ) {
    return toolName;
  }

  const meta = payload._meta;
  if (!isRecord(meta)) return null;
  const metaToolName = meta.tool_name;
  if (
    metaToolName === "ask_claude" ||
    metaToolName === "ask_gemini" ||
    metaToolName === "start_council"
  ) {
    return metaToolName;
  }

  return null;
}

export function isCouncilStructured(content: unknown): content is CouncilStructured {
  return (
    isRecord(content) &&
    Array.isArray(content.rounds) &&
    typeof content.consensus === "string" &&
    typeof content.revision_prompt === "string"
  );
}

export function isSingleAnswerStructured(
  content: unknown,
): content is SingleAnswerStructured {
  return (
    isRecord(content) &&
    ("claude_answer" in content ||
      "gemini_answer" in content ||
      "model_used" in content ||
      "latency_ms" in content ||
      "error" in content)
  );
}

export function resolveToolView(args: {
  toolResult: CallToolResult | null;
  pendingToolName: ToolName | null;
}): ToolView {
  const toolNameFromResult = extractToolName(args.toolResult);
  if (toolNameFromResult === "ask_claude") {
    return { kind: "single_answer", provider: "claude" };
  }
  if (toolNameFromResult === "ask_gemini") {
    return { kind: "single_answer", provider: "gemini" };
  }
  if (toolNameFromResult === "start_council") {
    return { kind: "council" };
  }

  const structured = args.toolResult?.structuredContent;
  if (isCouncilStructured(structured)) {
    return { kind: "council" };
  }
  if (isSingleAnswerStructured(structured)) {
    if ("claude_answer" in structured) {
      return { kind: "single_answer", provider: "claude" };
    }
    if ("gemini_answer" in structured) {
      return { kind: "single_answer", provider: "gemini" };
    }
  }

  if (args.pendingToolName === "ask_claude") {
    return { kind: "single_answer", provider: "claude" };
  }
  if (args.pendingToolName === "ask_gemini") {
    return { kind: "single_answer", provider: "gemini" };
  }
  if (args.pendingToolName === "start_council") {
    return { kind: "council" };
  }

  return { kind: "unknown" };
}
