// Checks that a package's version can be published to npm: plain X.Y.Z, not published yet,
// and higher than the version npm calls `latest`. Exits 1 with a GitHub annotation otherwise.
//
//   node .github/scripts/check-version.mjs packages/create-http
//
// Writes `name` and `version` to $GITHUB_OUTPUT when run in Actions.
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) fail("usage: check-version.mjs <package-dir>");

const manifestPath = join(dir, "package.json");
const { name, version } = JSON.parse(readFileSync(manifestPath, "utf8"));

const parsed = parse(version);
if (!parsed) fail(`${name}: version "${version}" must be MAJOR.MINOR.PATCH`, manifestPath);

const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, {
  headers: { accept: "application/vnd.npm.install-v1+json" }, // abbreviated metadata: versions + dist-tags
});
if (res.status !== 404 && !res.ok) fail(`npm registry answered ${res.status} for ${name}`);
const meta = res.status === 404 ? { versions: {}, "dist-tags": {} } : await res.json();

if (version in meta.versions) {
  fail(
    `${name}@${version} is already on npm. Bump "version" in ${manifestPath} (patch, minor or major) in this PR.`,
    manifestPath,
  );
}
const latest = meta["dist-tags"].latest;
const latestParsed = latest && parse(latest);
if (latestParsed && compare(parsed, latestParsed) <= 0) {
  fail(
    `${name}@${version} must be higher than the latest published version, ${latest}.`,
    manifestPath,
  );
}

process.stdout.write(`${name}@${version} can be published (npm latest: ${latest ?? "none"}).\n`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `name=${name}\nversion=${version}\n`);
}

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? "");
  return m ? m.slice(1).map(Number) : undefined;
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function fail(message, file) {
  const where = file ? ` file=${file}` : "";
  console.error(process.env.GITHUB_ACTIONS ? `::error${where}::${message}` : message);
  process.exit(1);
}
