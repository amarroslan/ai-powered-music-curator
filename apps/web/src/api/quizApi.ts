import type {
  NextQuestionResponse,
  QuizHistoryEntry,
} from "@curator/shared";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      (detail as { error?: string } | null)?.error ?? `API ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

/** Sends the full history; the server returns the next turn. */
export function nextQuestion(
  history: QuizHistoryEntry[],
): Promise<NextQuestionResponse> {
  return post<NextQuestionResponse>("/api/quiz/next", { history });
}
