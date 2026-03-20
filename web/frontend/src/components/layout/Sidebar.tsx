import { NavLink } from "react-router";
import { useLayoutStore } from "@/hooks/useLayoutStore";
import { NAV_ITEMS } from "@/types/layout";

export function Sidebar() {
  const sidebarState = useLayoutStore((s) => s.sidebarState);
  const isMobileDrawerOpen = useLayoutStore((s) => s.isMobileDrawerOpen);
  const closeMobileDrawer = useLayoutStore((s) => s.closeMobileDrawer);

  const isFull = sidebarState === "full";
  const isCompact = sidebarState === "compact";
  const isHidden = sidebarState === "hidden";

  // Width classes based on state
  const widthClass = isFull
    ? "w-60"
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

      {/* Mobile drawer */}
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
      {/* Project selector stub */}
      <div className="px-3 py-4 border-b border-border">
        {isFull ? (
          <div className="text-sm text-muted truncate">No project selected</div>
        ) : isCompact ? (
          <div className="flex items-center justify-center text-muted" title="No project selected">
            &#9633;
          </div>
        ) : null}
      </div>

      {/* Navigation items */}
      <div className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 mx-2 rounded-md transition-colors duration-100",
                isCompact ? "justify-center px-2 py-2.5" : "px-3 py-2",
                isActive
                  ? "bg-hover text-accent"
                  : "text-fg hover:bg-hover",
              ].join(" ")
            }
            title={isCompact ? item.label : undefined}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {isFull && (
              <>
                <span className="flex-1 text-sm">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-muted font-mono">{item.shortcut}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Bottom version text */}
      <div className="px-3 py-3 border-t border-border">
        {isFull ? (
          <span className="text-muted text-xs">RAPID v4.0.0</span>
        ) : isCompact ? (
          <span className="text-muted text-xs flex justify-center" title="RAPID v4.0.0">
            v4
          </span>
        ) : null}
      </div>
    </>
  );
}
