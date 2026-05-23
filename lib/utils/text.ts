// 日本語テキストの形態素解析 + 頻出語抽出ユーティリティ。
// ADR-016 準拠の月次レポート(SPEC §9)で deterministic に word_frequencies を計算する。

// tiny-segmenter の型定義は同ディレクトリの tiny-segmenter.d.ts で補完。
import TinySegmenter from "tiny-segmenter";

const segmenter = new TinySegmenter();

/**
 * 月次レポート向けの簡易 JP ストップワード。
 * 助詞・助動詞・指示詞・頻出汎用語など、頻度トップに来やすいが「ユーザーらしい語」では
 * ない token を除外する。Phase 0+α 観察で実用上問題があれば追補。
 */
const JP_STOP_WORDS = new Set([
  // 動詞・助動詞
  "する", "した", "して", "され", "なる", "なっ", "なら",
  "ある", "あっ", "ない", "いる", "いた", "でき", "できる",
  "思う", "思っ", "思った", "言う", "言っ", "見る", "見え",
  // 形式名詞
  "こと", "もの", "とき", "ところ", "わけ", "つもり", "はず",
  // 指示・代名詞
  "それ", "これ", "あれ", "どれ", "ここ", "そこ", "あそこ",
  "自分", "私", "僕", "あなた",
  // 時間
  "今日", "昨日", "明日", "今", "後", "前", "間",
  // 副詞・接続
  "ちょっと", "とても", "すごく", "本当", "結構", "少し",
  "また", "まだ", "もう", "やっぱり", "たぶん",
  // 助詞・助動詞の単独残骸
  "から", "まで", "ので", "けど", "でも", "って",
]);

/**
 * 日本語テキストを tokenize し、頻度カウントに使う形態素のリストを返す。
 *
 * 除外:
 * - 長さ 1 の token(単漢字・ひらがな1字は意味の取り出しが薄く noise になりやすい)
 * - 句読点・空白・数字のみの token
 * - {@link JP_STOP_WORDS}
 */
export function tokenizeJapanese(text: string): string[] {
  if (!text) return [];
  return segmenter.segment(text)
    .map((t) => t.trim())
    .filter((t) => {
      if (t.length < 2) return false;
      if (JP_STOP_WORDS.has(t)) return false;
      // 句読点・記号・数字のみは除外
      if (/^[\s\p{P}\d]+$/u.test(t)) return false;
      return true;
    });
}

/**
 * 複数テキストから頻出語を集計し、降順で上位 N 語を返す。
 * 月次レポートの word_frequencies(deterministic)生成に使う。
 */
export function wordFrequencies(
  texts: string[],
  topN = 15,
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const tok of tokenizeJapanese(text)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}
