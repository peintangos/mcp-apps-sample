/**
 * Council Orchestrator — Article 4 の中核: 擬似合議フロー (server-side 2-round)。
 *
 * 設計の核心:
 *   - Round 1 = 3 者 (ChatGPT / Claude / Gemini) が互いを見ずに独立回答する
 *   - Round 2 = Claude / Gemini は Round 1 の 3 者全員の回答を見て、自分の Round 1 と
 *     他 2 者の回答を比較しながら stance (agree/extend/partial/disagree) を表明する
 *   - Round 3 (改訂案) はサーバーで生成せず、ChatGPT 本人が tool 応答の `content`
 *     (= `revision_prompt`) を読んで次の発話として書く
 *
 * なぜ "擬似" か: ChatGPT の MCP App は通常 tool 呼び出しを 1 回しかループしない
 * ため、真のマルチターン discussion (表明 → 反応 → 再表明 → …) は不可能。代わりに
 * 1 tool call 内で Round 1 (独立) → Round 2 (相互参照 stance) を server 側で閉じ込め、
 * anchoring が相互にかかることで偏りを打ち消す設計にしている。
 *
 * 挙動:
 *   - Round 1: `Promise.allSettled` で Claude / Gemini に質問本体を並列投げる
 *     (ChatGPT の Round 1 回答は入力の `chatgpt_initial_answer` をそのまま使う)
 *   - Round 2: Round 1 が成功した speaker のみプロンプト生成。Round 1 が失敗した
 *     speaker は Round 2 を skip して `error.code = round1_failed` を記録
 *   - `{stance, reason}` の JSON 構造化出力を `parseStanceResponse()` で parse し、
 *     コードフェンス剥がし + 4 値 stance / 非空 reason の runtime 検証を通す
 *   - `computeConsensus(speakers)` は Round 2 の stance を集計 (2 人以上の成功を
 *     unanimous 判定の必須条件にする)
 *   - `buildRevisionPrompt(transcript, consensus)` は consensus 3 分岐に応じた
 *     Round 3 プロンプト (自然言語日本語) を Round 1 の 3 者引用 + Round 2 の
 *     stance 引用で組み立てる
 *   - `total_latency_ms` は Round 1-2 全体の経過時間 (Round 1 と Round 2 が直列)
 */

import type {
  ProviderClient,
  ProviderErrorCode,
  ProviderResponse,
  Result,
} from "./providers/types.js";

export type SpeakerName = "chatgpt" | "claude" | "gemini";

/**
 * Council 層固有のエラーコード。
 * - provider 層の `ProviderErrorCode` を包含する (provider 失敗は council でもそのまま記録する)
 * - `round1_failed`: Round 1 で失敗した speaker の Round 2 を skip したことを表す
 *   council 固有コード (provider 層には存在しない)。types.ts を汚さないためここに定義する
 */
export type CouncilErrorCode = ProviderErrorCode | "round1_failed";

export type CouncilSpeakerError = {
  code: CouncilErrorCode;
  message: string;
  /** provider 層から引き継がれる場合のみ入る (rate_limited の reset 時刻など) */
  resetAt?: string;
};

/**
 * Round 2 の各 speaker が 3 者の Round 1 に対して表明する 4 値 stance。
 * - agree: 3 者の Round 1 が概ね整合している。大きな修正は不要
 * - extend: 3 者の Round 1 は概ね整合しているが、補足視点を追加したい
 * - partial: 3 者の Round 1 の一部は一致、一部に異論あり
 * - disagree: 3 者の Round 1 に根本的に同意しない
 *
 * "批判" 用語を避けているのは、LLM-as-critic の 3 失敗モード (sycophancy flip /
 * confabulated disagreement / confirmation signal の喪失) を避けるため。
 * 同意も正当な出力として扱う。
 */
export type Stance = "agree" | "extend" | "partial" | "disagree";

export type Speaker = {
  name: SpeakerName;
  /** 発言本文。Round 1 は自由回答文、Round 2 は stance の reason を入れる */
  content?: string;
  /** Round 2 で parse した stance。Round 1 speaker と parse 失敗 / provider エラー
   * / Round 1 failed による skip 時は undefined */
  stance?: Stance;
  /** provider が失敗したとき、rejected Promise を拾ったとき、または Round 2 が
   * Round 1 失敗により skip されたとき (`error.code = "round1_failed"`) */
  error?: CouncilSpeakerError;
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
  /**
   * ChatGPT が tool 応答を読んで "Round 3 (改訂案)" を書くためのプロンプト。
   * consensus 3 分岐に応じて命令部分を切り替え、Round 1-2 の要点を引用する。
   * tool handler がこれを MCP 応答の `content` フィールドに埋める想定。
   */
  revision_prompt: string;
  /** Round 1-2 を通した wall-clock time。Round 2 の並列効果がそのまま現れる */
  total_latency_ms: number;
};

export type CouncilErrorSummary = {
  code: "all_providers_failed";
  message: string;
  providers: Array<{
    name: Exclude<SpeakerName, "chatgpt">;
    error: CouncilSpeakerError;
  }>;
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

const STANCE_LABEL: Record<Stance, string> = {
  agree: "同意",
  extend: "同意 + 補足",
  partial: "部分同意",
  disagree: "不同意",
};

const SPEAKER_LABEL: Record<SpeakerName, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
};

function formatSpeakerQuote(
  speaker: Speaker & { stance: Stance; content: string },
): string {
  const name = SPEAKER_LABEL[speaker.name];
  const stance = STANCE_LABEL[speaker.stance];
  return `【${name} / stance: ${stance}】\n${speaker.content}`;
}

/**
 * consensus 3 分岐に応じて、ChatGPT が Round 3 (改訂案) を書くためのプロンプトを生成する。
 *
 * 設計指針 (spec-003 technical notes):
 *   - ChatGPT が tool 応答を読んで「次の発話として改訂案を書きたくなる」導線を作る
 *   - 命令形 + Round 1-2 の要点引用 + 期待フォーマット の 3 要素を必ず含む
 *   - consensus に応じて命令部分を切り替えるのが肝
 *   - 生成物は自然言語の日本語 (JSON や schema ではない) — `content` は ChatGPT が
 *     プロンプト継続として解釈するため
 *
 * Round 2 の引用対象は `stance !== undefined` かつ `content !== undefined` の speaker
 * のみ (parse 失敗や provider エラーで stance が無い speaker は除外)。
 */
function formatRound1Quote(speaker: Speaker): string {
  const name = SPEAKER_LABEL[speaker.name];
  if (speaker.error || !speaker.content) {
    return `【${name} の Round 1】(回答取得失敗)`;
  }
  return `【${name} の Round 1】\n${speaker.content}`;
}

export function buildRevisionPrompt(
  transcript: CouncilTranscript,
  consensus: Consensus,
): string {
  const round1 = transcript.rounds.find((r) => r.label === "round_1");
  const round2 = transcript.rounds.find((r) => r.label === "round_2");

  const round1Quotes = (round1?.speakers ?? [])
    .map(formatRound1Quote)
    .join("\n\n");

  const availableSpeakers = (round2?.speakers ?? []).filter(
    (s): s is Speaker & { stance: Stance; content: string } =>
      s.stance !== undefined && s.content !== undefined,
  );
  const round2QuotesBlock = availableSpeakers.length
    ? availableSpeakers.map(formatSpeakerQuote).join("\n\n")
    : "(Round 2 の有効な発言はありませんでした)";

  const headerByConsensus: Record<Consensus, string> = {
    unanimous_agree: [
      "【合議結果: Round 1 の 3 者回答は整合しています】",
      "Round 2 で Claude / Gemini とも 3 者の Round 1 が整合していると判断しました。改訂は原則不要です。",
      "ただし Round 2 で補足視点 (extend) が出ている場合は、1〜2 行だけあなたの回答に追記してください。",
      "補足が無ければ「合議の結果、改訂は不要と判断しました」と一言添えて初案をそのまま提示してください。",
    ].join("\n"),
    mixed: [
      "【合議結果: 3 者の Round 1 に不整合がある】",
      "Round 2 で Claude / Gemini の見解が分かれました。以下の論点を踏まえて、初案を改訂してください。",
      "同意された部分は維持し、異論・補足は本文に織り込み、最終的な結論を明確に示してください。",
    ].join("\n"),
    unanimous_disagree: [
      "【合議結果: 3 者の Round 1 が大きく食い違っている】",
      "Round 2 で Claude / Gemini とも 3 者の Round 1 の整合性に重大な問題を指摘しています。根本から書き直してください。",
      "Round 2 で示された論点を踏まえ、初案の前提や結論を見直した上で、あらためて回答を組み立ててください。",
    ].join("\n"),
  };

  const tailInstruction = [
    "──",
    "次の発話として、上記を踏まえたあなたの Round 3 (改訂版) 回答を日本語で提示してください。",
    "回答本文のみで十分です (合議過程の再説明は不要)。",
  ].join("\n");

  return [
    headerByConsensus[consensus],
    "",
    "【Round 1: 3 者の独立回答】",
    round1Quotes,
    "",
    "【Round 2 の独立評価】",
    round2QuotesBlock,
    "",
    tailInstruction,
  ].join("\n");
}

export function summarizeCouncilFailure(
  transcript: CouncilTranscript,
): CouncilErrorSummary {
  const round2 = transcript.rounds.find((r) => r.label === "round_2");
  const providers = (round2?.speakers ?? []).flatMap((speaker) => {
    if (speaker.name === "chatgpt" || speaker.error === undefined) {
      return [];
    }
    return [{ name: speaker.name, error: speaker.error }];
  });

  const providerSummary = providers
    .map(({ name, error }) => `${SPEAKER_LABEL[name]}=${error.code}`)
    .join(", ");

  return {
    code: "all_providers_failed",
    message:
      providers.length > 0
        ? `Round 2 failed for all providers (${providerSummary}).`
        : "Round 2 failed before any provider result was recorded.",
    providers,
  };
}

/**
 * Round 2 のプロンプトを speaker 別に生成する。
 *
 * 1 tool call 内 2 ラウンド設計の肝: self speaker には "あなた自身の Round 1" を、
 * 他 2 者には "比較対象" を見せる。anchoring が相互にかかる構造。
 *
 * self の Round 1 が失敗しているケースはこの関数の呼び出し元で skip しているので、
 * ここでは self.content が存在する前提。ただし型上 undefined を扱えるようにして、
 * 呼び出し側のバグがあっても落ちないようにしている。
 */
function buildRound2Prompt(
  input: CouncilInput,
  selfName: Exclude<SpeakerName, "chatgpt">,
  round1Speakers: Speaker[],
): string {
  const selfLabel = SPEAKER_LABEL[selfName];
  const selfR1 = round1Speakers.find((s) => s.name === selfName);
  const othersR1 = round1Speakers.filter(
    (s): s is Speaker & { content: string } =>
      s.name !== selfName && s.content !== undefined,
  );

  const selfBlock = selfR1?.content
    ? `【あなた (${selfLabel}) の Round 1 回答】\n${selfR1.content}`
    : `【あなた (${selfLabel}) の Round 1 回答】\n(回答が取得できませんでした)`;

  const otherBlocks =
    othersR1.length > 0
      ? othersR1
          .map(
            (s) =>
              `【${SPEAKER_LABEL[s.name]} の Round 1 回答】\n${s.content}`,
          )
          .join("\n\n")
      : "(他のモデルの Round 1 回答はありません)";

  return [
    `あなたは合議に参加する独立評価者 "${selfLabel}" です。`,
    "同じ質問に対して、3 者 (ChatGPT / Claude / Gemini) が互いを見ずに独立回答を出しました。",
    "あなた自身の Round 1 回答と他 2 者の回答を比較して、3 者の合議としての整合性に対する立場 (stance) を表明してください。",
    "",
    "【重要】これは『批判』を求めるプロンプトではありません。同意も正当な出力です。",
    "他 2 者の回答があなたと整合していれば素直に同意してください。欠点を無理に捻り出す必要はありません。",
    "逆に他 2 者の回答があなたと重要な論点でずれていれば端的に指摘してください。",
    "",
    "次の 4 値のいずれかで、3 者の Round 1 を踏まえたあなたの立場を示してください:",
    "- agree: 3 者の Round 1 が概ね整合している。大きな修正は不要",
    "- extend: 3 者の Round 1 は概ね整合しているが、補足視点を追加したい",
    "- partial: 3 者の Round 1 の一部は一致、一部に異論あり",
    "- disagree: 3 者の Round 1 に根本的に同意しない",
    "",
    "回答は以下の JSON 形式で返してください。他のテキストや markdown コードフェンスは不要です。",
    '{"stance": "agree", "reason": "3 者の論理構成は妥当で大きなズレは見当たりません。"}',
    "",
    "- stance は必ず agree / extend / partial / disagree のいずれかにしてください",
    "- reason は 200 字以内の日本語で、あなたの立場の根拠を簡潔に示してください",
    "",
    "------",
    `質問: ${input.question}`,
    "",
    selfBlock,
    "",
    otherBlocks,
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

/**
 * 1 speaker 分の Round 2 を実行する。
 *
 * Round 1 で失敗した speaker は API を呼ばず `error.code = round1_failed` で skip する。
 * API 呼び出しが rejected / result.ok === false の場合は error を記録。
 * 成功した場合は `applyStanceParsing` で structured output をパース。
 */
async function runRound2ForSpeaker(
  name: Exclude<SpeakerName, "chatgpt">,
  provider: ProviderClient,
  input: CouncilInput,
  round1Speakers: Speaker[],
): Promise<Speaker> {
  const selfR1 = round1Speakers.find((s) => s.name === name);
  if (!selfR1 || selfR1.error !== undefined || selfR1.content === undefined) {
    return {
      name,
      error: {
        code: "round1_failed",
        message: `Round 2 skipped because Round 1 failed for ${SPEAKER_LABEL[name]}.`,
      },
    };
  }
  const prompt = buildRound2Prompt(input, name, round1Speakers);
  try {
    const result = await provider.ask(prompt);
    if (!result.ok) return { name, error: result.error };
    return applyStanceParsing({ name, content: result.data.text });
  } catch (err) {
    return {
      name,
      error: {
        code: "network_error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function runCouncil(
  input: CouncilInput,
  providers: CouncilProviders,
): Promise<CouncilTranscript> {
  const start = Date.now();

  // Round 1: Claude / Gemini を同じ質問で並列呼び出し (独立回答)
  const round1Settled = await Promise.allSettled([
    providers.claude.ask(input.question),
    providers.gemini.ask(input.question),
  ]);
  const round1: Round = {
    label: "round_1",
    speakers: [
      { name: "chatgpt", content: input.chatgpt_initial_answer },
      settledToSpeaker("claude", round1Settled[0]),
      settledToSpeaker("gemini", round1Settled[1]),
    ],
  };

  // Round 2: Round 1 が成功した speaker のみ独立評価を呼ぶ
  const [claudeR2, geminiR2] = await Promise.all([
    runRound2ForSpeaker("claude", providers.claude, input, round1.speakers),
    runRound2ForSpeaker("gemini", providers.gemini, input, round1.speakers),
  ]);
  const round2: Round = {
    label: "round_2",
    speakers: [claudeR2, geminiR2],
  };

  const consensus = computeConsensus(round2.speakers);

  // revision_prompt は transcript に自己参照なので先に partial transcript を作る
  const partial: Omit<CouncilTranscript, "revision_prompt"> = {
    question: input.question,
    chatgpt_initial_answer: input.chatgpt_initial_answer,
    rounds: [round1, round2],
    consensus,
    total_latency_ms: Date.now() - start,
  };
  const revisionPrompt = buildRevisionPrompt(
    { ...partial, revision_prompt: "" },
    consensus,
  );
  return { ...partial, revision_prompt: revisionPrompt };
}
