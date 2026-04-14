/**
 * Council Orchestrator — Article 4 の中核: ChatGPT 主催の合議フロー。
 *
 * 本ファイルは spec-003 の第 1 タスク時点の**スケルトン**である:
 *   - Round 1: ChatGPT の初案を API 呼び出しなしで 1 speaker として記録
 *   - Round 2: Claude / Gemini に並列問い合わせ (`Promise.allSettled`)、結果を Speaker に詰める
 *   - `total_latency_ms` は Round 1-2 全体の経過時間
 *
 * 次タスク以降で段階的に拡張される:
 *   - spec-003 task 2: `Stance` / `Consensus` 型 + `computeConsensus()` を追加し、
 *     `Speaker.stance?` と `CouncilTranscript.consensus` を型に生やす
 *   - spec-003 task 3: Round 2 プロンプトを stance-based 独立評価形に書き換え、
 *     `{stance, reason}` の構造化出力を parse して Speaker.stance に入れる
 *   - spec-003 task 4: `buildRevisionPrompt(transcript, consensus)` を追加し、
 *     `CouncilTranscript.revision_prompt` を埋める
 *
 * Round 3 (改訂案) はサーバーで生成しない — ChatGPT 本人が tool 応答の `content` を
 * 読んで次の発話として改訂案を書く。これが "案 B" の核心で、`runCouncil()` には
 * 最終回答を組み立てるロジックは入らない (`final_answer` フィールドは存在しない)。
 */

import type {
  ProviderClient,
  ProviderError,
  ProviderResponse,
  Result,
} from "./providers/types.js";

export type SpeakerName = "chatgpt" | "claude" | "gemini";

export type Speaker = {
  name: SpeakerName;
  /** 発言本文。成功したときのみ入る */
  content?: string;
  /** provider が失敗したとき、または rejected Promise を settledToSpeaker が拾ったとき */
  error?: ProviderError;
};

export type RoundLabel = "round_1" | "round_2";

export type Round = {
  label: RoundLabel;
  speakers: Speaker[];
};

export type CouncilInput = {
  question: string;
  chatgpt_initial_answer: string;
};

export type CouncilTranscript = {
  question: string;
  chatgpt_initial_answer: string;
  rounds: Round[];
  /** Round 1-2 を通した wall-clock time。Round 2 の並列効果がそのまま現れる */
  total_latency_ms: number;
};

export type CouncilProviders = {
  claude: ProviderClient;
  gemini: ProviderClient;
};

const ROUND_2_MAX_TOKENS = 512;

function buildRound2Prompt(input: CouncilInput): string {
  return [
    "あなたは第三者の立場で独立した見解を示してください。",
    "ChatGPT がすでに初案を提示しています。あなた自身の知識と判断で 150 字以内で見解を述べ、",
    "同意する部分があれば明示し、異なる観点があればそれも端的に示してください。",
    "",
    `質問: ${input.question}`,
    "",
    "ChatGPT の初案:",
    input.chatgpt_initial_answer,
  ].join("\n");
}

function settledToSpeaker(
  name: Exclude<SpeakerName, "chatgpt">,
  settled: PromiseSettledResult<Result<ProviderResponse>>,
): Speaker {
  if (settled.status === "rejected") {
    const reason = settled.reason;
    return {
      name,
      error: {
        code: "network_error",
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : JSON.stringify(reason),
      },
    };
  }
  const result = settled.value;
  if (!result.ok) return { name, error: result.error };
  return { name, content: result.data.text };
}

export async function runCouncil(
  input: CouncilInput,
  providers: CouncilProviders,
): Promise<CouncilTranscript> {
  const start = Date.now();

  const round1: Round = {
    label: "round_1",
    speakers: [{ name: "chatgpt", content: input.chatgpt_initial_answer }],
  };

  const round2Prompt = buildRound2Prompt(input);
  const askOptions = { maxOutputTokens: ROUND_2_MAX_TOKENS } as const;
  const settled = await Promise.allSettled([
    providers.claude.ask(round2Prompt, askOptions),
    providers.gemini.ask(round2Prompt, askOptions),
  ]);

  const round2: Round = {
    label: "round_2",
    speakers: [
      settledToSpeaker("claude", settled[0]),
      settledToSpeaker("gemini", settled[1]),
    ],
  };

  return {
    question: input.question,
    chatgpt_initial_answer: input.chatgpt_initial_answer,
    rounds: [round1, round2],
    total_latency_ms: Date.now() - start,
  };
}
