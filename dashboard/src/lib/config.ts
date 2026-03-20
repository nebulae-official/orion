/** Browser-facing gateway URL (baked in at build time via NEXT_PUBLIC_*). */
export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000";

/**
 * Server-side gateway URL used by Server Actions / Server Components.
 * Inside Docker, the gateway service is reachable at http://gateway:8000,
 * while the browser must use http://localhost:8000.
 */
export const SERVER_GATEWAY_URL =
  process.env.GATEWAY_INTERNAL_URL ?? GATEWAY_URL;

/** When true, the dashboard serves fixture data instead of calling the Gateway. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
