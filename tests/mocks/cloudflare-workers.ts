import { vi } from "vitest";

export const images = {
  info: vi.fn(async () => ({ format: "image/png", width: 1, height: 1, fileSize: 8 })),
  input: vi.fn(),
};

export const env = { IMAGES: images };
