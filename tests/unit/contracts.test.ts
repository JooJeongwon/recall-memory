import { describe, expect, it } from "vitest";
import { noteInput, uploadInput, preferencesInput, eventInput, noteStage, editableNote, memoryNote, photoSchema } from "../../src/lib/validation/contracts";
import { policy } from "../../src/lib/config";
const id = "e5fceea3-7635-4b3c-84fd-183d9806f999";
const file = { original_name: "synthetic.png", mime_type: "image/png", byte_size: 100, client_request_id: id };
describe("공유 API 입력 계약", () => {
  it("메모 공백과 Unicode 코드포인트 제한을 적용한다", () => {
    const note = (text: string) => noteInput.safeParse({ note_text: text, expected_version: 1, request_id: id, note_stage: "first" });
    expect(note(" \n기억\u3000 ").success).toBe(true);
    expect(noteInput.parse({ note_text: " \n기억\u3000 ", expected_version: 1, request_id: id, note_stage: "first" }).note_text).toBe("기억");
    expect(note("📷".repeat(500)).success).toBe(true);
    expect(note("📷".repeat(501)).success).toBe(false);
    expect(note("").success).toBe(true); // 최초 빈 저장 거절은 DB의 보관 상태 검사입니다.
  });
  it("버전과 요청 ID를 요구하며 사용자 ID를 받지 않는다", () => {
    expect(noteInput.safeParse({ note_text: "기억", expected_version: 0, request_id: id, note_stage: "first" }).success).toBe(false);
    expect(noteInput.safeParse({ note_text: "기억", expected_version: 1, request_id: id, note_stage: "first", user_id: id }).success).toBe(false);
  });
  it("메모 단계를 반드시 명시한다", () => {
    const input = { note_text: "기억", expected_version: 1, request_id: id };
    expect(noteInput.safeParse(input).success).toBe(false);
    expect(noteInput.safeParse({ ...input, note_stage: "second" }).success).toBe(true);
    expect(noteInput.safeParse({ ...input, note_stage: "third" }).success).toBe(false);
  });
  it("첫 메모 저장 후 보관 전에도 두 번째 메모를 입력하고 빈 수정도 유지한다", () => {
    const base = photoSchema.parse({ id, note_text: "", version: 1,
      original_name: "synthetic.png", mime_type: "image/png", byte_size: 100,
      ready_at: "2026-10-13T00:00:00Z", first_note_at: null, first_viewed_at: null,
      preserved_at: null, second_note_text: "", second_note_at: null });
    expect(noteStage(base)).toBe("first");
    const first = { ...base, note_text: "첫 메모", first_note_at: base.ready_at };
    expect(noteStage(first)).toBe("second");
    expect(editableNote(first)).toBe("");
    expect(memoryNote(first)).toBe("첫 메모");
    const second = { ...first, second_note_text: "두 번째 메모", second_note_at: base.ready_at, preserved_at: base.ready_at };
    expect(editableNote(second)).toBe("두 번째 메모");
    expect(memoryNote(second)).toBe("두 번째 메모");
    expect(memoryNote({ ...second, second_note_text: "" })).toBe("");
  });
  it("예약 수와 파일 크기·형식을 제한하고 중복 ID를 거절한다", () => {
    expect(uploadInput.safeParse({ files: [file] }).success).toBe(true);
    expect(uploadInput.safeParse({ files: [file, file] }).success).toBe(false);
    expect(uploadInput.safeParse({ files: [] }).success).toBe(false);
    expect(uploadInput.safeParse({ files: [{ ...file, byte_size: policy.maxBytes + 1 }] }).success).toBe(false);
    expect(uploadInput.safeParse({ files: [{ ...file, mime_type: "image/heic" }] }).success).toBe(false);
  });
  it("분석 이벤트에 메모·파일명·자유 payload를 넣지 못한다", () => {
    const event = { name: "memory_opened", photo_id: id, client_event_id: id };
    expect(eventInput.safeParse(event).success).toBe(true);
    expect(eventInput.safeParse({ ...event, note_text: "가상 메모" }).success).toBe(false);
    expect(eventInput.safeParse({ ...event, name: "arbitrary" }).success).toBe(false);
  });
  it("유효한 타임존과 명시적인 분석 동의를 받는다", () => {
    expect(preferencesInput.safeParse({ analytics_consent: false, timezone: "Asia/Seoul" }).success).toBe(true);
    expect(preferencesInput.safeParse({ analytics_consent: false, timezone: "invalid" }).success).toBe(false);
  });
});
