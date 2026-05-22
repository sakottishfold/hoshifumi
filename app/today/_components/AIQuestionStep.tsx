"use client";

// ADR-012/024 AI follow-up question UI(multi-turn)。
// QuestionFlow から Q2 完了後に render される。
// AI と最大3問の対話 → done で onComplete(turns) を呼ぶ。
// 初問失敗時は onComplete([]) で silent skip 通知。

import { useCallback, useEffect, useRef, useState } from "react";
import { generateFollowUpQuestion } from "@/lib/server-actions/ai-followup";
import type { FollowUpTurn } from "@/lib/types";

interface Props {
  bodySensationLabel: string;
  freeText: string;
  /** AI 対話完了通知。空配列 = silent skip。 */
  onComplete: (turns: FollowUpTurn[]) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "answering"; question: string }
  | { kind: "done" };

export function AIQuestionStep({
  bodySensationLabel,
  freeText,
  onComplete,
}: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 確定済みターン(re-render をまたいで保持)
  const turnsRef = useRef<FollowUpTurn[]>([]);
  // 初問取得の二重発火(StrictMode)対策
  const startedRef = useRef(false);

  // dialog 履歴を渡して次の outcome を取得し state を進める。
  const advance = useCallback(
    async (dialog: FollowUpTurn[]) => {
      setState({ kind: "loading" });
      const outcome = await generateFollowUpQuestion({
        bodySensationLabel,
        freeText,
        dialog,
      });
      if ("question" in outcome) {
        setSubmitting(false);
        setState({ kind: "answering", question: outcome.question });
      } else {
        // done または error(初問のみ)。done なら対話あり、error なら dialog は空。
        setState({ kind: "done" });
        onComplete(dialog);
      }
    },
    [bodySensationLabel, freeText, onComplete],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void advance([]);
  }, [advance]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answer.trim() || submitting || state.kind !== "answering") return;
    setSubmitting(true);
    const nextTurns: FollowUpTurn[] = [
      ...turnsRef.current,
      { question: state.question, answer: answer.trim() },
    ];
    turnsRef.current = nextTurns;
    setAnswer("");
    void advance(nextTurns);
  }

  if (state.kind === "loading") {
    return (
      <div className="space-y-6 pt-4">
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-12 h-12 rounded-full bg-primary-500/30 animate-pulse" />
          <p className="text-sm text-neutral-500">ひと呼吸…</p>
        </div>
      </div>
    );
  }

  // done:onComplete 済み、QuestionFlow が次 step へ進め本 component は unmount。
  if (state.kind === "done") {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6 space-y-2">
        <p className="text-xs font-medium text-primary-700">AI からの問い</p>
        <p className="text-base text-neutral-800 leading-relaxed">
          {state.question}
        </p>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        placeholder="思ったままを書く"
        className="w-full rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-base leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
      />

      <button
        type="submit"
        disabled={!answer.trim() || submitting}
        className="w-full rounded-xl bg-primary-500 px-4 py-3.5 text-base font-medium text-neutral-50 shadow-sm transition hover:bg-primary-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        つぎへ
      </button>
    </form>
  );
}
