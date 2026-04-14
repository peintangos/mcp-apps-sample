/**
 * Council Orchestrator — Article 4 の中核: ChatGPT 主催の合議フロー。
 *
 * 現在の実装範囲 (spec-003 task 1-3 完了時点):
 *   - Round 1: ChatGPT の初案を API 呼び出しなしで 1 speaker として記録
 *   - Round 2: Claude / Gemini に独立評価プロンプトで並列問い合わせ (`Promise.allSettled`)
 *   - `{stance, reason}` の JSON 構造化出力を `parseStanceResponse()` で parse し、
 *     コードフェンス剥がし + 4 値 stance / 非空 reason の runtime 検証を通す
 *   - 型: `Stance` / `Consensus` / `Speaker.stance?` / `CouncilTranscript.consensus`
 *   - `computeConsensus(speakers)` で stance 集計 (2 人以上の成功を unanimous 判定の
 *     必須条件にする)
 *   - parse 失敗時: `content` は原文のまま残し `error.code = invalid_response`、
 *     stance は undefined のため consensus 計算から除外される
 *   - `total_latency_ms` は Round 1-2 全体の経過時間
 *
 * 次タスク以降で段階的に拡張される:
 *   - spec-003 task 4: `buildRevisionPrompt(transcript, consensus)` を追加し、
 *     `CouncilTranscript.revision_prompt` を埋める
 *   - spec-003 task 5: `start_council` tool を server.ts に登録
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

// NOTE: spec-003 technical note は `maxOutputTokens: 512` を目安としていたが、
// 実 API 疎通 (spec-003 task 3) で Gemini 2.5 flash が hidden thinking トークンを
// 使い始めて 512 では JSON 出力が truncate されることが判明した (spec-002 で
// gemini-2.5-pro について観測した現象と同根)。council.ts では `maxOutputTokens` を
// override せず、各 provider の `DEFAULT_MAX_TOKENS` (Claude 1024 / Gemini 4096) を
// 使う。provider 固有の safe 値は provider 自身が知っているべき、という設計判断。

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
    "あなたは ChatGPT 主催の合議に参加する独立評価者です。",
    "ChatGPT が以下の質問に対する初案を提示しました。あなたはこの初案を第三者の立場で独立評価してください。",
    "",
    "【重要】これは『批判』を求めるプロンプトではありません。同意も正当な出力です。",
    "初案に同意する箇所があれば素直に同意を表明してください。欠点を無理に捻り出す必要はありません。",
    "逆に重要な論点が抜けていたり誤りがあれば、端的に指摘してください。",
    "",
    "次の 4 値のいずれかで初案に対する立場 (stance) を示してください:",
    "- agree: 初案に同意。大きな修正は不要",
    "- extend: 初案に同意した上で補足視点を追加",
    "- partial: 初案の一部に同意、一部に異論あり",
    "- disagree: 初案に根本的に同意しない",
    "",
    "回答は以下の JSON 形式で返してください。他のテキストや markdown コードフェンスは不要です。",
    '{"stance": "agree", "reason": "初案の論理構成は妥当で補足する論点は見当たりません。"}',
    "",
    "- stance は必ず agree / extend / partial / disagree のいずれかにしてください",
    "- reason は 200 字以内の日本語で、あなたの立場の根拠を簡潔に示してください",
    "",
    "------",
    `質問: ${input.question}`,
    "",
    "ChatGPT の初案:",
    input.chatgpt_initial_answer,
  ].join("\n");
}

/**
 * Round 2 の structured output (`{stance, reason}`) をモデルの生テキストから parse する。
 *
 * パース順序 (advisor 推奨):
 *   1. 生テキストをそのまま `JSON.parse`
 *   2. 失敗したら最初に出現する ``` コードフェンスの中身を取り出して再 parse
 *   3. それも失敗したら null
 *
 * 最後に `stance` が 4 値 union に属するか、`reason` が非空文字列かを runtime 検証する。
 * いずれか欠けたら null (= parse 失敗扱い) にする。
 */
export function parseStanceResponse(
  text: string,
): { stance: Stance; reason: string } | null {
  const candidates: string[] = [text.trim()];

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());

  for (const raw of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;

    const obj = parsed as Record<string, unknown>;
    const stance = obj.stance;
    const reason = obj.reason;
    if (!isStance(stance)) continue;
    if (typeof reason !== "string" || reason.trim() === "") continue;

    return { stance, reason: reason.trim() };
  }
  return null;
}

function isStance(value: unknown): value is Stance {
  return (
    value === "agree" ||
    value === "extend" ||
    value === "partial" ||
    value === "disagree"
  );
}

/**
 * Round 2 で provider から帰ってきた生 Speaker を、stance parse 結果に基づいて変換する。
 *
 * 前提:
 *   - chatgpt (Round 1) は対象外
 *   - provider が error を返した speaker はそのまま通過 (stance 無し)
 *   - content が undefined の speaker もそのまま通過
 *
 * parse 成功時: `content` を reason に置き換え、`stance` を設定
 * parse 失敗時: `content` は原文のまま残し、`error.code = invalid_response` を追加
 *   (原文保持はデバッグと UI 表示のため。`computeConsensus` は stance === undefined を
 *    除外するので、content があっても consensus 計算には影響しない)
 */
function applyStanceParsing(speaker: Speaker): Speaker {
  if (speaker.name === "chatgpt") return speaker;
  if (speaker.error !== undefined) return speaker;
  if (speaker.content === undefined) return speaker;

  const parsed = parseStanceResponse(speaker.content);
  if (!parsed) {
    return {
      ...speaker,
      error: {
        code: "invalid_response",
        message:
          "Failed to parse Round 2 structured output; expected JSON `{stance, reason}` but could not extract a valid stance.",
      },
    };
  }
  return {
    ...speaker,
    content: parsed.reason,
    stance: parsed.stance,
  };
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
  const settled = await Promise.allSettled([
    providers.claude.ask(round2Prompt),
    providers.gemini.ask(round2Prompt),
  ]);

  const round2: Round = {
    label: "round_2",
    speakers: [
      settledToSpeaker("claude", settled[0]),
      settledToSpeaker("gemini", settled[1]),
    ].map(applyStanceParsing),
  };

  return {
    question: input.question,
    chatgpt_initial_answer: input.chatgpt_initial_answer,
    rounds: [round1, round2],
    consensus: computeConsensus(round2.speakers),
    total_latency_ms: Date.now() - start,
  };
}
