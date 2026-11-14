"use client";

import { ExternalLinkIcon } from "@nuvui/icons";
import {
  Navbar,
  NavbarActions,
  NavbarBrand,
  NavbarLink,
  NavbarMenu,
  NavbarNav,
} from "@nuvui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

interface SiteHeaderProps {
  packageName: string;
  githubUrl: string;
  npmUrl: string;
}

// The links are written once and drawn twice: in the bar on a wide screen, and in the
// panel behind the menu button on a narrow one.
function Links({ githubUrl, npmUrl }: Omit<SiteHeaderProps, "packageName">) {
  const pathname = usePathname();
  return (
    <>
      <NavbarLink asChild current={pathname === "/"}>
        <Link href="/">Home</Link>
      </NavbarLink>
      <NavbarLink asChild current={pathname.startsWith("/docs")}>
        <Link href="/docs/">Docs</Link>
      </NavbarLink>
      <NavbarLink href={githubUrl}>
        GitHub <ExternalLinkIcon size={14} title="(external site)" />
      </NavbarLink>
      <NavbarLink href={npmUrl}>
        npm <ExternalLinkIcon size={14} title="(external site)" />
      </NavbarLink>
    </>
  );
}

export function SiteHeader({ packageName, githubUrl, npmUrl }: SiteHeaderProps) {
  return (
    <Navbar sticky className="site-header">
      <NavbarBrand>
        <Link href="/" className="site-header__brand">
          {packageName}
        </Link>
      </NavbarBrand>
      <NavbarNav aria-label="Main">
        <Links githubUrl={githubUrl} npmUrl={npmUrl} />
      </NavbarNav>
      <NavbarActions>
        <ThemeToggle />
        <NavbarMenu>
          <nav aria-label="Main">
            <Links githubUrl={githubUrl} npmUrl={npmUrl} />
          </nav>
        </NavbarMenu>
      </NavbarActions>
    </Navbar>
  );
}
