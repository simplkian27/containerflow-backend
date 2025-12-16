import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "@containerflow_auth_user";
const DEBUG_API = __DEV__ || process.env.NODE_ENV === "development";
const LOG_SNIPPET_LENGTH = 200;

type ApiConfig = {
  origin: string;
  baseUrl: string;
  host: string;
  protocol: "http" | "https";
  port?: string;
  raw: string;
};

type ApiErrorOptions = {
  message: string;
  status?: number;
  statusText?: string;
  url: string;
  isHtmlResponse?: boolean;
  isNetworkError?: boolean;
  isConfigError?: boolean;
  requestId?: string;
  responseSnippet?: string;
};

function buildUserMessage(options: ApiErrorOptions): string {
  if (options.isConfigError) {
    return options.message;
  }
  if (options.isNetworkError) {
    return `Network error: cannot reach API. URL=${options.url}. Check EXPO_PUBLIC_DOMAIN`;
  }
  if (options.isHtmlResponse) {
    return "API misconfigured: got HTML instead of JSON. Check API_BASE_URL.";
  }
  if (options.status === 401 || options.status === 403) {
    return options.message || "Not logged in / not authorized";
  }
  if (options.message) {
    return options.message;
  }
  return "Unexpected API error.";
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  url: string;
  isHtmlResponse: boolean;
  isNetworkError: boolean;
  isConfigError: boolean;
  requestId?: string;
  responseSnippet?: string;

  constructor(options: ApiErrorOptions) {
    const userMessage = buildUserMessage(options);
    super(userMessage);
    this.name = "ApiError";
    this.status = options.status || 0;
    this.statusText = options.statusText || "";
    this.url = options.url;
    this.isHtmlResponse = !!options.isHtmlResponse;
    this.isNetworkError = !!options.isNetworkError;
    this.isConfigError = !!options.isConfigError;
    this.requestId = options.requestId;
    this.responseSnippet = options.responseSnippet;
  }

  toUserMessage(): string {
    return this.message;
  }
}

let cachedApiConfig: ApiConfig | null = null;

function logApi(options: {
  method: string;
  url: string;
  status?: number;
  bodySize?: number;
  message?: string;
  snippet?: string;
  level?: "info" | "error";
}) {
  if (!DEBUG_API) return;

  const { method, url, status, bodySize, message, snippet, level = "info" } = options;
  const prefix = level === "error" ? "[API ERROR]" : "[API]";
  const sizePart = bodySize !== undefined ? ` body=${bodySize}B` : "";
  const statusPart = status !== undefined ? ` -> ${status}` : "";
  const messagePart = message ? ` :: ${message}` : "";
  const snippetPart = snippet ? ` :: snippet=${snippet.slice(0, LOG_SNIPPET_LENGTH)}` : "";
  const logLine = `${prefix} ${method} ${url}${sizePart}${statusPart}${messagePart}${snippetPart}`;

  if (level === "error") {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

function resolveApiConfig(): ApiConfig {
  if (cachedApiConfig) return cachedApiConfig;

  const raw = (process.env.EXPO_PUBLIC_DOMAIN || "").trim();
  if (!raw) {
    throw new ApiError({
      message:
        "API configuration missing: EXPO_PUBLIC_DOMAIN is not set. Set it to localhost:5000 for local dev or your deployed domain.",
      url: "config://missing",
      isConfigError: true,
    });
  }

  let host = raw.replace(/^https?:\/\//i, "").trim();
  host = host.replace(/\/+$/g, "");
  if (host.includes("/")) {
    host = host.split("/")[0];
  }

  const [hostname, port] = host.split(":");
  const isLocalhost =
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.");

  const protocol: "http" | "https" = isLocalhost ? "http" : "https";
  const hasSuspiciousRemotePort = !isLocalhost && !!port && !hostname.includes("replit");

  if (hasSuspiciousRemotePort) {
    console.warn(
      `[API CONFIG] EXPO_PUBLIC_DOMAIN includes custom port ${port} on remote host ${hostname}. Hosted environments often block that port. Remove the port if requests fail.`,
    );
  }

  const originHost = hasSuspiciousRemotePort ? hostname : host;
  const origin = `${protocol}://${originHost}`;
  const baseUrl = `${origin}/api`;

  cachedApiConfig = { origin, baseUrl, host: originHost, protocol, port, raw };

  logApi({
    method: "CONFIG",
    url: baseUrl,
    message: `Resolved EXPO_PUBLIC_DOMAIN=${raw}`,
  });

  return cachedApiConfig;
}

export function getApiUrl(): string {
  return resolveApiConfig().baseUrl;
}

export function getApiOrigin(): string {
  return resolveApiConfig().origin;
}

export function getApiDiagnostics(): ApiConfig {
  return resolveApiConfig();
}

function normalizeRoute(route: string): string {
  const trimmed = (route || "").trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  let cleaned = trimmed;
  if (cleaned.startsWith("/")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("api/")) cleaned = cleaned.slice(4);
  return cleaned;
}

export function buildApiUrl(route: string): string {
  const normalized = normalizeRoute(route);

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  const base = resolveApiConfig().baseUrl;
  return new URL(normalized, `${base}/`).toString().replace(/\/$/, "");
}

// Get current user ID from AsyncStorage for auth headers
async function getStoredUserId(): Promise<string | null> {
  try {
    const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.id || null;
    }
  } catch {
    // Ignore errors - no user stored
  }
  return null;
}

function getBodySize(data?: unknown): number {
  if (data === undefined) return 0;
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

async function validateResponse(
  res: Response,
  ctx: { method: string; url: string; bodySize?: number },
): Promise<void> {
  const contentType = res.headers.get("content-type") || "";
  const requestId = res.headers.get("x-request-id") || undefined;

  if (contentType.includes("text/html")) {
    const snippet = (await res.text()).slice(0, LOG_SNIPPET_LENGTH);
    const message = "API misconfigured: got HTML instead of JSON. Check API_BASE_URL.";
    logApi({ method: ctx.method, url: ctx.url, status: res.status, message, snippet, level: "error" });
    throw new ApiError({
      message,
      status: res.status,
      statusText: res.statusText,
      url: ctx.url,
      isHtmlResponse: true,
      requestId,
      responseSnippet: snippet,
    });
  }

  if (!res.ok) {
    let serverMessage = res.statusText || "Request failed";
    let snippet = "";

    if (contentType.includes("application/json")) {
      try {
        const data = await res.json();
        serverMessage = data.error || data.message || data.details || serverMessage;
        snippet = JSON.stringify(data);
      } catch {
        // ignore
      }
    } else {
      try {
        const text = await res.text();
        if (text) {
          serverMessage = text;
          snippet = text;
        }
      } catch {
        // ignore
      }
    }

    const truncatedSnippet = snippet ? snippet.slice(0, LOG_SNIPPET_LENGTH) : undefined;
    logApi({
      method: ctx.method,
      url: ctx.url,
      status: res.status,
      message: serverMessage,
      snippet: truncatedSnippet,
      level: "error",
    });

    throw new ApiError({
      message: serverMessage,
      status: res.status,
      statusText: res.statusText,
      url: ctx.url,
      requestId,
      responseSnippet: truncatedSnippet,
    });
  }

  logApi({ method: ctx.method, url: ctx.url, status: res.status, bodySize: ctx.bodySize });
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const urlString = buildApiUrl(route);
  const bodySize = getBodySize(data);
  const bodyString = data !== undefined ? JSON.stringify(data) : undefined;

  logApi({ method, url: urlString, bodySize });

  const headers: Record<string, string> = {};
  if (bodyString) {
    headers["Content-Type"] = "application/json";
  }

  const userId = await getStoredUserId();
  if (userId) {
    headers["x-user-id"] = userId;
  }

  let res: Response;
  try {
    res = await fetch(urlString, {
      method,
      headers,
      body: bodyString,
      credentials: "include",
    });
  } catch {
    const message = `Network error: cannot reach API. URL=${urlString}. Check EXPO_PUBLIC_DOMAIN`;
    logApi({ method, url: urlString, message, level: "error" });
    throw new ApiError({ message, url: urlString, isNetworkError: true });
  }

  await validateResponse(res, { method, url: urlString, bodySize });
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = buildApiUrl(queryKey[0] as string);
    const url = new URL(baseUrl);

    if (queryKey.length > 1 && queryKey[1]) {
      const params = queryKey[1] as Record<string, string>;
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    const urlString = url.toString();
    const headers: Record<string, string> = {};
    const userId = await getStoredUserId();
    if (userId) {
      headers["x-user-id"] = userId;
    }

    logApi({ method: "GET", url: urlString });

    let res: Response;
    try {
      res = await fetch(urlString, {
        headers,
        credentials: "include",
      });
    } catch {
      const message = `Network error: cannot reach API. URL=${urlString}. Check EXPO_PUBLIC_DOMAIN`;
      logApi({ method: "GET", url: urlString, message, level: "error" });
      throw new ApiError({ message, url: urlString, isNetworkError: true });
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      logApi({ method: "GET", url: urlString, status: res.status, message: "Unauthorized (returning null)" });
      return null;
    }

    await validateResponse(res, { method: "GET", url: urlString });
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
