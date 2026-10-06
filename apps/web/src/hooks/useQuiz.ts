import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Answer, Question, QuizHistoryEntry } from "@curator/shared";
import { nextQuestion } from "../api/quizApi";

export type QuizPhase = "asking" | "submitting" | "error";

interface QuizFlowState {
  phase: QuizPhase;
  /** The question currently on screen, awaiting an answer. */
  question: Question | null;
  history: QuizHistoryEntry[];
  error: string | null;
}

const INITIAL: QuizFlowState = {
  phase: "asking",
  question: null,
  history: [],
  error: null,
};

/**
 * Client-side quiz flow for the stateless API: history lives here, is
 * sent with every answer, and grows by one entry per turn. The first
 * question is served locally so the quiz opens instantly.
 */
export function useQuiz(firstQuestion: Question) {
  const navigate = useNavigate();
  const [state, setState] = useState<QuizFlowState>({
    ...INITIAL,
    question: firstQuestion,
  });

  const advance = useCallback(
    async (history: QuizHistoryEntry[]) => {
      setState((s) => ({ ...s, phase: "submitting", error: null }));
      try {
        const res = await nextQuestion(history);
        if (res.done) {
          // Hand the full transcript to the curation pipeline (M3).
          navigate("/generating", { state: { history } });
          return;
        }
        setState((s) => ({
          ...s,
          phase: "asking",
          question: res.question,
          history,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "Something went wrong",
        }));
      }
    },
    [navigate],
  );

  const answer = useCallback(
    (answer: Answer) => {
      if (!state.question) return;
      const entry: QuizHistoryEntry = { question: state.question, answer };
      void advance([...state.history, entry]);
    },
    [state.question, state.history, advance],
  );

  const retry = useCallback(() => {
    setState({ ...INITIAL, question: firstQuestion });
  }, [firstQuestion]);

  return { ...state, questionCount: state.history.length + 1, answer, retry };
}
