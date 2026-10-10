import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import type { Database } from "../../src/types/database";
import { policy } from "../../src/lib/config";
import sharp from "sharp";

test("합성 사진 보관과 실험 만료 후 ZIP 반출을 확인한다", async ({ page }) => {
  test.setTimeout(60_000);
  const url = process.env.INTEGRATION_SUPABASE_URL;
  const key = process.env.INTEGRATION_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.INTEGRATION_SUPABASE_SECRET_KEY;
  const projectId = process.env.INTEGRATION_SUPABASE_PROJECT_ID;
  if (!url || !key || !secret || !projectId || new URL(url).origin !== `https://${projectId}.supabase.co` ||
    url !== process.env.NEXT_PUBLIC_SUPABASE_URL || key !== process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    projectId !== process.env.SUPABASE_PROJECT_ID)
    throw new Error("E2E는 앱과 동일한 전용 개발 Supabase 프로젝트만 사용해야 합니다.");

  const admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;
  try {
    const user = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await user.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    const cookies = new Map<string, string>();
    const server = createServerClient<Database>(url, key, { cookies: {
      getAll: () => [],
      setAll: (values) => { values.forEach(({ name, value }) => value ? cookies.set(name, value) : cookies.delete(name)); },
    } });
    const session = signedIn.data.session!;
    expect((await server.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })).error).toBeNull();
    await page.context().addCookies([...cookies].map(([name, value]) => ({ name, value, url: "http://localhost:3000" })));
    let storageTokenQueries = 0;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/storage/v1/object/") && url.searchParams.has("token")) storageTokenQueries++;
    });

    await page.goto("/settings");
    const consent = page.getByRole("checkbox", { name: "사용 행동 분석에 동의" });
    await expect(consent).not.toBeChecked();
    await consent.check();
    const optInSave = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/me/preferences" &&
      response.request().method() === "PATCH" && response.ok());
    const [preferencesResponse] = await Promise.all([optInSave, page.getByRole("button", { name: "설정 저장" }).click()]);
    expect(await preferencesResponse.json()).toMatchObject({ analytics_consent: true });
    await expect(page.getByRole("status")).toHaveText("설정을 저장했어요.");
    await expect(consent).toBeChecked();
    expect((await admin.from("profiles").select("analytics_consent").eq("user_id", userId).single()).data?.analytics_consent)
      .toBe(true);

    const original = await sharp({ create: { width: 2, height: 2, channels: 4, background: "#fa0" } }).png().toBuffer();
    const secondPhoto = await sharp({ create: { width: 4, height: 2, channels: 3, background: "#0af" } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const photoListRoute = /\/api\/photos\?limit=20$/;
    let failPhotoList = true;
    await page.route(photoListRoute, async (route) => {
      if (failPhotoList) { failPhotoList = false; await route.abort(); }
      else await route.continue();
    });
    await page.goto("/revisit");
    await expect(page.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
    await expect(page.getByRole("link", { name: "사진 선택하기" })).toBeVisible();
    await page.getByRole("button", { name: "다시 불러오기" }).click();
    await expect(page.getByRole("status").filter({ hasText: "선택한 사진이 아직 없어요." })).toBeVisible();
    await page.unroute(photoListRoute);

    await page.goto("/start");
    await expect(page.getByRole("heading", { name: "사진을 다시 마주할 준비" })).toBeVisible();
    const uploadInput = page.locator("#photos");
    await expect(uploadInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    await expect(page.getByText("JPEG·PNG·정적 WebP를 지원해요. HEIC는 변환 후 선택해주세요.")).toBeVisible();
    let reservationRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/uploads" && request.method() === "POST") reservationRequests++;
    });
    await uploadInput.setInputFiles({ name: "unsupported.heic", mimeType: "image/heic", buffer: Buffer.from([1]) });
    await page.getByRole("button", { name: "사진 추가 / 재시도" }).click();
    await expect(page.getByText("unsupported.heic: JPEG·PNG·정적 WebP가 필요해요. HEIC는 변환 후 선택해주세요.")).toBeVisible();
    expect(reservationRequests).toBe(0);
    await uploadInput.setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(policy.maxBytes + 1) });
    await page.getByRole("button", { name: "사진 추가 / 재시도" }).click();
    await expect(page.getByText("too-large.png: 10 MiB 이하 사진을 선택해주세요.")).toBeVisible();
    expect(reservationRequests).toBe(0);
    const tooManyPixels = await sharp({ create: { width: 8_000, height: 5_001, channels: 3, background: "#123" } })
      .png().toBuffer();
    await uploadInput.setInputFiles([
      { name: "spoofed.jpg", mimeType: "image/jpeg", buffer: original },
      { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") },
      { name: "too-many-pixels.png", mimeType: "image/png", buffer: tooManyPixels },
    ]);
    await page.getByRole("button", { name: "사진 추가 / 재시도" }).click();
    await expect(page.getByText("spoofed.jpg: JPEG·PNG·정적 WebP 사진을 선택해주세요.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("broken.png: JPEG·PNG·정적 WebP 사진을 선택해주세요.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("too-many-pixels.png: 사진 크기 제한을 초과했어요.")).toBeVisible({ timeout: 30_000 });
    const rejectedPhotos = await admin.from("photos").select("lifecycle").eq("user_id", userId).eq("lifecycle", "deleting");
    expect(rejectedPhotos.error).toBeNull();
    expect(rejectedPhotos.data).toHaveLength(3);
    expect(rejectedPhotos.data?.every(({ lifecycle }) => lifecycle === "deleting")).toBe(true);
    await page.goto("/revisit");
    await expect(page.getByRole("status").filter({ hasText: "선택한 사진이 아직 없어요." })).toBeVisible();

    await page.goto("/start");
    await uploadInput.setInputFiles([
      { name: "synthetic.png", mimeType: "image/png", buffer: original },
      { name: "synthetic-extra.jpg", mimeType: "image/jpeg", buffer: secondPhoto },
    ]);
    const uploadRoute = /\/storage\/v1\/object\/memory-assets\/[^/]+\/[^/]+\/original\./;
    let uploadAttempts = 0;
    let failSecondUpload = true;
    await page.route(uploadRoute, async (route) => {
      if (route.request().method() === "POST") uploadAttempts++;
      if (route.request().method() === "POST" && uploadAttempts === 2 && failSecondUpload) {
        failSecondUpload = false;
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.abort("connectionreset");
      } else await route.continue();
    });
    await page.getByRole("button", { name: "사진 추가 / 재시도" }).click();
    await expect(page.getByText("synthetic.png: 사진을 추가했어요")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("synthetic-extra.jpg: 사진 전송 중…")).toBeVisible();
    await expect(page.getByText("synthetic-extra.jpg: 사진 전송에 실패했어요. 다시 시도해주세요.")).toBeVisible({ timeout: 30_000 });
    await page.unroute(uploadRoute);
    const retryUpload = page.getByRole("button", { name: "사진 추가 / 재시도" });
    await expect(retryUpload).toBeEnabled();
    await retryUpload.click();
    await expect(page.getByText("synthetic-extra.jpg: 사진을 추가했어요")).toBeVisible({ timeout: 30_000 });
    const orientedPhoto = await admin.from("photos").select("thumbnail_key").eq("user_id", userId)
      .eq("mime_type", "image/jpeg").eq("lifecycle", "ready").single();
    expect(orientedPhoto.error).toBeNull();
    const orientedThumbnail = await admin.storage.from(policy.bucket).download(orientedPhoto.data!.thumbnail_key!);
    expect(orientedThumbnail.error).toBeNull();
    const thumbnailMetadata = await sharp(Buffer.from(await orientedThumbnail.data!.arrayBuffer())).metadata();
    expect(thumbnailMetadata).toMatchObject({ format: "webp", width: 2, height: 4 });
    expect(thumbnailMetadata.orientation).toBeUndefined();
    expect(thumbnailMetadata.exif).toBeUndefined();
    await page.getByRole("link", { name: "사진 다시 보기" }).click();
    await expect(page.getByRole("img", { name: "선택한 기억 사진" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("1번째 사진 / 2장")).toBeVisible();
    const previous = page.getByRole("button", { name: "이전 사진 보기" });
    const next = page.getByRole("button", { name: "다음 사진 보기" });
    await expect(previous).toBeDisabled();
    await next.click();
    await expect(page.getByText("2번째 사진 / 2장 · 마지막 사진이에요.")).toBeVisible();
    await expect(next).toBeDisabled();
    await previous.click();
    await expect(page.getByText("1번째 사진 / 2장")).toBeVisible();
    await page.getByLabel("이 순간에서 무엇을 기억하고 싶나요?").fill("다시 만난 순간을 기억해요.");
    await page.getByRole("button", { name: "메모와 함께 남기기" }).click();
    await expect(page.getByRole("status").filter({ hasText: "사진과 글을 보관함에 남겼어요." })).toBeVisible();

    let failThumbnailOnce = true;
    const thumbnailRoute = /\/api\/photos\/[^/]+\/asset$/;
    await page.route(thumbnailRoute, async (route) => {
      if (failThumbnailOnce) {
        failThumbnailOnce = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      } else await route.continue();
    });
    await page.goto("/memories");
    await expect(page.getByRole("heading", { name: "보관함" })).toBeVisible();
    await expect(page.getByText("다시 만난 순간을 기억해요.")).toBeVisible();
    await expect(page.getByText("사진을 열어 확인해주세요.")).toBeVisible();
    await page.getByRole("button", { name: "다시 불러오기" }).click();
    await expect(page.getByRole("img", { name: "보관한 사진" }).first()).toBeVisible();
    await page.unroute(thumbnailRoute);
    await page.getByRole("link", { name: "사진 열기" }).click();
    await expect(page.getByRole("button", { name: "사진과 메모 가져가기" })).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "사진과 메모 가져가기" }).click(),
    ]);
    const archivePath = await download.path();
    expect(archivePath).not.toBeNull();
    const archiveBytes = await readFile(archivePath!);
    const archive = unzipSync(archiveBytes);
    expect(Buffer.from(archive["original.png"]!).equals(original)).toBe(true);
    expect(JSON.parse(strFromU8(archive["memory.json"]!))).toMatchObject({
      schema_version: 1, original_name: "synthetic.png", note_text: "다시 만난 순간을 기억해요.",
    });

    const currentPhoto = await admin.from("photos").select("id,version").eq("user_id", userId)
      .eq("mime_type", "image/png").eq("lifecycle", "ready").single();
    expect(currentPhoto.error).toBeNull();
    const consentedEvents = await admin.from("events").select("name").eq("user_id", userId).eq("photo_id", currentPhoto.data!.id);
    expect(consentedEvents.error).toBeNull();
    expect(consentedEvents.data?.some(({ name }) => name === "note_saved")).toBe(true);
    const concurrentSave = await admin.rpc("save_note", { p_user_id: userId, p_photo_id: currentPhoto.data!.id,
      p_note_text: "다른 곳에서 먼저 저장한 메모", p_expected_version: currentPhoto.data!.version,
      p_request_id: crypto.randomUUID() });
    expect(concurrentSave.error).toBeNull();
    await page.getByLabel("이 순간에서 무엇을 기억하고 싶나요?").fill("작성 중인 메모는 유지되어야 해요.");
    await page.getByRole("button", { name: "메모와 함께 남기기" }).click();
    await expect(page.getByRole("status").filter({ hasText: "다른 곳에서 수정된 메모가 있어요." })).toBeVisible();
    await expect(page.getByText("다른 곳에서 먼저 저장한 메모")).toBeVisible();
    const noteInput = page.getByLabel("이 순간에서 무엇을 기억하고 싶나요?");
    await expect(noteInput).toHaveValue("작성 중인 메모는 유지되어야 해요.");
    await page.getByRole("button", { name: "내 입력으로 다시 저장 준비" }).click();
    await expect(noteInput).toHaveValue("작성 중인 메모는 유지되어야 해요.");
    await page.getByRole("button", { name: "메모와 함께 남기기" }).click();
    await expect(page.getByRole("status").filter({ hasText: "사진과 글을 보관함에 남겼어요." })).toBeVisible();

    await noteInput.fill("고쳐 쓴 뒤 비워도 사진은 남아요.");
    const noteRoute = /\/api\/photos\/[^/]+\/note$/;
    let failNoteOnce = true;
    await page.route(noteRoute, async (route) => {
      if (route.request().method() === "PUT" && failNoteOnce) {
        failNoteOnce = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
          error: { code: "TEMPORARY_FAILURE", message: "잠시 후 다시 시도해주세요." },
        }) });
      } else await route.continue();
    });
    await page.getByRole("button", { name: "메모와 함께 남기기" }).click();
    await expect(page.getByRole("status").filter({ hasText: "잠시 후 다시 시도해주세요." })).toBeVisible();
    await expect(noteInput).toHaveValue("고쳐 쓴 뒤 비워도 사진은 남아요.");
    const unchanged = await admin.from("photos").select("note_text").eq("id", currentPhoto.data!.id).single();
    expect(unchanged.data?.note_text).toBe("작성 중인 메모는 유지되어야 해요.");
    await page.unroute(noteRoute);
    const noteSave = page.waitForResponse((response) => response.url().includes("/note") && response.request().method() === "PUT" && response.ok());
    await Promise.all([noteSave, page.getByRole("button", { name: "메모와 함께 남기기" }).click()]);
    await expect(page.getByRole("status").filter({ hasText: "사진과 글을 보관함에 남겼어요." })).toBeVisible();
    await page.getByLabel("이 순간에서 무엇을 기억하고 싶나요?").fill("");
    const clearNote = page.waitForResponse((response) => response.url().includes("/note") && response.request().method() === "PUT" && response.ok());
    await Promise.all([clearNote, page.getByRole("button", { name: "메모와 함께 남기기" }).click()]);
    await expect(page.getByRole("status").filter({ hasText: "사진과 글을 보관함에 남겼어요." })).toBeVisible();
    const trial = await admin.from("trials").select("started_at").eq("user_id", userId).single();
    expect(trial.error).toBeNull();
    const startedAt = Date.parse(trial.data!.started_at!);
    const endsAt = new Date(Date.now() - 1_000).toISOString();
    expect(Date.parse(endsAt)).toBeGreaterThan(startedAt);
    expect((await admin.from("trials").update({ ends_at: endsAt }).eq("user_id", userId)).error).toBeNull();
    expect((await admin.rpc("me_state", { p_user_id: userId })).data).toMatchObject({
      trial_state: "ended", can_upload: false,
    });
    await page.goto("/memories");
    await expect(page.getByText("메모를 비워도 사진은 보관되어 있어요.")).toBeVisible();
    await page.getByRole("link", { name: "사진 열기" }).click();
    const exportRoute = /\/api\/photos\/[^/]+\/export$/;
    let exportPreparations = 0;
    page.on("request", (request) => {
      if (exportRoute.test(new URL(request.url()).pathname) && request.method() === "GET") exportPreparations++;
    });
    const originalAssetRoute = /\/api\/photos\/[^/]+\/asset\?kind=original(?:&|$)/;
    let originalAssetRequests = 0;
    let failDownloadOnce = true;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/asset") && url.searchParams.get("kind") === "original") originalAssetRequests++;
    });
    await page.route(originalAssetRoute, async (route) => {
      if (failDownloadOnce) {
        failDownloadOnce = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      } else await route.continue();
    });
    const exportButton = page.getByRole("button", { name: "사진과 메모 가져가기" });
    const [exportResponse] = await Promise.all([
      page.waitForResponse((response) => exportRoute.test(new URL(response.url()).pathname)),
      exportButton.click(),
    ]);
    expect(await exportResponse.json()).not.toHaveProperty("url");
    await expect(page.getByRole("status").filter({ hasText: "사진을 가져오지 못했어요. 다시 시도해주세요." })).toBeVisible();
    await expect(exportButton).toBeEnabled();
    expect(exportPreparations).toBe(1);
    expect(originalAssetRequests).toBe(1);
    await page.unroute(originalAssetRoute);
    const [updatedDownload] = await Promise.all([
      page.waitForEvent("download"),
      exportButton.click(),
    ]);
    expect(exportPreparations).toBe(2);
    await expect(page.getByRole("status").filter({ hasText: "사진과 메모 ZIP을 만들었어요." })).toBeVisible();
    const updatedPath = await updatedDownload.path();
    expect(updatedPath).not.toBeNull();
    const updatedArchive = unzipSync(await readFile(updatedPath!));
    expect(Buffer.from(updatedArchive["original.png"]!).equals(original)).toBe(true);
    const updatedMemory = JSON.parse(strFromU8(updatedArchive["memory.json"]!));
    expect(updatedMemory.note_text).toBe("");
    expect(updatedMemory.preserved_at).toBeTruthy();

    await page.goto("/settings");
    await expect(consent).toBeChecked();
    await consent.uncheck();
    const optOutSave = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/me/preferences" &&
      response.request().method() === "PATCH" && response.ok());
    await Promise.all([optOutSave, page.getByRole("button", { name: "설정 저장" }).click()]);
    await expect(page.getByRole("status")).toHaveText("설정을 저장했어요.");
    expect((await admin.from("profiles").select("analytics_consent").eq("user_id", userId).single()).data?.analytics_consent)
      .toBe(false);
    const clearedEvents = await admin.from("events").select("id").eq("user_id", userId);
    expect(clearedEvents.error).toBeNull();
    expect(clearedEvents.data).toEqual([]);
    const laterEvent = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/events" &&
      response.request().method() === "POST");
    await page.goto(`/photos/${currentPhoto.data!.id}`);
    await expect(page.getByRole("img", { name: "선택한 기억 사진" })).toBeVisible();
    await laterEvent;
    expect(storageTokenQueries).toBe(0);
    expect((await admin.from("events").select("id").eq("user_id", userId)).data).toEqual([]);

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("사진과 메모가 함께 삭제됩니다. 필요하면 먼저 가져가세요. 삭제할까요?");
      void dialog.accept();
    });
    const photoDelete = page.waitForResponse((response) => new URL(response.url()).pathname ===
      `/api/photos/${currentPhoto.data!.id}` && response.request().method() === "DELETE");
    await page.getByRole("button", { name: "사진 삭제" }).click();
    expect((await photoDelete).status()).toBe(202);
    await expect(page.getByRole("status").filter({ hasText: "삭제 요청을 접수했어요. 파일 삭제가 진행 중이에요." })).toBeVisible();
    expect((await admin.from("photos").select("lifecycle,preserved_at").eq("id", currentPhoto.data!.id).single()).data)
      .toMatchObject({ lifecycle: "deleting" });
    const photoDeleteJobs = await admin.from("cleanup_jobs").select("id,kind,status")
      .eq("photo_id", currentPhoto.data!.id).eq("dedupe_key", `photo:${currentPhoto.data!.id}`);
    expect(photoDeleteJobs.data).toHaveLength(1);
    expect(photoDeleteJobs.data?.[0]).toMatchObject({ kind: "photo_delete", status: "pending" });
    expect(await page.evaluate(async (id) => (await fetch(`/api/photos/${id}`)).status, currentPhoto.data!.id)).toBe(404);

    await page.goto("/settings");
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("계정과 모든 사진·메모가 삭제됩니다. 필요한 사진을 먼저 가져가세요. 삭제할까요?");
      void dialog.accept();
    });
    const accountDelete = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/me" &&
      response.request().method() === "DELETE");
    await page.getByRole("button", { name: "계정과 전체 데이터 삭제" }).click();
    expect((await accountDelete).status()).toBe(202);
    await expect(page).toHaveURL(/\/settings\/deletion$/);
    await expect(page.getByRole("status")).toHaveText("사진과 데이터 삭제가 진행 중이에요.");
    expect((await admin.from("profiles").select("account_state,analytics_consent").eq("user_id", userId).single()).data)
      .toMatchObject({ account_state: "deleting", analytics_consent: false });
    const accountDeleteJobs = await admin.from("cleanup_jobs").select("kind,status,progress_token_hash")
      .eq("user_id", userId).eq("kind", "account_delete");
    expect(accountDeleteJobs.data).toHaveLength(1);
    expect(accountDeleteJobs.data?.[0]).toMatchObject({ kind: "account_delete", status: "pending" });
    expect(accountDeleteJobs.data?.[0].progress_token_hash).toMatch(/^[a-f0-9]{64}$/);
  } finally {
    const photos = await admin.from("photos").select("original_key,thumbnail_key").eq("user_id", userId);
    const keys = (photos.data ?? []).flatMap((photo) => [photo.original_key, photo.thumbnail_key].filter((value): value is string => Boolean(value)));
    if (keys.length) await admin.storage.from(policy.bucket).remove(keys);
    await admin.from("cleanup_jobs").delete().eq("user_id", userId);
    await admin.from("events").delete().eq("user_id", userId);
    await admin.from("photos").delete().eq("user_id", userId);
    await admin.from("trials").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
});
