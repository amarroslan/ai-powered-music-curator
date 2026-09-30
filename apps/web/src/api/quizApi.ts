import type {
  Answer,
  NextQuestionResponse,
  Question,
  StartQuizResponse,
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

export function startQuiz(): Promise<StartQuizResponse> {
  return post<StartQuizResponse>("/api/quiz/start", {});
}

export function submitAnswer(
  sessionId: string,
  answer: Answer,
): Promise<NextQuestionResponse> {
  return post<NextQuestionResponse>("/api/quiz/next", {
    sessionId,
    answers: [answer],
  });
}

export function generatePlaylist(sessionId: string): Promise<{ status: string }> {
  return post("/api/quiz/generate", { sessionId });
}
