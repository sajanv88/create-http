import { readFileSync } from "node:fs";
import { join } from "node:path";

// Read at build time, so the site always shows the version in the repo. `next build`
// runs in apps/docs; the package is two folders up.
const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "../../packages/create-http/package.json"), "utf8"),
) as { name: string; version: string };

export const packageName = manifest.name;
export const packageVersion = manifest.version;

export const links = {
  github: "https://github.com/sajanv88/create-http",
  npm: `https://www.npmjs.com/package/${manifest.name}`,
  releases: "https://github.com/sajanv88/create-http/releases",
} as const;
