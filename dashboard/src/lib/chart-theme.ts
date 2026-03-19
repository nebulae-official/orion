/**
 * Shared Recharts theme configuration.
 *
 * All chart components import from here so tooltip, axis, and grid
 * styling stays consistent and theme-aware (light/dark).
 *
 * Uses CSS custom properties so colors automatically adapt when
 * the .dark class is toggled on <html>.
 */

/** Glass-morphism tooltip style — matches the glass-card design system. */
export const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--color-surface)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.75rem",
  color: "var(--color-text)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
  padding: "0.5rem 0.75rem",
  fontSize: "0.8125rem",
};

/** Axis tick style — theme-aware text color. */
export const axisTick: Record<string, string | number> = {
  fill: "var(--color-text-muted)",
  fontSize: 12,
};

/** Axis line stroke — subtle, theme-aware. */
export const axisStroke = "var(--color-border)";

/** CartesianGrid stroke — subtle grid lines inside charts. */
export const gridStroke = "var(--color-border)";

/** Grid stroke dasharray for dashed lines. */
export const gridDash = "3 3";
