import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("inspection downloads the selected real palette and exposes the audited PNG pack", async ({
  page,
}) => {
  await page.goto("/art/samurai.html");
  const canvas = page.locator("#preview");
  await expect(canvas).toHaveAttribute("data-loaded", "true");
  await page.selectOption("#animation", "stand_heavy");
  await page.getByRole("button", { name: "Quadro 3", exact: true }).click();
  await expect(page.locator("#download")).toHaveAttribute(
    "href",
    /stand_heavy\.png$/,
  );
  await page.locator("#p2").check();
  await expect(page.locator("#download")).toHaveAttribute(
    "href",
    /stand_heavy-p2\.png$/,
  );
  const response = await page.request.get(
    await page.locator("#download").getAttribute("href"),
  );
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );
  const pack = await page.request.get("/downloads/samurai-audited-pngs.zip");
  expect(pack.ok()).toBe(true);
  expect((await pack.body()).subarray(0, 2).toString()).toBe("PK");
  await page.locator("#p2").uncheck();
  await page.locator("#boxes").check();
  await page.selectOption("#zoom", "3");
  fs.mkdirSync("art/samurai/qa/audit", { recursive: true });
  fs.writeFileSync(
    "art/samurai/qa/audit/browser-attack-boxes.png",
    Buffer.from(
      (await canvas.evaluate((n) => n.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  await page.screenshot({
    path: "art/samurai/qa/audit/browser-inspector.png",
    fullPage: true,
  });
});
