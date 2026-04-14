/**
 * Council Orchestrator — Article 4 の中核: ChatGPT 主催の合議フロー。
 *
 * 現在の実装範囲 (spec-003 task 1-2 完了時点):
 *   - Round 1: ChatGPT の初案を API 呼び出しなしで 1 speaker として記録
 *   - Round 2: Claude / Gemini に並列問い合わせ (`Promise.allSettled`)、結果を Speaker に詰める
 *   - 型: `Stance` / `Consensus` / `Speaker.stance?` / `CouncilTranscript.consensus` を定義
 *   - `computeConsensus(speakers)` ヘルパーで stance 集計 (2 人以上の成功を
 *     unanimous 判定の必須条件にする)
 *   - `total_latency_ms` は Round 1-2 全体の経過時間
 *
 * 次タスク以降で段階的に拡張される:
 *   - spec-003 task 3: Round 2 プロンプトを stance-based 独立評価形に書き換え、
 *     `{stance, reason}` の構造化出力を parse して Speaker.stance に入れる
 *     (task 2 時点では Round 2 の Speaker.stance は常に undefined なので、
 *     `computeConsensus` は必ず `"mixed"` を返す。task 3 で初めて他分岐が有効化)
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

/**
 * Round 2 の各 speaker が初案に対して表明する 4 値 stance。
 * - agree: 初案に同意
 * - extend: 初案に同意しつつ補足視点を追加
 * - partial: 初案の一部に同意、一部に不同意
 * - disagree: 初案に不同意
 *
 * "批判" 用語を避けているのは spec-003 technical notes に書いた通り、
 * LLM-as-critic の 3 失敗モード (sycophancy flip / confabulated disagreement /
 * confirmation signal の喪失) を避けるため。同意も正当な出力として扱う。
 */
export type Stance = "agree" | "extend" | "partial" | "disagree";

export type Speaker = {
  name: SpeakerName;
  /** 発言本文。成功したときのみ入る */
  content?: string;
  /** Round 2 の独立評価プロンプトから parse した stance。chatgpt (Round 1) と
   * parse 失敗 / provider エラー時は undefined */
  stance?: Stance;
  /** provider が失敗したとき、または rejected Promise を settledToSpeaker が拾ったとき */
  error?: ProviderError;
};

export type RoundLabel = "round_1" | "round_2";

export type Round = {
  label: RoundLabel;
  speakers: Speaker[];
};

/**
 * Round 2 の stance 集計から導出する合議の全体合意度。
 * - unanimous_agree: 2 人以上が全員 agree / extend (改訂ほぼ不要)
 * - mixed: 意見が割れた / parse 失敗 / 成功 speaker 1 人以下 (標準の改訂誘導)
 * - unanimous_disagree: 2 人以上が全員 disagree (根本書き直し誘導)
 *
 * "1 人だけ agree" を unanimous_agree と名乗らないのが設計の肝。`computeConsensus`
 * は 2 人以上の成功 speaker を unanimous 判定の必須条件にする。
 */
export type Consensus = "unanimous_agree" | "mixed" | "unanimous_disagree";

export type CouncilInput = {
  question: string;
  chatgpt_initial_answer: string;
};

export type CouncilTranscript = {
  question: string;
  chatgpt_initial_answer: string;
  rounds: Round[];
  /** Round 2 の stance 集計から導出する合議の全体合意度 */
  consensus: Consensus;
  /** Round 1-2 を通した wall-clock time。Round 2 の並列効果がそのまま現れる */
  total_latency_ms: number;
};

export type CouncilProviders = {
  claude: ProviderClient;
  gemini: ProviderClient;
};

const ROUND_2_MAX_TOKENS = 512;

/**
 * Round 2 speakers から合議の consensus を計算する。
 *
 * ルール:
 *   - stance を持つ speaker が 2 人以上 かつ 全員 agree/extend → unanimous_agree
 *   - stance を持つ speaker が 2 人以上 かつ 全員 disagree → unanimous_disagree
 *   - それ以外 (mixed / 部分失敗 / parse 失敗 / 成功 1 人以下) → mixed
 *
 * "1 人だけ agree" を unanimous と名乗らないのが肝。1 人しか成功しなかった場合、
 * その 1 人の意見でサーバー側が「全員一致」と宣言すると事実誤認を誘発する。
 */
export function computeConsensus(speakers: Speaker[]): Consensus {
  const withStance = speakers.filter(
    (s): s is Speaker & { stance: Stance } => s.stance !== undefined,
  );
  if (withStance.length < 2) return "mixed";

  const allAgreeOrExtend = withStance.every(
    (s) => s.stance === "agree" || s.stance === "extend",
  );
  if (allAgreeOrExtend) return "unanimous_agree";

  const allDisagree = withStance.every((s) => s.stance === "disagree");
  if (allDisagree) return "unanimous_disagree";

  return "mixed";
}

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
    consensus: computeConsensus(round2.speakers),
    total_latency_ms: Date.now() - start,
  };
}
