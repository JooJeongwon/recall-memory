import sharp from "sharp";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { images } from "../mocks/cloudflare-workers";
import { policy } from "../../src/lib/config";
import { validateImage } from "../../src/lib/server/images";

beforeEach(() => {
  vi.clearAllMocks();
  images.info.mockResolvedValue({ format: "image/png", width: 1, height: 1, fileSize: 8 });
});

it("파일 바이트 상한을 넘으면 디코딩 전에 거절한다", async () => {
  await expect(validateImage(Buffer.alloc(policy.maxBytes + 1), "image/png"))
    .rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
});

it("실제 이미지가 픽셀 상한을 넘으면 거절한다", async () => {
  const bytes = await sharp({ create: { width: 8_000, height: 5_001, channels: 3, background: "#123" } })
    .png().toBuffer();
  images.info.mockResolvedValue({ format: "image/png", width: 8_000, height: 5_001, fileSize: bytes.length });
  await expect(validateImage(bytes, "image/png"))
    .rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
});

it("정적 이미지가 아닌 APNG와 WebP 애니메이션은 거절한다", async () => {
  const apng = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from([0, 0, 0, 8]), Buffer.from("acTL"), Buffer.alloc(12)]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"),
    Buffer.from("ANIM"), Buffer.alloc(4)]);

  await expect(validateImage(apng, "image/png")).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA" });
  images.info.mockResolvedValue({ format: "image/webp", width: 1, height: 1, fileSize: webp.length });
  await expect(validateImage(webp, "image/webp")).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA" });
  expect(images.input).not.toHaveBeenCalled();
});

it("이미지 변환 서비스 오류는 재시도 가능한 실패로 반환한다", async () => {
  images.input.mockReturnValue({
    transform: () => ({ output: async () => ({ response: () => new Response("failed", { status: 500 }) }) }),
  });
  await expect(validateImage(Buffer.from("image"), "image/png"))
    .rejects.toMatchObject({ status: 503, code: "TEMPORARY_FAILURE", diagnostic: { stage: "images.transform" } });
});

it("Images 오류 코드를 원문 없이 진단 로그에 전달한다", async () => {
  const error = Object.assign(new Error("synthetic-private-image-path"), { name: "ImagesError", code: 9412 });
  images.info.mockRejectedValue(error);
  await expect(validateImage(Buffer.from("image"), "image/png")).rejects.toMatchObject({
    status: 415, diagnostic: { stage: "images.info", cause: error },
  });
});
