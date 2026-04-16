import { useNavigate } from "react-router";
import { EmptyState } from "@/components/primitives";
import { useChats } from "@/hooks/useChats";

const ACTIONS = [
  {
    skill: "discuss-set",
    label: "/rapid:discuss-set",
    desc: "Capture set implementation vision",
  },
  {
    skill: "quick",
    label: "/rapid:quick",
    desc: "Ad-hoc changes without set structure",
  },
  {
    skill: "bug-fix",
    label: "/rapid:bug-fix",
    desc: "Investigate and fix bugs",
  },
];

export function ChatsEmptyState() {
  const navigate = useNavigate();
  const { createThread } = useChats();

  const handleAction = async (skillName: string) => {
    try {
      const thread = await createThread({ skillName });
      navigate(`/chats/${thread.id}`);
    } catch {
      // toast or ignore -- createThread failures are handled by the mutation
    }
  };

  return (
    <EmptyState
      title="No chat threads yet"
      description="Chats are interactive conversations where Claude waits for your replies. Agents run autonomously in the background."
      actions={
        <div className="flex flex-col gap-2 w-full">
          {ACTIONS.map((a) => (
            <button
              key={a.skill}
              type="button"
              onClick={() => handleAction(a.skill)}
              className="flex items-center gap-3 px-4 py-2 rounded border border-border bg-surface-1 hover:border-accent hover:bg-hover text-left transition-colors w-full"
            >
              <span className="font-mono text-sm text-accent">{a.label}</span>
              <span className="text-xs text-muted">{a.desc}</span>
            </button>
          ))}
        </div>
      }
    />
  );
}
