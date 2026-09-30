import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@curator/shared";

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}

/** Small status chip proving the web → API wiring (and DB reachability). */
export function HealthBadge() {
  const { data, isError, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  const state = isPending
    ? { dot: "bg-sunshine", label: "checking API…" }
    : isError
      ? { dot: "bg-neon-pink", label: "API offline" }
      : data!.db === "available"
        ? { dot: "bg-emerald-400", label: "API online · DB connected" }
        : { dot: "bg-sunshine", label: "API online · DB unavailable" };

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-white/80">
      <span className={`size-2 rounded-full ${state.dot}`} />
      {state.label}
    </span>
  );
}
