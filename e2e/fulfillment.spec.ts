import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers";

test.describe("Fulfillment page", () => {
  test("Nav shows Fulfillment link for logged-in client", async ({ page }) => {
    await adminLogin(page);

    // Desktop nav should contain Fulfillment link
    const fulfillmentLink = page.locator('nav a[href="/fulfillment"]');
    await expect(fulfillmentLink).toBeVisible({ timeout: 5_000 });
    expect(await fulfillmentLink.textContent()).toBe("Fulfillment");
  });

  test("Fulfillment page loads with correct sections", async ({ page }) => {
    await adminLogin(page);

    await page.goto("/fulfillment");
    await expect(
      page.locator("h1", { hasText: "Fulfillment" }),
    ).toBeVisible({ timeout: 15_000 });

    // Should show both section headings
    await expect(
      page.locator("h2", { hasText: "Fulfilled" }),
    ).toBeVisible();
    await expect(
      page.locator("h2", { hasText: "Pending" }),
    ).toBeVisible();
  });

  test("Fulfillment page shows pending items or empty state", async ({ page }) => {
    await adminLogin(page);

    await page.goto("/fulfillment");
    await expect(
      page.locator("h1", { hasText: "Fulfillment" }),
    ).toBeVisible({ timeout: 15_000 });

    // Either a table with pending items or an "All items have been fulfilled" message
    const pendingSection = page.locator("section").last();
    const hasTable = await pendingSection.locator("table").count() > 0;
    const hasEmptyMsg = await pendingSection.locator("text=All items have been fulfilled").count() > 0;
    const hasNoOrders = await page.locator("text=No orders with fulfillment tracking yet").count() > 0;

    expect(hasTable || hasEmptyMsg || hasNoOrders).toBe(true);
    console.log(
      `Fulfillment page state: ${hasNoOrders ? "no orders" : hasTable ? "has pending items" : "all fulfilled"}`,
    );
  });

  test("Mobile nav shows Fulfillment link", async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only test");

    await adminLogin(page);

    // Open hamburger menu
    const hamburger = page.locator('button[aria-label="Toggle menu"]');
    await expect(hamburger).toBeVisible({ timeout: 5_000 });
    await hamburger.click();

    const fulfillmentLink = page.locator('nav a[href="/fulfillment"]');
    await expect(fulfillmentLink).toBeVisible({ timeout: 5_000 });
  });
});
