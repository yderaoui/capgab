import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("homepage, invalid mint, mobile navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "THE CHART SAYS",
  );
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Solana token mint address").fill("invalid");
  await page.getByRole("button", { name: "Scan token", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText(
    "valid Solana",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Watchlist", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep your exits in view." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
});
test("demo size, comparison, receipts, downloads and tampering", async ({
  page,
}) => {
  await page.goto("/scan?demo=poor");
  await expect(
    page.getByText("DISPLAYED POSITION VALUE", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metric-card.highlight strong")).toHaveText(
    "$1,640.00",
  );
  await page.screenshot({
    path: "test-results/scanner-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "$100", exact: true }).click();
  await expect(page.locator(".metric-card.highlight strong")).not.toHaveText(
    "$1,640.00",
  );
  await expect(
    page.getByRole("heading", { name: "Cross-provider comparison" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quote 5 sizes" }).click();
  await expect(
    page.getByRole("button", { name: "Quote 5 sizes" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save token", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  // A cold serverless instance may not retain the ephemeral demo receipt.
  await page.route("**/api/v1/receipts/*", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          message: "Ephemeral preview is not available in this instance.",
        },
      }),
    }),
  );
  await page.getByRole("button", { name: "Generate demo receipt" }).click();
  await expect(page).toHaveURL(/\/receipt\//);
  await page
    .getByRole("button", { name: "Verify receipt", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Signature valid");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const jsonPath = await download.path();
  expect(jsonPath).not.toBeNull();
  const receipt = JSON.parse(await readFile(jsonPath!, "utf8"));
  expect(receipt.algorithm).toBe("Ed25519");
  const imagePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image" }).click();
  const imageDownload = await imagePromise;
  expect(imageDownload.suggestedFilename()).toMatch(/\.png$/);
  expect(await imageDownload.failure()).toBeNull();
  await imageDownload.saveAs("test-results/receipt-card.png");
  const png = await readFile("test-results/receipt-card.png");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  receipt.content.analysis.values.exitValue = "999999";
  const rejected = await page.request.post(
    `/receipt/${receipt.content.id}/image`,
    { data: receipt },
  );
  expect(rejected.status()).toBe(400);
  await page
    .getByLabel("Verify a downloaded receipt JSON (detects tampering locally)")
    .setInputFiles({
      name: "tampered.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(receipt)),
    });
  await expect(page.getByRole("status")).toContainText("tampering detected");
  await page.screenshot({ path: "test-results/receipt.png", fullPage: true });
});
test("comparison demo and route-unavailable states", async ({ page }) => {
  await page.goto("/compare?demo=mismatch");
  await expect(
    page.getByRole("heading", { name: "Cross-provider comparison" }),
  ).toBeVisible();
  await expect(
    page.getByText("MATCHED OBSERVATIONS", { exact: true }),
  ).toBeVisible();
  await page.goto("/scan?demo=no-route");
  await expect(page.locator(".metric-card.highlight strong")).toHaveText(
    "Unknown",
  );
  await expect(page.locator(".diagnostic h3")).toContainText(
    "QUOTE UNAVAILABLE",
  );
});
test("local alert configuration and private API protection", async ({
  page,
  request,
}) => {
  for (const url of [
    "/api/v1/watchlist",
    "/api/v1/alerts",
    "/api/v1/history",
  ]) {
    expect((await request.get(url)).status()).toBe(401);
  }
  const bad = await request.post("/api/v1/scan", {
    data: { mint: "not-valid" },
  });
  expect(bad.status()).toBe(400);
  const cross = await request.post("/api/v1/scan", {
    headers: { origin: "https://evil.example" },
    data: { mint: "11111111111111111111111111111112", mode: "demo" },
  });
  expect(cross.status()).toBe(403);
  await page.goto("/alerts");
  await page.getByRole("button", { name: "New alert" }).click();
  await page.getByLabel("Threshold", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("DEMO · not monitored")).toBeVisible();
  await page.getByRole("button", { name: "Delete alert" }).click();
  await expect(
    page.getByRole("heading", { name: "No alert rules yet." }),
  ).toBeVisible();
});
test("all main routes render without dead navigation", async ({ page }) => {
  for (const route of [
    "/scan",
    "/compare",
    "/receipts",
    "/watchlist",
    "/alerts",
    "/leaderboard",
    "/dashboard",
    "/settings",
    "/about",
    "/methodology",
    "/privacy",
    "/terms",
    "/docs",
  ]) {
    const r = await page.goto(route);
    expect(r?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
  }
});
test("mobile scanner and receipt stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scan?demo=poor");
  await expect(page.locator(".metric-card.highlight strong")).toHaveText(
    "$1,640.00",
  );
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/scanner-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Generate demo receipt" }).click();
  await expect(page).toHaveURL(/\/receipt\//);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page
    .getByRole("button", { name: "Verify receipt", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Signature valid");
  await page.screenshot({
    path: "test-results/receipt-mobile.png",
    fullPage: true,
  });
});
