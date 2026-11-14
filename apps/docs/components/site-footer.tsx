import { links, packageName, packageVersion } from "../lib/package-info";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__text">
        {packageName} v{packageVersion}, released under the{" "}
        <a href={`${links.github}/blob/main/LICENSE`}>MIT license</a>.
      </p>
      <p className="site-footer__text">
        <a href={links.github}>GitHub</a> · <a href={links.npm}>npm</a> ·{" "}
        <a href={links.releases}>Releases</a>
      </p>
    </footer>
  );
}
