import { PageHeader, EmptyState, StatusBadge } from "@/components/primitives";

export function ChatsPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Chats"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Chats" }]}
        description="Conversation threads with Claude. Detail filled by the agents-chats-tabs set."
        actions={<StatusBadge label="stub" tone="muted" />}
      />
      <EmptyState
        title="No chat threads yet"
        description="The agents-chats-tabs set wires this surface. Threads land after skill-invocation-ui merges."
      />
    </div>
  );
}
