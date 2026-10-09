import "server-only";
import sharp from "sharp";
import { policy } from "../config";
import { ApiError } from "./http";

export async function validateImage(bytes: Buffer, expectedMime: string) {
  if (bytes.length > policy.maxBytes) throw new ApiError(413, "FILE_TOO_LARGE");
  try {
    const image = sharp(bytes, { limitInputPixels: policy.maxPixels, failOn: "warning", animated: true });
    const meta = await image.metadata();
    const mime = ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<string, string>)[meta.format ?? ""];
    if (!mime || mime !== expectedMime || !meta.width || !meta.height || (meta.pages ?? 1) > 1)
      throw new ApiError(415, "UNSUPPORTED_MEDIA");
    if (meta.width * meta.height > policy.maxPixels) throw new ApiError(413, "FILE_TOO_LARGE");
    // Sharp는 기본적으로 EXIF를 전달하지 않습니다. 이 연산이 실제 픽셀 디코딩도 검사합니다.
    const thumbnail = await image.rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    return { width: meta.width, height: meta.height, mime, thumbnail };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && /pixel limit/i.test(error.message)) throw new ApiError(413, "FILE_TOO_LARGE");
    throw new ApiError(415, "UNSUPPORTED_MEDIA");
  }
}
