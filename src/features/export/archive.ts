import { zipSync, strToU8 } from "fflate";

export function createArchive(originalName: string, original: Uint8Array, memory: unknown) {
  if (!/^original\.(jpg|png|webp)$/.test(originalName)) throw new Error("잘못된 원본 파일명");
  return zipSync({ [originalName]: original, "memory.json": strToU8(JSON.stringify(memory, null, 2)) }, { level: 0 });
}
