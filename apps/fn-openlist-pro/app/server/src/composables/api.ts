import axios from "axios";

const API_BASE = "/cgi/ThirdParty/fn-openlist-pro";

const apiClient = axios.create({
  baseURL: API_BASE,
});

export async function apiFetch<T = any>(
  action: string,
  options?: {
    method?: string;
    body?: Record<string, any>;
  },
): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const params = { action };

  if (method === "GET") {
    const res = await apiClient.get("/api.cgi", { params });
    return res.data;
  }

  // POST with form-urlencoded
  const body = options?.body
    ? new URLSearchParams(options.body).toString()
    : undefined;

  const res = await apiClient.post("/api.cgi", body, {
    params,
    headers: body
      ? { "Content-Type": "application/x-www-form-urlencoded" }
      : undefined,
  });
  return res.data;
}

export async function apiFetchBlob(action: string): Promise<Response> {
  const res = await apiClient.post("/api.cgi", null, {
    params: { action },
    responseType: "blob",
  });
  // Convert axios response to a fetch-like Response for compatibility
  return new Response(res.data, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers as any),
  });
}
