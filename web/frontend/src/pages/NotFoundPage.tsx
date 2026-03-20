import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-5xl font-bold text-fg">404</h1>
      <p className="text-lg text-muted">Page Not Found</p>
      <Link
        to="/"
        className="text-accent hover:underline"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
