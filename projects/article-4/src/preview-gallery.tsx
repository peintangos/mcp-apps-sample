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
        {
          name: "claude",
          content:
            "初学者には Go が適しています。シンプルな文法、充実した標準ライブラリ、goroutine による並行処理モデルが学習者に優しい言語設計です。Rust は所有権モデルの理解に時間がかかるため、プログラミング基礎を習得した後に挑戦するのが現実的です。",
        },
        {
          name: "gemini",
          content:
            "初学者なら Go をおすすめします。理由は (1) 文法が小さくキーワードが少ない、(2) エラー処理が明示的で隠れた挙動が少ない、(3) 組み込みの並行処理 (goroutine / channel) で並列プログラミングの直観を早期に獲得できる、の 3 点です。Rust は安全性に優れますが借用チェッカの習得コストが高めです。",
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "3 者の Round 1 に整合しています。補足として、Rust の所有権・借用モデルは初学者にとって挫折リスクが高く、Go → Rust の順で学ぶとメモリ管理の概念を段階的に身につけられます。",
          stance: "extend",
        },
        {
          name: "gemini",
          content:
            "3 者とも Go 推奨で整合しており、文法的シンプルさ・標準ライブラリの充実・並行処理モデルの利点について見解が一致しています。",
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
        {
          name: "claude",
          content:
            "判断軸は「チーム規模」ではなく「ドメイン境界の明確さ」と「デプロイ独立性の必要度」です。小規模チームでもドメインが明確に分かれていて、かつ独立リリースが必要ならマイクロサービスの検討価値はあります。逆に 100 人規模でも単一ドメインならモノリスのまま運用可能です。",
        },
        {
          name: "gemini",
          content:
            "モノリスファーストが安全な出発点であるのは広く知られた経験則です。ただしモノリス内部でモジュール境界を明確にする設計 (Modular Monolith) を採用しておけば、将来の分割判断も容易になります。「分割すべきか」を一度の決断にするのではなく、モジュラリティを段階的に高める道筋を用意することが重要です。",
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "初案のモノリス優先は妥当ですが、「50 人」という閾値の根拠が不明確で、私の Round 1 で示したドメイン境界軸と食い違います。チーム規模だけを基準にすると判断軸が粗すぎます。",
          stance: "partial",
        },
        {
          name: "gemini",
          content:
            "モノリスファーストの結論は 3 者で一致しています。ただし初案は「マイクロサービスのメリットが薄い」と断定しすぎで、Modular Monolith のような中間形態への言及があると実践的です。",
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
        {
          name: "claude",
          content:
            "いいえ、1 + 1 = 2 です。これは標準的な算術における定義から直接導かれる事実で、例外はありません。",
        },
        {
          name: "gemini",
          content:
            "1 + 1 は 2 です。教科書での扱いも含めて、通常の算術において 1 + 1 が 3 になることはありません。",
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "ChatGPT の Round 1 は明らかに誤りで、私と Gemini の Round 1 (1 + 1 = 2) とも矛盾します。「どの教科書にも記載されている」という主張も事実に反します。根本的な修正が必要です。",
          stance: "disagree",
        },
        {
          name: "gemini",
          content:
            "ChatGPT の Round 1 は数学的に不正確で、3 者の Round 1 に整合性がありません。私と Claude の Round 1 は一致しており、標準的な算術の結果は 1 + 1 = 2 です。完全に書き直すべきです。",
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
        {
          name: "claude",
          content:
            "生産性は文脈依存です。大規模プロジェクトでは React のエコシステムが有利ですが、小〜中規模なら Vue の Composition API + Nuxt が初速で上回ることも多い。チーム習熟度と要件規模の両軸で選ぶのが実情です。",
        },
        {
          name: "gemini",
          error: {
            code: "unauthenticated",
            message: "API key not valid. Please pass a valid API key.",
          },
        },
      ],
    },
    {
      label: "round_2",
      speakers: [
        {
          name: "claude",
          content:
            "React のエコシステム規模は事実ですが、初案の「生産性が高い」は文脈依存で、私の Round 1 で示した小〜中規模案件での Vue の優位性を捉えきれていません。",
          stance: "partial",
        },
        {
          name: "gemini",
          error: {
            code: "round1_failed",
            message: "Round 2 skipped because Round 1 failed for Gemini.",
          },
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
