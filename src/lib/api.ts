const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://192.168.0.97:5050";

console.log("API BASE URL:", BASE_URL);

const DEFAULT_TIMEOUT_MS = 45000;

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
    super(
      `HTTP ${input.status} ${input.statusText}${input.body ? ` — ${input.body}` : ""}`,
    );
    this.name = "ApiError";
    this.status = input.status;
    this.statusText = input.statusText;
    this.body = input.body;
    this.url = input.url;
    this.method = input.method;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Request timed out")), ms);

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL}${normalizedPath}`;
  const method = init?.method ?? "GET";

  console.log("API request:", url);

  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  let res: Response;

  try {
    res = await withTimeout(
      fetch(url, {
        ...init,
        headers: isFormData
          ? {
              Accept: "application/json",
              ...(init?.headers || {}),
            }
          : {
              Accept: "application/json",
              "Content-Type": "application/json",
              ...(init?.headers || {}),
            },
      }),
      DEFAULT_TIMEOUT_MS,
    );
  } catch (error: any) {
    console.log("API network error:", {
      url,
      method,
      message: error?.message ?? String(error),
    });
    throw error;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
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
    throw new Error("Invalid JSON response from API");
  }
}

export function apiGet<T>(path: string) {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body: unknown) {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  return request<T>(path, {
    method: "POST",
    body: isFormData ? (body as FormData) : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}