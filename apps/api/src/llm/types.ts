import type { Answer, Question } from "@curator/shared";

export interface AnsweredQuestion {
  question: Question;
  answer: Answer;
}

export interface NextQuestionInput {
  /** Questions already answered so far. */
  questionCount: number;
  minQuestions: number;
  maxQuestions: number;
  history: AnsweredQuestion[];
}

/** Either the next question, or a signal that the quiz is complete. */
export type NextQuestionResult =
  | { done: false; question: Question }
  | { done: true };

export interface QuizLlmProvider {
  readonly name: string;
  nextQuestion(input: NextQuestionInput): Promise<NextQuestionResult>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
