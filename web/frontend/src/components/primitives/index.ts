// Barrel for wireframe-rollout primitive library.
// Every file exports both the component and its *Props interface; each is re-exported here.

// Atoms
export { StatusDot, type StatusDotProps, type StatusDotTone } from "./StatusDot";
export { HealthDot, type HealthDotProps } from "./HealthDot";
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge";
export { Breadcrumb, type BreadcrumbProps, type BreadcrumbSegment } from "./Breadcrumb";
export { Kbd, type KbdProps } from "./Kbd";
export { StreamingCursor, type StreamingCursorProps } from "./StreamingCursor";

// Surfaces
export {
  SurfaceCard,
  type SurfaceCardProps,
  type SurfaceAccentTone,
} from "./SurfaceCard";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { StatCard, type StatCardProps, type StatCardTone } from "./StatCard";
export { NavGroup, type NavGroupProps } from "./NavGroup";
