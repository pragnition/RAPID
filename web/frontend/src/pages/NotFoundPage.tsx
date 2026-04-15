import { useNavigate } from "react-router";
import { EmptyState } from "@/components/primitives";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <EmptyState
        title="Page not found"
        description="The requested route does not exist."
        actions={
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-accent hover:underline font-mono"
          >
            Back to Dashboard
          </button>
        }
      />
    </div>
  );
}
