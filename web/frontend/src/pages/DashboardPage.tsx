export function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-fg mb-2">Dashboard</h1>
      <p className="text-muted mb-8">Welcome to RAPID Mission Control</p>

      {/* Placeholder widget cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-fg mb-1">Active Projects</h2>
          <p className="text-2xl font-bold text-accent">--</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-fg mb-1">Running Agents</h2>
          <p className="text-2xl font-bold text-accent">--</p>
        </div>
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-fg mb-1">Sets in Progress</h2>
          <p className="text-2xl font-bold text-accent">--</p>
        </div>
      </div>
    </div>
  );
}
