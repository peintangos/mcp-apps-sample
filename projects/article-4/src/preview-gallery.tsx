import { RoundTimeline } from "./components/RoundTimeline.js";
import { SingleAnswerView } from "./components/SingleAnswerView.js";
import { useColors } from "./theme.js";
import type { CouncilStructured, SingleAnswerStructured } from "./ui-router.js";

// ── Mock data ──────────────────────────────────────────────

const MOCK_CLAUDE: SingleAnswerStructured = {
  question: "Rust と Go、初学者が最初に学ぶならどちらが良いですか？",
  claude_answer:
    "初学者には **Go** をおすすめします。\n\n理由:\n- 文法がシンプルで学習曲線が緩やか\n- 標準ライブラリが充実しており、すぐに実用的なプログラムが書ける\n- 並行処理 (goroutine) を自然に学べる\n\nRust は所有権・借用モデルの理解にかなりの時間がかかるため、2 言語目以降に学ぶとスムーズです。",
  model_used: "claude-sonnet-4-6",
  latency_ms: 2895,
};

const MOCK_GEMINI: SingleAnswerStructured = {
  question: "TypeScript の型推論はどこまで信頼できますか？",
  gemini_answer:
    "TypeScript の型推論は非常に強力で、多くの場面で明示的な型注釈なしに正確な型を導出します。\n\n## 信頼できるケース\n- 変数の初期化時: `const x = 42` → `number`\n- 関数の戻り値: return 文から自動推論\n- ジェネリクスのパラメータ推論\n\n## 注意が必要なケース\n- 空配列 `[]` は `never[]` に推論される\n- `as const` なしのオブジェクトリテラルは widening される",
  model_used: "gemini-2.5-flash",
  latency_ms: 1657,
};

const MOCK_UNANIMOUS_AGREE: CouncilStructured = {
  question: "Rust と Go、初学者が最初に学ぶならどちらが良いですか？",
  chatgpt_initial_answer:
    "初学者には Go をおすすめします。文法がシンプルで、goroutine による並行処理も自然に学べます。Rust は所有権モデルの学習コストが高いため、2 言語目以降がベストです。",
  rounds: [
    {
      label: "round_1",
      speakers: [
        {
          name: "chatgpt",
          content:
            "初学者には Go をおすすめします。文法がシンプルで、goroutine による並行処理も自然に学べます。Rust は所有権モデルの学習コストが高いため、2 言語目以降がベストです。",
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "初案の Go 推奨に同意します。補足として、Rust の所有権・借用モデルは初学者にとって挫折リスクが高く、最初の言語としては認知負荷が大きすぎます。Go → Rust の順で学ぶと、メモリ管理の概念を段階的に身につけられます。",
          stance: "extend",
        },
        {
          name: "gemini",
          content:
            "Go の文法的シンプルさと早期実用性は初学者向けとして妥当です。標準ライブラリの充実度も学習体験を良くします。",
          stance: "agree",
        },
      ],
    },
  ],
  consensus: "unanimous_agree",
  revision_prompt: "(revision prompt for ChatGPT)",
  total_latency_ms: 5985,
};

const MOCK_MIXED: CouncilStructured = {
  question: "マイクロサービスとモノリスのどちらを選ぶべきですか？",
  chatgpt_initial_answer:
    "スタートアップや小規模チームでは、まずモノリスで始めるべきです。マイクロサービスは運用コストが高く、チーム規模が 50 人を超えるまでは分割のメリットが薄いです。",
  rounds: [
    {
      label: "round_1",
      speakers: [
        {
          name: "chatgpt",
          content:
            "スタートアップや小規模チームでは、まずモノリスで始めるべきです。マイクロサービスは運用コストが高く、チーム規模が 50 人を超えるまでは分割のメリットが薄いです。",
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "モノリス優先の方針には同意しますが、「50 人」という閾値は根拠が不明確です。チーム規模よりもドメイン境界の明確さやデプロイ頻度の方が分割判断に重要な指標です。",
          stance: "partial",
        },
        {
          name: "gemini",
          content:
            "モノリスファーストの結論は妥当です。ただし初案は「マイクロサービスのメリットが薄い」と断定しすぎです。イベント駆動やメッセージキューなど、モノリス内でも疎結合を維持する設計パターンへの言及があると、より実践的な回答になります。",
          stance: "extend",
        },
      ],
    },
  ],
  consensus: "mixed",
  revision_prompt: "(revision prompt for ChatGPT)",
  total_latency_ms: 7234,
};

const MOCK_UNANIMOUS_DISAGREE: CouncilStructured = {
  question: "1 + 1 = 3 ですか？",
  chatgpt_initial_answer:
    "はい、1 + 1 = 3 です。これはどの教科書にも記載されている基本的な算数の事実です。",
  rounds: [
    {
      label: "round_1",
      speakers: [
        {
          name: "chatgpt",
          content:
            "はい、1 + 1 = 3 です。これはどの教科書にも記載されている基本的な算数の事実です。",
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "初案は明らかに誤りです。1 + 1 = 2 であり、これは算数の最も基本的な事実です。「どの教科書にも記載されている」という主張も事実に反します。根本的な修正が必要です。",
          stance: "disagree",
        },
        {
          name: "gemini",
          content:
            "初案は数学的に不正確です。標準的な算術において 1 + 1 = 2 です。教科書の記載があるという主張も確認できません。完全に書き直すべきです。",
          stance: "disagree",
        },
      ],
    },
  ],
  consensus: "unanimous_disagree",
  revision_prompt: "(revision prompt for ChatGPT)",
  total_latency_ms: 3986,
};

const MOCK_PARTIAL_FAILURE: CouncilStructured = {
  question: "React と Vue、どちらが生産性が高いですか？",
  chatgpt_initial_answer:
    "React の方が生産性が高いです。エコシステムが大きく、ライブラリの選択肢が豊富です。",
  rounds: [
    {
      label: "round_1",
      speakers: [
        {
          name: "chatgpt",
          content:
            "React の方が生産性が高いです。エコシステムが大きく、ライブラリの選択肢が豊富です。",
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "React のエコシステムの規模は事実ですが、「生産性が高い」は文脈依存です。Vue の Composition API + Nuxt は小〜中規模プロジェクトで React + Next.js を上回る初速を出せます。",
          stance: "partial",
        },
        {
          name: "gemini",
          error: { code: "unauthenticated", message: "API key not valid. Please pass a valid API key." },
        },
      ],
    },
  ],
  consensus: "mixed",
  revision_prompt: "(revision prompt for ChatGPT)",
  total_latency_ms: 4521,
};

// ── Preview Gallery ────────────────────────────────────────

export function PreviewGallery({
  onToggleTheme,
  currentTheme,
}: {
  onToggleTheme: () => void;
  currentTheme: "light" | "dark";
}) {
  const colors = useColors();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem", color: colors.text }}>
          Article 4 — Component Preview
        </h1>
        <button
          onClick={onToggleTheme}
          style={{
            padding: "0.375rem 0.75rem",
            borderRadius: "0.5rem",
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          Theme: {currentTheme}
        </button>
      </div>

      <PreviewSection title="ask_claude — Single Answer">
        <SingleAnswerView provider="claude" structured={MOCK_CLAUDE} />
      </PreviewSection>

      <PreviewSection title="ask_gemini — Single Answer">
        <SingleAnswerView provider="gemini" structured={MOCK_GEMINI} />
      </PreviewSection>

      <PreviewSection title="start_council — unanimous_agree">
        <RoundTimeline transcript={MOCK_UNANIMOUS_AGREE} />
      </PreviewSection>

      <PreviewSection title="start_council — mixed">
        <RoundTimeline transcript={MOCK_MIXED} />
      </PreviewSection>

      <PreviewSection title="start_council — unanimous_disagree">
        <RoundTimeline transcript={MOCK_UNANIMOUS_DISAGREE} />
      </PreviewSection>

      <PreviewSection title="start_council — partial failure (Gemini error)">
        <RoundTimeline transcript={MOCK_PARTIAL_FAILURE} />
      </PreviewSection>

      <PreviewSection title="start_council — loading">
        <RoundTimeline transcript={null} isLoading />
      </PreviewSection>
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();

  return (
    <section>
      <h2
        style={{
          margin: "0 0 0.75rem",
          fontSize: "0.6875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: colors.textMuted,
          borderBottom: `1px solid ${colors.border}`,
          paddingBottom: "0.375rem",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
