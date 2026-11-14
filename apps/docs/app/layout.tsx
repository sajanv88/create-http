import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { links, packageName } from "../lib/package-info";
import { THEME_KEY } from "../lib/theme";
// nuvui's stylesheets, once for the whole site: the core first, then each add-on.
import "@nuvui/react/styles.css";
import "@nuvui/chat/styles.css";
import "@nuvui/table/styles.css";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: `${packageName}: a fetch-based HTTP client`,
    template: `%s · ${packageName}`,
  },
  description:
    "A small HTTP client for browsers and Node with retries, a circuit breaker, caching, interceptors and token refresh. No runtime dependencies.",
};

// Applies a theme picked on an earlier visit before the page paints. Without one,
// data-theme="system" follows the operating system, in CSS.
const rememberedTheme = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The script above may change data-theme before React hydrates.
    // The font variables go on <html>, where globals.css hands them to nuvui's tokens.
    <html
      lang="en"
      data-theme="system"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="remembered-theme" strategy="beforeInteractive">
          {rememberedTheme}
        </Script>
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader packageName={packageName} githubUrl={links.github} npmUrl={links.npm} />
        <main id="content" className="site-main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
