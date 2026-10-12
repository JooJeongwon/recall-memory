import { zipSync, strToU8 } from "fflate";
import { NETWORK_ERROR_MESSAGE, RequestError, requestApi } from "../../lib/api";

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

export async function fetchArchiveItem(id: string) {
  const data = await requestApi<{ original_filename: string; memory: unknown }>(`/api/photos/${id}/export`);
  try {
    const response = await fetch(`/api/photos/${id}/asset?kind=original`, { cache: "no-store", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error("사진을 가져오지 못했어요. 다시 시도해주세요.");
    return { id, originalName: data.original_filename, memory: data.memory, bytes: new Uint8Array(await response.arrayBuffer()) };
  } catch (error) {
    if (error instanceof TypeError) throw new RequestError(NETWORK_ERROR_MESSAGE, "NETWORK_ERROR");
    throw error;
  }
}

export function saveArchive(archive: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(archive)], { type: "application/zip" }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
