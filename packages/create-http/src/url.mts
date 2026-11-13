import type { RequestConfig } from "./types.mjs";

export function buildUrl(
  baseUrl: string | undefined,
  path: string,
  query?: RequestConfig["query"],
): string {
  // Trailing slash on the base keeps a base path like /api. A leading slash on the path would drop it.
  // Without a base, the path must be absolute (Node) or is resolved against the page (browser).
  const url = baseUrl
    ? new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)
    : new URL(path, globalThis.location?.href);
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== undefined && v !== null) url.searchParams.append(key, String(v));
    }
  }
  return url.toString();
}
