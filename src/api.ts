import { isAdminPreview, previewApi } from "./admin-preview";
export async function api<T = any>(
  route: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (isAdminPreview) return (await previewApi(route, method, body)) as T;
  const response = await fetch(`/api${route}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Service unavailable" }));
  if (!response.ok)
    throw new Error(data.error || "Request could not be completed.");
  return data;
}
