import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn(), download: vi.fn(),
  upload: vi.fn(), validateImage: vi.fn(), signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/server/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("../../src/lib/server/admin", () => ({ adminClient: () => ({ rpc: mocks.rpc,
  storage: { from: () => ({ download: mocks.download, upload: mocks.upload }) } }) }));
vi.mock("../../src/lib/server/images", () => ({ validateImage: mocks.validateImage }));
import { rpc } from "../../src/lib/server/photos";
import { completeUpload } from "../../src/lib/server/uploads";
import { deleteAccount } from "../../src/lib/server/deletions";
import { requireUser } from "../../src/lib/server/auth";

const userId = "e5fceea3-7635-4b3c-84fd-183d9806f999";
const id = "a9762e02-d9f1-4b59-9e14-e9f2050a03be";
const token = "c2904681-3d72-4c5b-91a4-be9a897379b0";
const photo = { id, note_text: "", second_note_text: "", second_note_at: null, version: 1, original_name: "synthetic.png", mime_type: "image/png",
  byte_size: 3, ready_at: "2026-10-10T00:00:00Z", preserved_at: null, first_note_at: null, first_viewed_at: null };
const auth = { user: { id: userId }, supabase: { auth: { signOut: mocks.signOut } } } as unknown as Awaited<ReturnType<typeof requireUser>>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue(auth);
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "claim_upload") return { data: { already_ready: false, token, photo: {
      ...photo, original_key: "original.png", thumbnail_key: "thumbnail.webp", lifecycle: "uploading", client_request_id: token,
    } }, error: null };
    if (name === "complete_upload") return { data: photo, error: null };
    if (name === "me_state") throw new Error("부가 조회는 실패합니다.");
    return { data: null, error: null };
  });
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
  mocks.validateImage.mockResolvedValue({ width: 2, height: 2, mime: "image/png", thumbnail: Buffer.from([1]) });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

it("업로드 확정은 한 번 인증하고 부가 조회 없이 사진 성공을 반환한다", async () => {
  await expect(completeUpload(id)).resolves.toEqual({ photo });
  expect(mocks.requireUser).toHaveBeenCalledTimes(1);
  expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["claim_upload", "complete_upload"]);
  expect(mocks.rpc).toHaveBeenLastCalledWith("complete_upload", expect.objectContaining({ p_user_id: userId, p_token: token }));
});

it("이미 확정된 업로드 재요청도 한 번 인증하고 같은 사진만 반환한다", async () => {
  mocks.rpc.mockResolvedValue({ data: { already_ready: true, photo }, error: null });
  await expect(completeUpload(id)).resolves.toEqual({ photo });
  expect(mocks.requireUser).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.download).not.toHaveBeenCalled();
});

it("파일 다운로드 실패는 같은 사용자와 lease로 재시도를 준비한다", async () => {
  mocks.download.mockResolvedValue({ data: null, error: new Error("통신 실패") });
  await expect(completeUpload(id)).rejects.toMatchObject({ status: 503 });
  expect(mocks.requireUser).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenLastCalledWith("release_upload", { p_user_id: userId, p_photo_id: id, p_token: token });
});

it("검증되지 않은 호출은 RPC를 실행하지 않는다", async () => {
  mocks.requireUser.mockRejectedValue(new Error("인증 거절"));
  await expect(rpc("me_state", {})).rejects.toThrow("인증 거절");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("외부 인자의 사용자 ID는 인증된 사용자 ID로 덮어쓴다", async () => {
  mocks.rpc.mockResolvedValue({ data: {}, error: null });
  await rpc("me_state", { p_user_id: "untrusted" });
  expect(mocks.requireUser).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith("me_state", { p_user_id: userId });
});

it("계정 삭제는 한 번 인증하고 삭제 접수 뒤 전체 로그아웃한다", async () => {
  mocks.rpc.mockResolvedValue({ data: { id, status: "pending", progress_expires_at: "2026-10-11T00:00:00Z" }, error: null });
  const job = await deleteAccount();
  expect(job).toMatchObject({ job_id: id, status: "pending" });
  expect(job.progress_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(mocks.requireUser).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith("request_account_delete", { p_user_id: userId, p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
});
