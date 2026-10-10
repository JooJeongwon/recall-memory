import "server-only";
import { env } from "cloudflare:workers";
import { policy } from "../config";
import { ApiError } from "./http";

function isAnimated(bytes: Uint8Array) {
  if (String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
      const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
      if (type === "ANIM" || type === "ANMF" ||
          (type === "VP8X" && size >= 10 && (bytes[offset + 8] & 0x02) !== 0)) return true;
      offset += 8 + size + (size & 1);
    }
  }
  if (String.fromCharCode(...bytes.subarray(0, 8)) === "\x89PNG\r\n\x1a\n") {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (type === "acTL") return true;
      if (size > bytes.length - offset - 12) return false;
      offset += size + 12;
    }
  }
  return false;
}

export async function validateImage(bytes: Uint8Array, expectedMime: string) {
  if (bytes.byteLength > policy.maxBytes) throw new ApiError(413, "FILE_TOO_LARGE");
  try {
    const stream = () => new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes); controller.close(); },
    });
    const meta = await env.IMAGES.info(stream());
    const mimeByFormat: Record<string, string> = { jpeg: "image/jpeg", jpg: "image/jpeg", "image/jpeg": "image/jpeg",
      png: "image/png", "image/png": "image/png", webp: "image/webp", "image/webp": "image/webp" };
    const mime = mimeByFormat[meta.format];
    if (!mime || mime !== expectedMime || !("width" in meta) || !meta.width || !meta.height || isAnimated(bytes))
      throw new ApiError(415, "UNSUPPORTED_MEDIA");
    if (meta.width * meta.height > policy.maxPixels) throw new ApiError(413, "FILE_TOO_LARGE");
    const result = await env.IMAGES.input(stream())
      .transform({ width: 1280, height: 1280 })
      .output({ format: "image/webp" });
    const response = result.response();
    if (!response.ok) throw new ApiError(503, "TEMPORARY_FAILURE");
    const thumbnail = new Uint8Array(await response.arrayBuffer());
    return { width: meta.width, height: meta.height, mime, thumbnail };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "ImagesError" && (error as Error & { code?: number }).code === 9412)
      throw new ApiError(415, "UNSUPPORTED_MEDIA");
    throw new ApiError(503, "TEMPORARY_FAILURE");
  }
}
