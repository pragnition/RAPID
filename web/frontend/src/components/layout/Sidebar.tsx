import { NavLink } from "react-router";
import { useLayoutStore } from "@/hooks/useLayoutStore";
import { useProjects } from "@/hooks/useProjects";
import { useProjectStore } from "@/stores/projectStore";
import { NAV_GROUPS, type NavItem } from "@/types/layout";
import { NavGroup, StatusDot, HealthDot } from "@/components/primitives";

export function Sidebar() {
  const sidebarState = useLayoutStore((s) => s.sidebarState);
  const isMobileDrawerOpen = useLayoutStore((s) => s.isMobileDrawerOpen);
  const closeMobileDrawer = useLayoutStore((s) => s.closeMobileDrawer);

  const isFull = sidebarState === "full";
  const isCompact = sidebarState === "compact";
  const isHidden = sidebarState === "hidden";

  // Width classes based on state
  const widthClass = isFull
    ? "w-[232px]"
    : isCompact
      ? "w-16"
      : "w-0 overflow-hidden";

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        className={`
          fixed left-0 top-0 bottom-0 z-30
          bg-surface-0 border-r border-border
          transition-all duration-200 ease-in-out
          hidden md:flex flex-col
          ${widthClass}
        `}
      >
        <SidebarContent isFull={isFull} isCompact={isCompact} isHidden={isHidden} />
      </nav>

      {/* Mobile overlay backdrop */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileDrawer}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeMobileDrawer();
          }}
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}

      {/* Mobile drawer — stays at w-60 for drawer ergonomics */}
      <nav
        className={`
          fixed left-0 top-0 bottom-0 z-50
          bg-surface-0 border-r border-border
          transition-transform duration-200 ease-in-out
          w-60 flex flex-col md:hidden
          ${isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <SidebarContent isFull={true} isCompact={false} isHidden={false} />
      </nav>
    </>
  );
}

function BrandMark() {
  return (
    <div className="w-7 h-7 rounded-md bg-bg-1 border border-accent text-accent font-mono text-[11px] flex items-center justify-center shrink-0">
      R
    </div>
  );
}

function SidebarContent({
  isFull,
  isCompact,
  isHidden,
}: {
  isFull: boolean;
  isCompact: boolean;
  isHidden: boolean;
}) {
  if (isHidden) return null;

  return (
    <>
      {/* Brand + project selector */}
      <div className="px-3 py-3 border-b border-border flex flex-col gap-3">
        <div className={isCompact ? "flex justify-center" : "flex items-center gap-2"}>
          <BrandMark />
          {isFull && (
            <span className="text-sm font-semibold text-fg tracking-wide">RAPID</span>
          )}
        </div>
        {isFull ? <ProjectSelector /> : null}
      </div>

      {/* Navigation items */}
      <div className="flex-1 py-1 overflow-y-auto">
        {isFull
          ? NAV_GROUPS.map((group) => (
              <NavGroup key={group.id} label={group.label}>
                {group.items.map((item) => (
                  <NavItemLink key={item.id} item={item} isFull isCompact={false} />
                ))}
              </NavGroup>
            ))
          : NAV_GROUPS.flatMap((group) =>
              group.items.map((item) => (
                <NavItemLink key={item.id} item={item} isFull={false} isCompact />
              )),
            )}
      </div>

      {/* Bottom footer: health row + version row */}
      <div className="px-3 py-3 border-t border-border flex flex-col gap-1">
        {isFull ? (
          <>
            <div className="flex items-center gap-2 text-xs font-mono text-fg">
              <HealthDot online={true} />
              <span>backend online</span>
            </div>
            <VersionLabel isFull isCompact={false} />
          </>
        ) : (
          <>
            <div className="flex justify-center" title="backend online">
              <HealthDot online={true} />
            </div>
            <VersionLabel isFull={false} isCompact />
          </>
        )}
      </div>
    </>
  );
}

function NavItemLink({
  item,
  isFull,
  isCompact,
}: {
  item: NavItem;
  isFull: boolean;
  isCompact: boolean;
}) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      title={isCompact ? item.label : undefined}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 mx-2 rounded-md transition-colors duration-100",
          isCompact ? "justify-center px-2 py-2.5" : "px-3 py-2",
          isActive
            ? "bg-bg-2 text-accent border-l-[3px] border-accent -ml-[3px] pl-[11px]"
            : "text-fg hover:bg-hover",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          {isFull ? (
            <StatusDot tone={isActive ? "accent" : "muted"} size="sm" />
          ) : (
            <span className="text-lg flex-shrink-0">{item.icon}</span>
          )}
          {isFull && (
            <>
              <span className="flex-1 text-sm">{item.label}</span>
              {item.shortcut && (
                <span className="text-xs text-muted font-mono">{item.shortcut}</span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function VersionLabel({ isFull, isCompact }: { isFull: boolean; isCompact: boolean }) {
  const appVersion =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
  const fullLabel = appVersion ? `RAPID v${appVersion}` : "RAPID";
  const majorLabel = appVersion ? `v${appVersion.split(".")[0]}` : "";
  if (isFull) {
    return <span className="text-muted text-xs">{fullLabel}</span>;
  }
  if (isCompact) {
    return (
      <span
        className="text-muted text-xs flex justify-center"
        title={fullLabel}
      >
        {majorLabel}
      </span>
    );
  }
  return null;
}

function ProjectSelector() {
  const { data, isLoading, isError } = useProjects();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  if (isLoading) {
    return <div className="text-sm text-muted truncate">Loading...</div>;
  }

  if (isError) {
    return <div className="text-sm text-error truncate">Failed to load</div>;
  }

  const projects = data?.items ?? [];

  if (projects.length === 0) {
    return <div className="text-sm text-muted truncate">No projects registered</div>;
  }

  return (
    <select
      value={activeProjectId ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        setActiveProject(val || null);
      }}
      className="
        w-full text-sm bg-surface-1 text-fg
        border border-border rounded px-2 py-1.5
        focus:outline-none focus:ring-1 focus:ring-accent
        truncate
      "
      aria-label="Select project"
    >
      <option value="">Select a project...</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
