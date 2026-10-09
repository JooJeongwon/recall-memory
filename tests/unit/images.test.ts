import sharp from "sharp";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { policy } from "../../src/lib/config";
import { validateImage } from "../../src/lib/server/images";

it("파일 바이트 상한을 넘으면 디코딩 전에 거절한다", async () => {
  await expect(validateImage(Buffer.alloc(policy.maxBytes + 1), "image/png"))
    .rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
});

it("실제 이미지가 픽셀 상한을 넘으면 거절한다", async () => {
  const bytes = await sharp({ create: { width: 8_000, height: 5_001, channels: 3, background: "#123" } })
    .png().toBuffer();
  await expect(validateImage(bytes, "image/png"))
    .rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
});
