import { PageHeader, EmptyState, StatusBadge } from "@/components/primitives";

export function AgentsPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Agents"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Agents" }]}
        description="Autonomous skill runs. Detail filled by the agents-chats-tabs set."
        actions={<StatusBadge label="stub" tone="muted" />}
      />
      <EmptyState
        title="No agent runs yet"
        description="The agents-chats-tabs set wires this surface. Launcher lands after skill-invocation-ui merges."
      />
    </div>
  );
}
