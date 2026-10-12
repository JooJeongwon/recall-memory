import { afterEach, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { createBulkArchive, fetchArchiveItem } from "../../src/features/export/archive";

afterEach(() => vi.unstubAllGlobals());

it("일괄 ZIP에 사진별 원본과 UTF-8 두 메모를 포함한다", () => {
  const memory = { note_text: "첫 번째 기억", second_note_text: "두 번째 기억", schema_version: 2 };
  const bytes = new Uint8Array([1, 2, 3]);
  const archive = unzipSync(createBulkArchive([
    { id: "photo-a", originalName: "original.png", bytes, memory },
    { id: "photo-b", originalName: "original.jpg", bytes, memory },
  ]));
  expect(Object.keys(archive)).toEqual(["photo-a/original.png", "photo-a/memory.json", "photo-b/original.jpg", "photo-b/memory.json"]);
  expect(archive["photo-a/original.png"]).toEqual(bytes);
  expect(JSON.parse(strFromU8(archive["photo-b/memory.json"]))).toEqual(memory);
  expect(() => createBulkArchive([{ id: "photo-a", originalName: "../bad", bytes, memory }])).toThrow();
});

it("현재 내보내기 API의 메타데이터와 인증된 원본 스트림을 사용한다", async () => {
  const memory = { note_text: "가상 첫 메모", second_note_text: "가상 두 번째 메모" };
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ original_filename: "original.png", memory }))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchArchiveItem("photo-a")).resolves.toEqual({ id: "photo-a", originalName: "original.png", memory, bytes: new Uint8Array([1, 2, 3]) });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/photos/photo-a/export", "/api/photos/photo-a/asset?kind=original"]);
});

it("원본 접근 실패나 연결 단절을 누락된 ZIP 성공으로 처리하지 않는다", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ original_filename: "original.png", memory: {} }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchArchiveItem("photo-a")).rejects.toThrow("사진을 가져오지 못했어요.");
  fetch.mockResolvedValueOnce(Response.json({ original_filename: "original.png", memory: {} }))
    .mockRejectedValueOnce(new TypeError("offline"));
  await expect(fetchArchiveItem("photo-a")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
});
