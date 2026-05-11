import { expect, test } from "@playwright/test";

test("public routes stay accessible and protected dashboard redirects anonymous users", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Escolha o plano ideal para você" })).toBeVisible();

  await page.goto("/legal/terms");
  await expect(page.getByRole("heading", { name: "Termos de Uso" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});
