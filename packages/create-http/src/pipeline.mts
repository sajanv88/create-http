import type {
  HttpResponse,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from "./types.mjs";

export async function runPipeline(
  config: RequestConfig,
  requestInterceptors: RequestInterceptor[],
  responseInterceptors: ResponseInterceptor[],
  send: (cfg: RequestConfig) => Promise<HttpResponse>,
): Promise<HttpResponse> {
  let start: Promise<HttpResponse>;
  try {
    let cfg = config;
    for (const fn of requestInterceptors) cfg = await fn(cfg); // each sees the previous result
    start = send(cfg);
  } catch (err) {
    start = Promise.reject(err); // request errors reach the response chain
  }
  return responseInterceptors.reduce<Promise<HttpResponse>>(
    (p, h) => p.then(h.onFulfilled, h.onRejected), // each one can transform or recover
    start,
  );
}
