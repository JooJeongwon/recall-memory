import { expect, test } from "@playwright/test";

// Helper: clear session storage before each test that needs a fresh first visit
async function clearIntroSeen(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    try { sessionStorage.removeItem("recall-memory:intro-seen"); } catch {}
  });
}

test.describe("Opening animation", () => {
  test("TEST 1: first visit triggers the splash overlay", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    const splash = page.getByTestId("opening-splash");
    await expect(splash).toBeAttached({ timeout: 2000 });
  });

  test("TEST 2: app icon becomes visible", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    // Wait for icon-reveal phase
    await page.waitForTimeout(600);
    const iconWrap = page.getByTestId("opening-icon");
    await expect(iconWrap).toBeAttached();
    // Computed opacity of the inner frame should be > 0
    const opacity = await page.locator(".splash-icon-frame").evaluate(
      (el) => parseFloat(getComputedStyle(el).opacity)
    );
    expect(opacity).toBeGreaterThan(0.5);
  });

  test("TEST 3: cinematic artwork becomes visible", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    // Wait for artwork phase
    await page.waitForTimeout(1500);
    const artworkWrap = page.getByTestId("opening-artwork");
    await expect(artworkWrap).toBeAttached();
    const opacity = await page.locator(".splash-artwork-wrap").evaluate(
      (el) => parseFloat(getComputedStyle(el).opacity)
    );
    expect(opacity).toBeGreaterThan(0.8);
  });

  test("TEST 4: animation changes visual state over time (data-phase)", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();

    const splash = page.getByTestId("opening-splash");
    await expect(splash).toBeAttached();

    // Sample phases at different times
    await page.waitForTimeout(400);
    const phase1 = await splash.getAttribute("data-phase");

    await page.waitForTimeout(600);
    const phase2 = await splash.getAttribute("data-phase");

    await page.waitForTimeout(700);
    const phase3 = await splash.getAttribute("data-phase");

    // Phases must have changed over time
    const phases = [phase1, phase2, phase3];
    const uniquePhases = new Set(phases.filter(Boolean));
    expect(uniquePhases.size).toBeGreaterThanOrEqual(2);
  });

  test("TEST 5: splash disappears after animation completes", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    const splash = page.getByTestId("opening-splash");
    await expect(splash).toBeAttached();
    // Wait beyond 2400ms
    await page.waitForTimeout(3000);
    await expect(splash).not.toBeAttached();
  });

  test("TEST 6: homepage is interactive after animation completes", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    await page.waitForTimeout(3000);
    // Heading and CTA should be visible and clickable
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
    const cta = page.locator(".landing-cta");
    await expect(cta).toBeVisible();
  });

  test("TEST 7: skip button immediately dismisses the splash", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    const splash = page.getByTestId("opening-splash");
    await expect(splash).toBeAttached();
    // Wait until skip button is visible (icon-reveal phase)
    const skipBtn = page.getByTestId("opening-skip");
    await expect(skipBtn).toBeVisible({ timeout: 2000 });
    await skipBtn.click();
    // Splash should be gone within 500ms
    await expect(splash).not.toBeAttached({ timeout: 800 });
    // Homepage should be interactive
    await expect(page.locator(".landing-root")).toBeVisible();
  });

  test("TEST 8: navigating away and back does not restart intro", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    // Skip the animation first
    await page.waitForTimeout(800);
    await page.getByTestId("opening-skip").click();
    await page.waitForTimeout(500);
    // Navigate away
    await page.goto("/memories");
    await page.waitForTimeout(200);
    // Return home
    await page.goto("/");
    // Splash should NOT appear
    const splash = page.getByTestId("opening-splash");
    await expect(splash).not.toBeAttached({ timeout: 500 });
  });

  test("TEST 9: reload within session does not replay intro", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    // Skip the animation
    await page.waitForTimeout(800);
    await page.getByTestId("opening-skip").click();
    await page.waitForTimeout(400);
    // Reload the page (same session)
    await page.reload();
    const splash = page.getByTestId("opening-splash");
    await expect(splash).not.toBeAttached({ timeout: 500 });
  });

  test("TEST 10: prefers-reduced-motion skips animation", async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: "reduce",
      storageState: { cookies: [], origins: [] },
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error" && /hydrat/i.test(msg.text())) errors.push(msg.text()); });
    await page.goto("/");
    // Splash should not appear at all
    const splash = page.getByTestId("opening-splash");
    await expect(splash).not.toBeAttached({ timeout: 1000 });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test("TEST 11: failed or missing image does not trap user on splash", async ({ page }) => {
    await page.goto("/");
    await clearIntroSeen(page);
    // Block images from loading
    await page.route("**/branding/**", (route) => route.request().resourceType() === "image" ? route.abort() : route.continue());
    await page.reload();
    // Animation should still complete via timeout fallback
    await page.waitForTimeout(4000);
    const splash = page.getByTestId("opening-splash");
    await expect(splash).not.toBeAttached();
    await expect(page.locator(".landing-root")).toBeVisible();
  });

  test("TEST 12: no React hydration errors in console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().toLowerCase().includes("hydrat")) {
        errors.push(msg.text());
      }
    });
    await page.goto("/");
    await clearIntroSeen(page);
    await page.reload();
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });
});
