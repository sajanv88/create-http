# docs

The documentation site for [`fast-http-client`](../../packages/create-http), published at **https://sajanv88.github.io/create-http/**.

It's a fully static Next.js site (`output: "export"`) built with [nuvui](https://nuvui.nuvraxis.com) components: `@nuvui/react` for the layout and content, `@nuvui/chat` for the code blocks (colored by Shiki in the browser), `@nuvui/table` for tables and `@nuvui/icons`.

## Pages

| Route | File | What it is |
| --- | --- | --- |
| `/` | `app/page.tsx` | Landing page: what the library does, install, a first request. |
| `/docs/` | `app/docs/page.tsx` | The guide, one long page with a contents list that follows the reader. |

The version shown on the site is read from `packages/create-http/package.json` at build time (`lib/package-info.ts`).

When you add a section to the guide, add its heading's id to `contents` at the top of `app/docs/page.tsx` as well, in page order.

## Develop

```sh
pnpm exec turbo run dev --filter=docs   # http://localhost:3001
```

## Build

```sh
pnpm exec turbo run build --filter=docs # writes static files to out/
```

Locally the site builds for the root (`/`). GitHub Pages serves it under `/create-http`, so the Docs workflow sets `PAGES_BASE_PATH` from `actions/configure-pages` and Next prefixes every link and asset with it.

## Deploy

[`.github/workflows/docs.yaml`](../../.github/workflows/docs.yaml) builds and deploys the site to GitHub Pages on every push to `main` that changes `apps/docs`, the package's version, or the lockfile. It can also be run by hand from the Actions tab.

## Styling

nuvui styles its components. The page around them is in `app/globals.css`: plain CSS, BEM class names, nuvui's tokens for every color and size, smallest screen first. Dark mode is `data-theme` on `<html>`, `system` by default, and the toggle in the header remembers a choice in `localStorage`.
