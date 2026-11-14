import {
  ArrowRightIcon,
  DatabaseIcon,
  KeyIcon,
  LayersIcon,
  RepeatIcon,
  ShieldCheckIcon,
  TimerIcon,
} from "@nuvui/icons";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "@nuvui/react";
import Link from "next/link";
import { Code } from "../components/code";
import { InstallTabs } from "../components/content";
import { links, packageName, packageVersion } from "../lib/package-info";

const features = [
  {
    icon: RepeatIcon,
    title: "Retries",
    text: "Idempotent requests are retried with exponential backoff and jitter, and Retry-After is honoured.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Circuit breaker",
    text: "One circuit per origin. A failing service gets a rest, and callers fail fast instead of waiting.",
  },
  {
    icon: DatabaseIcon,
    title: "Caching",
    text: "GET responses cached in memory, IndexedDB, Redis or a store of your own, with a TTL per request.",
  },
  {
    icon: LayersIcon,
    title: "Interceptors",
    text: "Change every request on its way out and every response on its way back, or recover from an error.",
  },
  {
    icon: KeyIcon,
    title: "Token refresh",
    text: "A 401 calls your refresh function once, however many requests are waiting, then replays them.",
  },
  {
    icon: TimerIcon,
    title: "Timeouts and cancellation",
    text: "A timeout on every attempt, an AbortSignal to cancel, and typed errors for each way a request fails.",
  },
];

const example = `
import { createHttp, HttpError } from "${packageName}";

const api = createHttp({
  baseUrl: "https://api.example.com/v1",
  retry: { attempts: 3 },
  cache: "memory",
});

interface User {
  id: string;
  name: string;
}

try {
  const { data: user } = await api.get<User>("/users/42");
  console.log(user.name);
} catch (err) {
  if (err instanceof HttpError && err.status === 404) {
    console.log("No such user");
  }
}
`;

export default function Home() {
  return (
    <div className="home">
      <section className="home__hero" aria-labelledby="home-title">
        <div className="home__badges">
          <Badge intent="primary">v{packageVersion}</Badge>
          <Badge variant="outline">No runtime dependencies</Badge>
          <Badge variant="outline">TypeScript</Badge>
          <Badge variant="outline">MIT</Badge>
        </div>
        <h1 id="home-title" className="home__title">
          {packageName}
        </h1>
        <p className="home__lead">
          A small HTTP client for browsers and Node, built on{" "}
          <code className="inline-code">fetch</code>, with the things production code ends up
          needing.
        </p>
        <div className="home__actions">
          <Button asChild size="lg">
            <Link href="/docs/">
              Read the docs <ArrowRightIcon size={18} />
            </Link>
          </Button>
          <Button asChild size="lg" intent="secondary">
            <a href={links.github}>View on GitHub</a>
          </Button>
        </div>
        <div className="home__install">
          <InstallTabs packageName={packageName} />
        </div>
      </section>

      <section className="home__section" aria-labelledby="home-features">
        <h2 id="home-features" className="home__heading">
          What it does
        </h2>
        <ul className="home__features">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card className="home__feature">
                <CardHeader>
                  <span className="home__feature-icon">
                    <Icon size={22} />
                  </span>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{text}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="home__section" aria-labelledby="home-example">
        <h2 id="home-example" className="home__heading">
          A first request
        </h2>
        <p className="home__text">
          Create one client per API and share it. Retries, the circuit breaker and the cache all
          live on the client.
        </p>
        <Code code={example} language="ts" title="api.ts" />
        <p className="home__text">
          <Link href="/docs/">Read the guide</Link> for every option, or start with{" "}
          <Link href="/docs/#quick-start">the quick start</Link>.
        </p>
      </section>
    </div>
  );
}
