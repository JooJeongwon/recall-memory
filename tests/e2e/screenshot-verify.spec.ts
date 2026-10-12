/**
 * Screenshot verification: captures the animation at key timestamps.
 * Run once to visually verify the cinematic opening animation plays.
 */
import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const OUT = path.join(process.cwd(), "tests", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

test("capture animation states at key timestamps", async ({ page }) => {
  // Fresh context — clear session storage
  await page.goto("/");
  await page.evaluate(() => {
    try { sessionStorage.removeItem("recall-memory:intro-seen"); } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const shot = async (label: string) => {
    const p = path.join(OUT, `${label}.png`);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`  shot: ${label}.png`);
  };

  // t=0 — splash just mounted
  await shot("t000_mounted");

  // t=200 — icon should start appearing
  await page.waitForTimeout(200);
  await shot("t200_icon_start");

  // t=500 — icon fully visible
  await page.waitForTimeout(300);
  await shot("t500_icon_visible");

  // t=900 — portal transition underway
  await page.waitForTimeout(400);
  await shot("t900_portal");

  // t=1300 — artwork phase
  await page.waitForTimeout(400);
  await shot("t1300_artwork");

  // t=1700 — full brand composition
  await page.waitForTimeout(400);
  await shot("t1700_brand");

  // t=2200 — homepage transition in progress
  await page.waitForTimeout(500);
  await shot("t2200_exit");

  // t=2600 — homepage fully visible
  await page.waitForTimeout(400);
  await shot("t2600_homepage");

  // Verify distinct phases
  const splash = page.getByTestId("opening-splash");
  await expect(splash).not.toBeAttached({ timeout: 500 });

  console.log(`\nScreenshots saved to: ${OUT}`);
});
