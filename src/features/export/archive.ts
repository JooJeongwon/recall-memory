import { zipSync, strToU8 } from "fflate";

export function createArchive(originalName: string, original: Uint8Array, memory: unknown) {
  if (!/^original\.(jpg|png|webp)$/.test(originalName)) throw new Error("잘못된 원본 파일명");
  return zipSync({ [originalName]: original, "memory.json": strToU8(JSON.stringify(memory, null, 2)) }, { level: 0 });
}

export function createBulkArchive(
  items: { id: string; originalName: string; bytes: Uint8Array; memory: unknown }[]
) {
  const files: Parameters<typeof zipSync>[0] = {};
  for (const item of items) {
    if (!/^original\.(jpg|png|webp)$/.test(item.originalName)) throw new Error("잘못된 원본 파일명");
    files[`${item.id}/${item.originalName}`] = item.bytes;
    files[`${item.id}/memory.json`] = strToU8(JSON.stringify(item.memory, null, 2));
  }
  return zipSync(files, { level: 0 });
}
