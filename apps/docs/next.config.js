// A fully static site: `next build` writes plain HTML, CSS and JS to out/, which GitHub Pages serves.
// Pages serves a project site under /<repo>, so the docs workflow passes PAGES_BASE_PATH
// (from actions/configure-pages); locally it's unset and the site runs at the root.
const basePath = process.env.PAGES_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  // docs/ → docs/index.html, which every static host serves without rewrites.
  trailingSlash: true,
  images: { unoptimized: true },
  // Each icon is its own module; this keeps the dev server from loading all of them.
  experimental: { optimizePackageImports: ["@nuvui/icons"] },
};

export default nextConfig;
