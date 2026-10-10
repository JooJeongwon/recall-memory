import { expect, test } from "@playwright/test";
test("소개 화면에 보존 정책과 파일 선택 범위를 안내한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /사진 속 순간에/ })).toBeVisible();
  await expect(page.getByText(/기간이 끝나도 기존 사진과 글은 계속/)).toBeVisible();
  await expect(page.getByText(/직접 선택한 사진만 복사/)).toBeVisible();
  await page.getByRole("link", { name: "시작하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Google로 로그인" })).toBeVisible();
});
