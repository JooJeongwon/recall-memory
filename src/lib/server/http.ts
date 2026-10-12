import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

const messages: Record<string, string> = {
  FORBIDDEN: "이 계정은 통계를 볼 수 없어요.",
  INVALID_INPUT: "입력 내용을 확인해주세요.", UNAUTHENTICATED: "다시 로그인해주세요.",
  ACCOUNT_DELETING: "계정 삭제가 진행 중이에요.", NOT_FOUND: "사진을 찾을 수 없어요.",
  VERSION_CONFLICT: "다른 곳에서 수정된 메모가 있어요.", TRIAL_ENDED: "사진을 추가하는 기간이 끝났어요.",
  PHOTO_EXPIRED: "메모 작성 기한이 지나 사진과 메모를 삭제하기 시작했어요.",
  PHOTO_NOT_READY: "이 사진은 지금 변경할 수 없어요.", FILE_TOO_LARGE: "사진 크기 제한을 초과했어요.",
  UNSUPPORTED_MEDIA: "JPEG·PNG·정적 WebP 사진을 선택해주세요.",
  LIMIT_EXCEEDED: "사진은 계정당 20장까지 추가할 수 있어요.", INVALID_ORIGIN: "같은 사이트에서 다시 시도해주세요.",
  TEMPORARY_FAILURE: "잠시 후 다시 시도해주세요.", NOT_CONFIGURED: "개발 환경 연결이 필요해요.",
};
export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown,
    public diagnostic?: { stage: string; cause?: unknown }) { super(code); }
}
export function isAllowedAppOrigin(origin: string | null) {
  const configured = process.env.APP_BASE_URL;
  if (!configured || !origin) return false;
  const base = new URL(configured);
  let candidate: URL;
  try { candidate = new URL(origin); } catch { return false; }
  if (candidate.origin === base.origin) return true;
  const localHosts = ["localhost", "127.0.0.1"];
  return process.env.NODE_ENV === "development" && localHosts.includes(base.hostname) &&
    localHosts.includes(candidate.hostname) && candidate.protocol === base.protocol && candidate.port === base.port;
}
export function requestOrigin(request: Request) {
  const host = request.headers.get("host") ?? request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (!host) return new URL(request.url).origin;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(request.url).protocol.slice(0, -1);
  return `${protocol}://${host}`;
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function assertOrigin(request: Request) {
  if (!process.env.APP_BASE_URL) throw new ApiError(503, "NOT_CONFIGURED");
  if (!isAllowedAppOrigin(request.headers.get("origin")))
    throw new ApiError(403, "INVALID_ORIGIN");
}
export async function input<T>(request: Request, schema: ZodType<T>): Promise<T> {
  // JSON 계약 최대 10개 파일 예약만 받습니다. 사진 바이트는 Storage로 보냅니다.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(400, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) { await reader.cancel(); throw new ApiError(400, "INVALID_INPUT"); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try { return schema.parse(JSON.parse(body)); }
  catch { throw new ApiError(400, "INVALID_INPUT"); }
}
export function endpoint(handler: (request: Request) => Promise<Response>, operation = "api") {
  return async (request: Request) => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    try {
      if (!["GET", "HEAD"].includes(request.method)) assertOrigin(request);
      const response = await handler(request);
      response.headers.set("X-Request-Id", requestId);
      console.info(JSON.stringify({ event: "api_request_completed", request_id: requestId, operation,
        method: request.method, status: response.status, duration_ms: Math.round(performance.now() - started) }));
      return response;
    } catch (error) {
      const failure = error instanceof ApiError ? error : new ApiError(error instanceof ZodError ? 400 : 503,
        error instanceof ZodError ? "INVALID_INPUT" : "TEMPORARY_FAILURE");
      const cause = failure.diagnostic?.cause ?? error;
      const providerCode = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      const errorType = cause instanceof Error && ["Error", "TypeError", "ReferenceError", "SyntaxError",
        "ZodError", "ImagesError", "AuthApiError", "StorageApiError"].includes(cause.name) ? cause.name : "UnknownError";
      // 원문 오류·stack·details에는 메모, 파일 경로, 인증 값이 들어갈 수 있습니다.
      console.error(JSON.stringify({ event: "api_request_failed", request_id: requestId, operation,
        method: request.method, status: failure.status, code: Object.hasOwn(messages, failure.code) ? failure.code : "TEMPORARY_FAILURE",
        stage: failure.diagnostic?.stage ?? "handler", error_type: errorType,
        ...(/^(?:[0-9]{2}[0-9A-Z]{3}|P000[1-4]|PGRST\d{3}|\d{3,4})$/.test(providerCode) ? { provider_code: providerCode } : {}),
        duration_ms: Math.round(performance.now() - started) }));
      const response = json({ error: { code: failure.code, message: messages[failure.code] ?? messages.TEMPORARY_FAILURE,
        request_id: requestId, ...(failure.details ? { details: failure.details } : {}) } }, failure.status);
      response.headers.set("X-Request-Id", requestId);
      return response;
    }
  };
}
export function dbError(error: { message: string } | null, stage = "database") {
  if (!error) return;
  const status: Record<string, number> = { NOT_FOUND: 404, ACCOUNT_DELETING: 403, FORBIDDEN: 403, VERSION_CONFLICT: 409,
    TRIAL_ENDED: 409, PHOTO_NOT_READY: 409, LIMIT_EXCEEDED: 429, INVALID_INPUT: 400 };
  const code = Object.keys(status).find((code) => error.message === code);
  throw new ApiError(code ? status[code] : 503, code ?? "TEMPORARY_FAILURE", undefined, { stage, cause: error });
}
