import { randomUUID } from "node:crypto";
import type { Answer, Question } from "@curator/shared";

export type QuizStatus = "active" | "generating" | "done" | "failed";

export interface QuizRecord {
  id: string;
  status: QuizStatus;
  questionCount: number;
  history: Array<{ question: Question; answer: Answer }>;
  /** The question most recently issued, awaiting an answer. */
  pendingQuestion: Question | null;
  createdAt: Date;
}

/**
 * Storage abstraction for quiz sessions. M2 ships an in-memory store;
 * M4 swaps in a Prisma-backed implementation of this same interface
 * (SPEC.md §7 — sessions become durable and claimable by accounts).
 */
export interface QuizStore {
  create(): Promise<QuizRecord>;
  get(id: string): Promise<QuizRecord | null>;
  setPendingQuestion(id: string, question: Question): Promise<void>;
  /** Commits an answer to the issued pending question and advances the count. */
  appendAnswer(
    id: string,
    question: Question,
    answer: Answer,
    questionCount: number,
  ): Promise<void>;
  setStatus(id: string, status: QuizStatus): Promise<void>;
}

const TTL_MS = 24 * 60 * 60 * 1000;

export function createMemoryQuizStore(): QuizStore {
  const sessions = new Map<string, QuizRecord>();

  return {
    async create() {
      // Lazy TTL sweep keeps the dev-process map bounded.
      const now = Date.now();
      for (const [key, rec] of sessions) {
        if (now - rec.createdAt.getTime() > TTL_MS) sessions.delete(key);
      }

      const rec: QuizRecord = {
        id: randomUUID(),
        status: "active",
        questionCount: 0,
        history: [],
        pendingQuestion: null,
        createdAt: new Date(),
      };
      sessions.set(rec.id, rec);
      return rec;
    },

    async get(id) {
      return sessions.get(id) ?? null;
    },

    async setPendingQuestion(id, question) {
      const rec = sessions.get(id);
      if (!rec) throw new Error(`unknown quiz session ${id}`);
      rec.pendingQuestion = question;
    },

    async appendAnswer(id, question, answer, questionCount) {
      const rec = sessions.get(id);
      if (!rec) throw new Error(`unknown quiz session ${id}`);
      rec.history.push({ question, answer });
      rec.questionCount = questionCount;
      rec.pendingQuestion = null;
    },

    async setStatus(id, status) {
      const rec = sessions.get(id);
      if (!rec) throw new Error(`unknown quiz session ${id}`);
      rec.status = status;
    },
  };
}
