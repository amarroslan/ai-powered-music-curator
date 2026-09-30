import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Answer, Question } from "@curator/shared";
import * as api from "../api/quizApi";

export type QuizPhase = "starting" | "asking" | "submitting" | "error";

interface QuizFlowState {
  phase: QuizPhase;
  sessionId: string | null;
  question: Question | null;
  questionCount: number;
  error: string | null;
}

const INITIAL: QuizFlowState = {
  phase: "starting",
  sessionId: null,
  question: null,
  questionCount: 0,
  error: null,
};

/** Owns the whole quiz flow: start → ask → answer → … → generate. */
export function useQuiz() {
  const navigate = useNavigate();
  const [state, setState] = useState<QuizFlowState>(INITIAL);

  const begin = useCallback(async () => {
    setState(INITIAL);
    try {
      const res = await api.startQuiz();
      setState({
        phase: "asking",
        sessionId: res.sessionId,
        question: res.question,
        questionCount: 1,
        error: null,
      });
    } catch (err) {
      setState({
        ...INITIAL,
        phase: "error",
        error: err instanceof Error ? err.message : "Could not start the quiz",
      });
    }
  }, []);

  const answer = useCallback(
    async (answer: Answer) => {
      if (!state.sessionId) return;
      setState((s) => ({ ...s, phase: "submitting", error: null }));
      try {
        const res = await api.submitAnswer(state.sessionId, answer);
        if (res.done) {
          await api.generatePlaylist(state.sessionId);
          navigate("/generating");
          return;
        }
        setState((s) => ({
          ...s,
          phase: "asking",
          question: res.question,
          questionCount: s.questionCount + 1,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "Something went wrong",
        }));
      }
    },
    [state.sessionId, navigate],
  );

  const retry = useCallback(() => {
    void begin();
  }, [begin]);

  return { ...state, begin, answer, retry };
}
