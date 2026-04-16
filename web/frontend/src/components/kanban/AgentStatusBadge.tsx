import type { KanbanCardResponse } from "@/types/api";

interface AgentStatusBadgeProps {
  agentStatus: KanbanCardResponse["agent_status"];
  createdBy: string;
  lockedByRunId: string | null;
  completedByRunId: string | null;
  retryCount: number;
}

const pillBase =
  "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full border";

export function AgentStatusBadge({
  agentStatus,
  createdBy,
  retryCount,
}: AgentStatusBadgeProps) {
  const badges: React.ReactNode[] = [];

  if (agentStatus === "claimed") {
    badges.push(
      <span
        key="claimed"
        className={`${pillBase} bg-blue-500/10 text-blue-400 border-blue-500/20`}
      >
        Agent claimed
      </span>,
    );
  }

  if (agentStatus === "running") {
    badges.push(
      <span
        key="running"
        className={`${pillBase} bg-blue-500/10 text-blue-400 border-blue-500/20`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        Agent running
      </span>,
    );
  }

  if (agentStatus === "blocked") {
    const label =
      retryCount > 0 ? `Blocked x${retryCount}` : "Blocked";
    badges.push(
      <span
        key="blocked"
        className={`${pillBase} bg-red-500/10 text-red-400 border-red-500/20`}
      >
        {label}
      </span>,
    );
  }

  if (agentStatus === "completed") {
    badges.push(
      <span
        key="completed"
        className={`${pillBase} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}
      >
        Agent completed
      </span>,
    );
  }

  if (
    agentStatus === "idle" &&
    createdBy.startsWith("agent:")
  ) {
    badges.push(
      <span
        key="agent-created"
        className={`${pillBase} bg-violet-500/10 text-violet-400 border-violet-500/20`}
      >
        Agent created
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return <div className="flex flex-wrap gap-1 mt-1">{badges}</div>;
}
