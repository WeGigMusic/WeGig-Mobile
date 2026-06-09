import { requireApiBaseUrl } from "../config/env";

const BASE_URL = requireApiBaseUrl().replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 45000;

export const FRIENDLY_API_ERROR =
  "Looks like we're having a soundcheck issue. Please try again later.";

export class ApiError extends Error {
  status: number;
  statusText: string;
  body: string;
  url: string;
  method: string;

  constructor(input: {
    status: number;
    statusText: string;
    body: string;
    url: string;
    method: string;
  }) {
    super(FRIENDLY_API_ERROR);

    this.name = "ApiError";
    this.status = input.status;
    this.statusText = input.statusText;
    this.body = input.body;
    this.url = input.url;
    this.method = input.method;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new Error(FRIENDLY_API_ERROR));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(id);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(id);
        reject(error);
      });
  });
}

async function getAccessToken(): Promise<string | null> {
  const { supabase } = await import("./supabase");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

function buildHeaders(
  isFormData: boolean,
  accessToken: string | null,
  initHeaders?: HeadersInit,
): HeadersInit {
  const baseHeaders: HeadersInit = isFormData
    ? { Accept: "application/json" }
    : {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

  return {
    ...baseHeaders,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(initHeaders || {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL}${normalizedPath}`;
  const method = init?.method ?? "GET";

  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  const accessToken = await getAccessToken();

  let res: Response;

  try {
    res = await withTimeout(
      fetch(url, {
        ...init,
        headers: buildHeaders(isFormData, accessToken, init?.headers),
      }),
      DEFAULT_TIMEOUT_MS,
    );
  } catch (error: unknown) {
    console.log("API network error:", {
      url,
      method,
      message: error instanceof Error ? error.message : String(error),
    });

    throw new Error(FRIENDLY_API_ERROR);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");

    console.log("API response error:", {
      url,
      method,
      status: res.status,
      statusText: res.statusText,
      body: text,
    });

    throw new ApiError({
      url,
      method,
      status: res.status,
      statusText: res.statusText,
      body: text,
    });
  }

  const text = await res.text();

  if (!text) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    console.log("API JSON parse error:", { url, method, text });
    throw new Error(FRIENDLY_API_ERROR);
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  return request<T>(path, {
    method: "POST",
    body: isFormData ? (body as FormData) : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}