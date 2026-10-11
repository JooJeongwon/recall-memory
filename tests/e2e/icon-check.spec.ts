import { test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const OUT = path.join(process.cwd(), "tests", "screenshots");

test("capture icon reveal at 300-400ms", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("/");
  await page.evaluate(() => {
    try { sessionStorage.removeItem("recall-memory:intro-seen"); } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.waitForTimeout(280);
  await page.screenshot({ path: path.join(OUT, "t280_icon.png") });

  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(OUT, "t340_icon.png") });

  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(OUT, "t440_icon.png") });

  // Also capture opacity of icon frame
  const frameOpacity = await page.locator(".splash-icon-frame").evaluate(
    (el) => parseFloat(getComputedStyle(el).opacity)
  ).catch(() => -1);
  console.log("Icon frame opacity at ~440ms:", frameOpacity);

  const phase = await page.getByTestId("opening-splash").getAttribute("data-phase").catch(() => "gone");
  console.log("Splash phase at ~440ms:", phase);
});
