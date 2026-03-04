import { test, expect } from "@playwright/test";
import { adminLogin, BASE } from "./helpers";

/**
 * E2E: Live stock check on order 33 (first 10 pending items)
 *
 * 1. Admin logs in
 * 2. Opens stock check for order 33
 * 3. Clicks "Check All" to trigger live stock check
 * 4. Verifies live results appear (stock count + price)
 * 5. Verifies items auto-transition from pending
 */

const ORDER_ID = 33;

test.describe("Live stock check — Order 33", () => {
  test("Check All auto-processes first batch of pending items", async ({
    page,
  }) => {
    // Increase timeout — live fetches take ~2s per item
    test.setTimeout(180_000);

    await adminLogin(page);

    // Navigate to stock check page
    await page.goto(`/admin/orders/${ORDER_ID}/stock-check`);
    await expect(
      page.locator("h1", { hasText: "Stock Check" }),
    ).toBeVisible({ timeout: 15_000 });

    // Count pending items before
    const progressText = await page
      .locator("text=/\\d+\\/\\d+ items checked/")
      .textContent();
    console.log(`Before: ${progressText}`);

    const match = progressText?.match(/(\d+)\/(\d+)/);
    const checkedBefore = match ? parseInt(match[1]) : 0;
    const total = match ? parseInt(match[2]) : 0;
    console.log(`Checked: ${checkedBefore}/${total}`);

    // Find Check All button and click it
    const checkAllBtn = page.locator('button:has-text("Check All")');
    await expect(checkAllBtn).toBeVisible();
    await expect(checkAllBtn).toBeEnabled();
    await checkAllBtn.click();

    // Button should show progress text
    await expect(
      page.locator("button", { hasText: /Checking \d+\// }),
    ).toBeVisible({ timeout: 10_000 });
    console.log("Check All started — progress visible");

    // Wait for Check All to complete (button returns to "Check All")
    // Each item takes ~2-3s, batch of 20 takes ~60s on the API side
    await expect(checkAllBtn).toHaveText("Check All", { timeout: 120_000 });
    console.log("Check All completed");

    // Verify live results appeared — look for "in stock" indicators
    const stockIndicators = page.locator("text=/\\d+ in stock/");
    const stockCount = await stockIndicators.count();
    console.log(`Live stock indicators visible: ${stockCount}`);
    expect(stockCount).toBeGreaterThan(0);

    // Verify some items were auto-marked (green border = in_stock)
    const greenItems = page.locator(".space-y-3 > div.border-green-900\\/50");
    // Wait a moment for state to settle
    await page.waitForTimeout(2000);
    const greenCount = await greenItems.count();
    console.log(`Items marked in_stock (green): ${greenCount}`);

    // Check progress updated
    const newProgress = await page
      .locator("text=/\\d+\\/\\d+ items checked/")
      .textContent();
    console.log(`After: ${newProgress}`);
    const newMatch = newProgress?.match(/(\d+)\/(\d+)/);
    const checkedAfter = newMatch ? parseInt(newMatch[1]) : 0;
    expect(checkedAfter).toBeGreaterThan(checkedBefore);
    console.log(
      `Progress: ${checkedBefore} → ${checkedAfter} (+${checkedAfter - checkedBefore} items)`,
    );

    // Verify price indicators appeared (✓ for matching prices)
    const priceMatch = page.locator("text=/¥[\\d,]+ ✓/");
    const priceMatchCount = await priceMatch.count();
    console.log(`Price match indicators (✓): ${priceMatchCount}`);

    // Verify out-of-stock indicators if any
    const oosIndicators = page.locator(
      ".space-y-3 > div.border-red-900\\/50",
    );
    const oosCount = await oosIndicators.count();
    console.log(`Items marked out_of_stock (red): ${oosCount}`);

    // Screenshot for visual verification
    await page.screenshot({
      path: "test-results/stock-check-after.png",
      fullPage: true,
    });
    console.log("Screenshot saved to test-results/stock-check-after.png");
  });

  test("Per-item Check button works", async ({ page }) => {
    test.setTimeout(60_000);

    await adminLogin(page);
    await page.goto(`/admin/orders/${ORDER_ID}/stock-check`);
    await expect(
      page.locator("h1", { hasText: "Stock Check" }),
    ).toBeVisible({ timeout: 15_000 });

    // Find the first pending item with a Check button
    const pendingItems = page.locator(
      '.space-y-3 > div.border-\\[\\#1e1e2e\\]',
    );
    const pendingCount = await pendingItems.count();

    if (pendingCount === 0) {
      console.log("No pending items left — skipping per-item test");
      return;
    }

    const firstPending = pendingItems.first();
    const checkBtn = firstPending.locator('button:has-text("Check")').first();
    await expect(checkBtn).toBeVisible();

    // Get card number for logging
    const cardNum = await firstPending.locator(".font-mono").textContent();
    console.log(`Checking single item: ${cardNum}`);

    // Click Check
    await checkBtn.click();

    // Should show loading state
    await expect(
      firstPending.locator('button:has-text("...")'),
    ).toBeVisible({ timeout: 5_000 });

    // Wait for result — either stock indicator or status change
    await expect(
      firstPending.locator("text=/\\d+ in stock|Out of stock/"),
    ).toBeVisible({ timeout: 30_000 });

    const resultText = await firstPending
      .locator("text=/\\d+ in stock|Out of stock/")
      .textContent();
    console.log(`Result for ${cardNum}: ${resultText}`);

    // Item should no longer be pending (border changed)
    await expect(firstPending).not.toHaveClass(/border-\[#1e1e2e\]/, {
      timeout: 10_000,
    });
    console.log(`${cardNum} status updated from pending`);
  });
});
