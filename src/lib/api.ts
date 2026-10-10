export class RequestError extends Error {
  constructor(message: string, public code: string, public details?: unknown) { super(message); }
}
export const NETWORK_ERROR_MESSAGE = "인터넷 연결이 불안정해요. 연결을 확인한 뒤 다시 시도해주세요.";
export async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, { ...init, cache: "no-store", headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers,
    } });
    if (response.status === 204) return undefined as T;
    const body = await response.json();
    if (!response.ok) throw new RequestError(body.error?.message ?? "잠시 후 다시 시도해주세요.",
      body.error?.code ?? "TEMPORARY_FAILURE", body.error?.details);
    return body as T;
  } catch (error) {
    if (error instanceof TypeError) throw new RequestError(NETWORK_ERROR_MESSAGE, "NETWORK_ERROR");
    throw error;
  }
}
