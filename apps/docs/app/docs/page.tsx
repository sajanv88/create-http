import type { TableOfContentsItem } from "@nuvui/react";
import { Alert, AlertDescription, AlertTitle } from "@nuvui/react";
import type { Metadata } from "next";
import { Article, Section, Subheading } from "../../components/article";
import { Code } from "../../components/code";
import { C, DataTable, InstallTabs } from "../../components/content";
import { links, packageName } from "../../lib/package-info";

export const metadata: Metadata = {
  title: "Guide",
  description: `How to use ${packageName}: requests, errors, retries, the circuit breaker, caching, interceptors and token refresh.`,
};

// In page order. Every id here is a heading's id below.
const contents: TableOfContentsItem[] = [
  { id: "installation", title: "Installation" },
  { id: "quick-start", title: "Quick start" },
  { id: "requests", title: "Making requests" },
  { id: "request-options", title: "Per-request options", depth: 2 },
  { id: "urls", title: "URLs", depth: 2 },
  { id: "bodies", title: "Bodies", depth: 2 },
  { id: "errors", title: "Errors" },
  { id: "timeouts", title: "Timeouts and cancellation" },
  { id: "retries", title: "Retries" },
  { id: "circuit-breaker", title: "Circuit breaker" },
  { id: "caching", title: "Caching" },
  { id: "cache-stores", title: "Choosing a store", depth: 2 },
  { id: "cache-keys", title: "Cache keys and users", depth: 2 },
  { id: "custom-store", title: "Your own store", depth: 2 },
  { id: "interceptors", title: "Interceptors" },
  { id: "token-refresh", title: "Refreshing a token" },
  { id: "request-flow", title: "How a request flows" },
  { id: "api", title: "API reference" },
  { id: "client-options", title: "createHttp options", depth: 2 },
  { id: "exports", title: "Exports", depth: 2 },
];

const P = packageName;

export default function DocsPage() {
  return (
    <Article
      kicker="Guide"
      title={`Using ${P}`}
      lead="Everything the client does, with an example of each. Each section stands on its own."
      contents={contents}
    >
      <Section id="installation" title="Installation">
        <InstallTabs packageName={P} />
        <p>
          It runs in Node 22 or later and in every current browser. It's ESM only, ships its own
          TypeScript types, and has no runtime dependencies.
        </p>
      </Section>

      <Section id="quick-start" title="Quick start">
        <Code
          language="ts"
          code={`
import { createHttp } from "${P}";

export const api = createHttp({
  baseUrl: "https://api.example.com/v1",
  headers: { accept: "application/json" },
});

interface User {
  id: string;
  name: string;
}

const { data: user } = await api.get<User>("/users/42");
const { data: created } = await api.post<User>("/users", { name: "Ada" });`}
        />
        <p>
          Create one client per API and share it. Retries, the circuit breaker and the cache all
          live on the client.
        </p>
      </Section>

      <Section id="requests" title="Making requests">
        <Code
          language="ts"
          code={`
api.get<T>(url, options?)
api.head<T>(url, options?)
api.delete<T>(url, options?)
api.options<T>(url, options?)
api.post<T>(url, body?, options?)
api.put<T>(url, body?, options?)
api.patch<T>(url, body?, options?)
api.request<T>({ url, method, body, ...options }) // everything in one object`}
        />
        <p>
          Each returns <C>{"Promise<HttpResponse<T>>"}</C>:
        </p>
        <Code
          language="ts"
          code={`
interface HttpResponse<T> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T;
  config: RequestConfig; // the config that was actually sent
  fromCache: boolean;
}`}
        />
        <Alert intent="info">
          <AlertTitle>T isn't checked at runtime</AlertTitle>
          <AlertDescription>
            <C>T</C> is a type assertion. If the data comes from outside your control, parse it, for
            example with valibot: <C>v.parse(UserSchema, res.data)</C>.
          </AlertDescription>
        </Alert>

        <Subheading id="request-options">Per-request options</Subheading>
        <DataTable
          caption="Per-request options"
          head={["Option", "Type", "What it does"]}
          rows={[
            [
              <C key="o">query</C>,
              <C key="t">{"Record<string, QueryValue | QueryValue[]>"}</C>,
              "Appended to the URL. Arrays repeat the key; null and undefined are skipped.",
            ],
            [
              <C key="o">headers</C>,
              <C key="t">{"Record<string, string>"}</C>,
              "Merged over the client's headers. Names are case-insensitive.",
            ],
            [
              <C key="o">baseUrl</C>,
              <C key="t">string</C>,
              "Overrides the client's base URL for this request.",
            ],
            [<C key="o">timeoutMs</C>, <C key="t">number</C>, "Overrides the client's timeout."],
            [
              <C key="o">signal</C>,
              <C key="t">AbortSignal</C>,
              "Cancels the request, including any wait before a retry.",
            ],
            [
              <C key="o">retry</C>,
              <C key="t">{"false | Partial<RetryOptions>"}</C>,
              "Turns retries off, or changes them for this request.",
            ],
            [<C key="o">circuitBreaker</C>, <C key="t">false</C>, "Skips the circuit breaker."],
            [
              <C key="o">cache</C>,
              <C key="t">boolean</C>,
              "false skips the cache, both reading and writing.",
            ],
            [
              <C key="o">cacheTtlMs</C>,
              <C key="t">number</C>,
              "How long this response stays cached.",
            ],
          ]}
        />
        <Code
          language="ts"
          code={`
await api.get("/search", {
  query: { q: "lamps", tag: ["new", "sale"], page: 2, draft: undefined },
  headers: { "x-request-id": crypto.randomUUID() },
});
// GET https://api.example.com/v1/search?q=lamps&tag=new&tag=sale&page=2`}
        />

        <Subheading id="urls">URLs</Subheading>
        <p>
          A relative <C>url</C> is resolved against <C>baseUrl</C>, and the base's path is kept:
          with <C>baseUrl: "https://api.example.com/v1"</C>, both <C>"/users"</C> and <C>"users"</C>{" "}
          go to <C>https://api.example.com/v1/users</C>. An absolute URL ignores <C>baseUrl</C>.
          Without a <C>baseUrl</C>, a browser resolves relative URLs against the page; in Node the
          URL must be absolute.
        </p>

        <Subheading id="bodies">Bodies</Subheading>
        <DataTable
          caption="How request bodies are sent"
          head={["You pass", "Sent as"]}
          rows={[
            [
              "A plain object, array, number or boolean",
              <>
                JSON, with <C>content-type: application/json</C> unless you set one
              </>,
            ],
            [
              <>
                <C>string</C>, <C>Blob</C>, <C>FormData</C>, <C>URLSearchParams</C>,{" "}
                <C>ArrayBuffer</C>, a typed array, <C>ReadableStream</C>
              </>,
              "As is; the runtime sets the content type",
            ],
            [
              <>
                <C>undefined</C> or <C>null</C>
              </>,
              "No body",
            ],
          ]}
        />
        <DataTable
          caption="What data is for each response"
          head={["Response", "data is"]}
          rows={[
            [
              <>
                <C>HEAD</C>, or status 204, 205 or 304
              </>,
              <C key="u">undefined</C>,
            ],
            [
              <>
                <C>application/json</C> or <C>*+json</C>
              </>,
              "The parsed value (undefined if empty, the raw text if it isn't valid JSON)",
            ],
            [
              <>
                <C>text/*</C>, <C>*/xml</C>, <C>*+xml</C>, or no content type
              </>,
              <C key="s">string</C>,
            ],
            ["Anything else", <C key="b">Blob</C>],
          ]}
        />
      </Section>

      <Section id="errors" title="Errors">
        <DataTable
          caption="Errors a request can throw"
          head={["Thrown", "When"]}
          rows={[
            [
              <C key="e">HttpError</C>,
              <>
                The server answered with a status outside 200–299. Has <C>status</C>,{" "}
                <C>statusText</C>, <C>data</C> (the parsed body), <C>headers</C> and <C>config</C>.
              </>,
            ],
            [
              <C key="e">CircuitOpenError</C>,
              <>
                The circuit for that origin is open, so nothing was sent. Has <C>circuit</C> (the
                origin) and <C>retryAt</C> (epoch ms) when known.
              </>,
            ],
            [
              <>
                <C>DOMException</C> named <C>TimeoutError</C>
              </>,
              <>
                An attempt ran past <C>timeoutMs</C>, and retries didn't help.
              </>,
            ],
            [
              <>
                <C>DOMException</C> named <C>AbortError</C>
              </>,
              <>
                Your <C>signal</C> was aborted.
              </>,
            ],
            [<C key="e">TypeError</C>, "A network failure: DNS, a refused connection, CORS."],
          ]}
        />
        <Code
          language="ts"
          code={`
import { CircuitOpenError, HttpError } from "${P}";

try {
  await api.get("/orders/7");
} catch (err) {
  if (err instanceof HttpError && err.status === 404) return null;
  if (err instanceof CircuitOpenError) {
    showBanner(\`Service unavailable, retry after \${new Date(err.retryAt ?? Date.now())}\`);
    return null;
  }
  throw err;
}`}
        />
      </Section>

      <Section id="timeouts" title="Timeouts and cancellation">
        <p>
          Every attempt gets its own timeout, 10 seconds by default. With retries, a request can
          take longer than <C>timeoutMs</C> in total: each attempt has the full timeout, plus the
          wait between attempts.
        </p>
        <Code
          language="ts"
          code={`
const api = createHttp({ baseUrl, timeoutMs: 5_000 });
await api.get("/reports/big", { timeoutMs: 60_000 });`}
        />
        <p>
          A <C>signal</C> stops the attempt in flight and any wait before a retry. A cancelled
          request is never retried.
        </p>
        <Code
          language="ts"
          code={`
const controller = new AbortController();
const promise = api.get("/search", { query: { q }, signal: controller.signal });
controller.abort(); // promise rejects with an AbortError`}
        />
      </Section>

      <Section id="retries" title="Retries">
        <p>Retries are on by default:</p>
        <DataTable
          caption="Retry options"
          head={["Option", "Default", "What it does"]}
          rows={[
            [<C key="o">attempts</C>, "3", "Total tries, including the first."],
            [<C key="o">baseDelayMs</C>, "200", "Base for the backoff."],
            [<C key="o">maxDelayMs</C>, "5000", "Cap on any single wait, including Retry-After."],
            [
              <C key="o">methods</C>,
              "GET, HEAD, PUT, DELETE, OPTIONS",
              "Only idempotent methods. POST and PATCH aren't retried.",
            ],
            [
              <C key="o">statusCodes</C>,
              "408, 425, 429, 500, 502, 503, 504",
              "Statuses worth another try.",
            ],
          ]}
        />
        <p>
          A request is retried when it failed with one of those statuses, a network error or a
          timeout. It isn't retried after a cancel, when the circuit is open, or when the body is a{" "}
          <C>ReadableStream</C>, which can only be sent once.
        </p>
        <p>
          If the response has a <C>Retry-After</C> header (seconds or an HTTP date), that's the
          wait, capped at <C>maxDelayMs</C>. Otherwise the wait before attempt <em>n + 1</em> is a
          random time between 0 and <C>min(maxDelayMs, baseDelayMs × 2^(n−1))</C>. The randomness
          stops many clients retrying in step.
        </p>
        <Code
          language="ts"
          code={`
// Client-wide
const api = createHttp({ baseUrl, retry: { attempts: 5, maxDelayMs: 10_000 } });
const noRetries = createHttp({ baseUrl, retry: false });

// Per request
await api.get("/health", { retry: false });`}
        />
        <p>
          Per-request fields are merged over the client's, which are merged over{" "}
          <C>DEFAULT_RETRY</C>.
        </p>
      </Section>

      <Section id="circuit-breaker" title="Circuit breaker">
        <p>
          The client keeps one circuit per origin, so one slow service doesn't block calls to
          another.
        </p>
        <ul className="article__list">
          <li>
            <strong>Closed:</strong> requests go through. Consecutive failures are counted, and any
            success resets the count.
          </li>
          <li>
            <strong>Open:</strong> after <C>failureThreshold</C> consecutive failures, requests fail
            at once with <C>CircuitOpenError</C> for <C>resetTimeoutMs</C>, without touching the
            network.
          </li>
          <li>
            <strong>Half-open:</strong> then one trial request goes through. If it succeeds the
            circuit closes; if it fails, it opens again.
          </li>
        </ul>
        <DataTable
          caption="Circuit breaker options"
          head={["Option", "Default", "What it does"]}
          rows={[
            [<C key="o">failureThreshold</C>, "5", "Consecutive failures before opening."],
            [<C key="o">resetTimeoutMs</C>, "30000", "How long it stays open before a trial."],
            [
              <C key="o">isFailure</C>,
              "5xx, network errors, timeouts",
              "Which errors count. A 4xx counts as success: the server is answering.",
            ],
            [
              <C key="o">onStateChange</C>,
              "None",
              <>
                <C>(circuit, from, to) =&gt; void</C>, for logging and metrics.
              </>,
            ],
          ]}
        />
        <Code
          language="ts"
          code={`
const api = createHttp({
  baseUrl,
  circuitBreaker: {
    failureThreshold: 3,
    onStateChange: (circuit, from, to) => console.warn(\`circuit \${circuit}: \${from} → \${to}\`),
  },
});

await api.get("/status", { circuitBreaker: false }); // bypass it for one request`}
        />
      </Section>

      <Section id="caching" title="Caching">
        <p>
          The client can cache <C>GET</C> responses. One is stored only if its status is 200, it has
          no <C>Cache-Control: no-store</C>, and its body is JSON or text. A cached response skips
          the network, retries and the breaker, still runs your response interceptors, and comes
          back with <C>fromCache: true</C>.
        </p>
        <p>
          Entries live for <C>cacheTtlMs</C>, 60 seconds by default. <C>max-age</C> and <C>ETag</C>{" "}
          aren't read; the TTL is the only rule.
        </p>

        <Subheading id="cache-stores">Choosing a store</Subheading>
        <DataTable
          caption="Cache stores"
          head={["cache", "Store"]}
          rows={[
            ["Not set", "IndexedDB in browsers, off in Node"],
            [<C key="c">false</C>, "Off"],
            [<C key="c">"memory"</C>, "In-process, least recently used, 500 entries"],
            [<C key="c">"indexeddb"</C>, "IndexedDB; throws where there is none"],
            [
              "An adapter",
              <>
                Your own, such as <C>memoryCache(…)</C> or <C>redisCache(…)</C>
              </>,
            ],
          ]}
        />
        <Code
          language="ts"
          code={`
import { createHttp, memoryCache, redisCache } from "${P}";
import Redis from "ioredis";

// Browser: survives reloads
const browserApi = createHttp({ baseUrl, cache: "indexeddb", cacheTtlMs: 5 * 60_000 });

// Node, one process
const localApi = createHttp({ baseUrl, cache: memoryCache(1_000) });

// Node, shared between processes
const sharedApi = createHttp({ baseUrl, cache: redisCache(new Redis(process.env.REDIS_URL), "api:") });

// Per request
await localApi.get("/prices", { cache: false });
await localApi.get("/countries", { cacheTtlMs: 86_400_000 });`}
        />
        <p>A cache that fails never fails the request: the client falls back to the network.</p>

        <Subheading id="cache-keys">Cache keys and users</Subheading>
        <p>
          The key is the full URL by default. That's fine for public data, and for a cache only one
          person sees, like IndexedDB in their browser.
        </p>
        <Alert intent="warning">
          <AlertTitle>Shared caches need the user in the key</AlertTitle>
          <AlertDescription>
            With Redis, or <C>memoryCache</C> on a server, a key of the URL alone can serve one
            user's response to another. Add the user with <C>cacheKey</C>, or set{" "}
            <C>cache: false</C> on those requests.
          </AlertDescription>
        </Alert>
        <Code
          language="ts"
          code={`
const api = createHttp({
  baseUrl,
  cache: redisCache(redis),
  cacheKey: (config, url) => \`\${config.headers?.["x-user-id"] ?? "anon"}:\${url}\`,
});`}
        />

        <Subheading id="custom-store">Your own store</Subheading>
        <p>
          Implement <C>CacheAdapter</C>. The adapter is responsible for expiry: <C>get</C> must not
          return an entry older than its <C>ttlMs</C>.
        </p>
        <Code
          language="ts"
          code={`
import type { CacheAdapter } from "${P}";

const myCache: CacheAdapter = {
  async get(key) { /* a CacheEntry, or undefined if missing or expired */ },
  async set(key, entry, ttlMs) { /* store it; expire it after ttlMs */ },
  async delete(key) { /* remove it */ },
};`}
        />
      </Section>

      <Section id="interceptors" title="Interceptors">
        <p>
          Request interceptors run in the order they're added, each receiving the config the
          previous one returned, after the client's defaults are applied. They may be async.{" "}
          <C>use</C> returns a function that removes the interceptor.
        </p>
        <Code
          language="ts"
          code={`
const stop = api.interceptors.request.use(async (config) => ({
  ...config,
  headers: { ...config.headers, authorization: \`Bearer \${await getToken()}\` },
}));

stop(); // removes it`}
        />
        <p>
          A response interceptor has an optional <C>onFulfilled</C> and <C>onRejected</C>, run in
          order like a chain of <C>.then()</C>. <C>onRejected</C> can return a response to recover,
          or throw to pass the error on.
        </p>
        <Code
          language="ts"
          code={`
api.interceptors.response.use({
  onRejected(error) {
    if (error instanceof HttpError) {
      console.error(\`\${error.config.method ?? "GET"} \${error.config.url} → \${error.status}\`);
    }
    throw error;
  },
});`}
        />
      </Section>

      <Section id="token-refresh" title="Refreshing an expired token">
        <p>
          Give the client a <C>refreshAuth</C> function. When requests fail with <C>401</C>, it's
          called once, however many are waiting. Then each request is sent once more, through the
          request interceptors again, so the new token is attached. If <C>refreshAuth</C> throws,
          the caller gets the original <C>401</C>.
        </p>
        <Code
          language="ts"
          code={`
let accessToken = "";

const api = createHttp({
  baseUrl,
  async refreshAuth() {
    // Plain fetch, not \`api\`: see the warning below
    const res = await fetch(\`\${baseUrl}/auth/refresh\`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("session expired");
    accessToken = (await res.json()).accessToken;
  },
});

api.interceptors.request.use((config) => ({
  ...config,
  headers: { ...config.headers, authorization: \`Bearer \${accessToken}\` },
}));`}
        />
        <Alert intent="warning">
          <AlertTitle>Don't refresh through the same client</AlertTitle>
          <AlertDescription>
            If the refresh call returns <C>401</C>, it waits for the refresh it's part of and never
            finishes. Use <C>fetch</C> or a separate client.
          </AlertDescription>
        </Alert>
      </Section>

      <Section id="request-flow" title="How a request flows">
        <ol className="article__steps">
          <li>
            The client's defaults are merged in: <C>baseUrl</C>, <C>headers</C>, <C>timeoutMs</C>.
          </li>
          <li>Request interceptors run, in order.</li>
          <li>
            For a <C>GET</C>, the cache is checked. A hit goes straight to the response
            interceptors.
          </li>
          <li>
            The request is sent through the origin's circuit breaker, with a timeout and your
            signal. A failure worth retrying waits, then tries again.
          </li>
          <li>A 200 that can be cached is stored.</li>
          <li>Response interceptors run, in order, and can change the result or recover.</li>
          <li>
            On a <C>401</C> with <C>refreshAuth</C> set, the token is refreshed and the whole flow
            runs once more.
          </li>
        </ol>
      </Section>

      <Section id="api" title="API reference">
        <Subheading id="client-options">createHttp(options)</Subheading>
        <DataTable
          caption="createHttp options"
          head={["Option", "Type", "Default"]}
          rows={[
            [<C key="o">baseUrl</C>, <C key="t">string</C>, "None"],
            [<C key="o">headers</C>, <C key="t">{"Record<string, string>"}</C>, "None"],
            [<C key="o">timeoutMs</C>, <C key="t">number</C>, "10000, per attempt"],
            [
              <C key="o">retry</C>,
              <C key="t">{"false | Partial<RetryOptions>"}</C>,
              <C key="d">DEFAULT_RETRY</C>,
            ],
            [
              <C key="o">circuitBreaker</C>,
              <C key="t">{"false | Partial<BreakerOptions>"}</C>,
              <C key="d">DEFAULT_BREAKER</C>,
            ],
            [
              <C key="o">cache</C>,
              <C key="t">{'false | "memory" | "indexeddb" | CacheAdapter'}</C>,
              "IndexedDB in browsers, off in Node",
            ],
            [<C key="o">cacheTtlMs</C>, <C key="t">number</C>, "60000"],
            [<C key="o">cacheKey</C>, <C key="t">{"(config, url) => string"}</C>, "The full URL"],
            [
              <C key="o">refreshAuth</C>,
              <C key="t">{"() => Promise<void>"}</C>,
              "None: a 401 is just an error",
            ],
          ]}
        />

        <Subheading id="exports">Exports</Subheading>
        <DataTable
          caption="Exports"
          head={["Export", "Kind"]}
          rows={[
            [<C key="e">createHttp</C>, "Function"],
            [<C key="e">memoryCache(maxEntries = 500)</C>, "Cache adapter, least recently used"],
            [<C key="e">indexedDbCache(dbName?)</C>, "Cache adapter"],
            [<C key="e">redisCache(client, prefix = "http:")</C>, "Cache adapter"],
            [
              <>
                <C>HttpError</C>, <C>CircuitOpenError</C>
              </>,
              "Error classes",
            ],
            [
              <>
                <C>DEFAULT_RETRY</C>, <C>DEFAULT_BREAKER</C>
              </>,
              "Default options, to read or spread",
            ],
            [
              <>
                <C>ClientOptions</C>, <C>HttpClient</C>, <C>RequestConfig</C>, <C>HttpResponse</C>,
                and the rest
              </>,
              "Types",
            ],
          ]}
        />
        <p>
          The full reference, with every type, is in the{" "}
          <a href={`${links.github}/tree/main/packages/create-http#readme`}>package README</a>.
        </p>
      </Section>
    </Article>
  );
}
