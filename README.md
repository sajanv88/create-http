# fast-http-client

A small HTTP client for browsers and Node, built on `fetch`, with the things production code ends up needing:

- retries with exponential backoff that honour `Retry-After`
- a circuit breaker per origin
- caching of GET responses in memory, IndexedDB, Redis or your own store
- request and response interceptors
- a token refresh on `401`, shared by every request waiting on it
- timeouts, cancellation, JSON in and out, typed errors

It has no runtime dependencies and ships its own TypeScript types.

```sh
npm install fast-http-client
```

```ts
import { createHttp } from "fast-http-client";

const api = createHttp({ baseUrl: "https://api.example.com/v1" });

const { data: user } = await api.get<User>("/users/42");
```

**Full documentation: [packages/create-http/README.md](packages/create-http/README.md).**

## What's in this repository

This is a pnpm and Turborepo monorepo. The library is one package; the two apps are its documentation site and an example of it in use.

| Path | What it is |
| --- | --- |
| [`packages/create-http`](packages/create-http) | The library, published to npm as [`fast-http-client`](https://www.npmjs.com/package/fast-http-client). |
| [`apps/docs`](apps/docs) | The documentation website (Next.js, port 3001). It will be published as the project's docs site. |
| [`apps/web`](apps/web) | An example app showing `fast-http-client` in a Next.js project (port 3000). |
| [`packages/typescript-config`](packages/typescript-config) | Shared `tsconfig` presets for the packages and apps. |

`apps/docs` and `apps/web` are placeholder pages for now; their content comes next.

## Development

**You need:** Node 24 (see [`.node-version`](.node-version)) and pnpm 11.25.0, the version pinned in `packageManager`.

```sh
pnpm install
pnpm dev            # the library in watch mode, plus both apps
```

| Command | What it does |
| --- | --- |
| `pnpm build` | Build every package and app (Turborepo builds `fast-http-client` before the apps). |
| `pnpm test` | Build `fast-http-client`, then run its tests. |
| `pnpm check-types` | Type-check everything. |
| `pnpm lint` | Lint and format-check with [Biome](https://biomejs.dev/). |
| `pnpm lint:fix` | Apply Biome's fixes and formatting. |

To run a task for one workspace, filter it: `pnpm exec turbo run test --filter=fast-http-client`.

## Contributing

1. Branch from `main` and open a pull request. Draft PRs aren't checked; mark the PR ready when you want CI.
2. CI runs Biome, type-checks, tests and builds, checks the npm tarball, and runs `pnpm audit`.
3. If your change touches `packages/create-http/src`, bump `version` in [`packages/create-http/package.json`](packages/create-http/package.json): patch for fixes, minor for features, major for breaking changes. CI fails otherwise.

Merging to `main` publishes the new version to npm with a provenance attestation and creates the matching GitHub Release. The details are in [Releasing](packages/create-http/README.md#releasing).

## License

[MIT](LICENSE) © 2026 sajanv88
