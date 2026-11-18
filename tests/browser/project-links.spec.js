import { test, expect } from "@playwright/test";

test("help exposes fixed, private-data-free repository and issue links", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#language").selectOption("en");
  await page.locator("#help").click();
  const repository = page.locator("#project-repository");
  const issue = page.locator("#project-issue");
  await expect(repository).toBeVisible();
  await expect(repository).toHaveText("GitHub repository");
  await expect(repository).toHaveAttribute(
    "href",
    "https://github.com/kingshuoxu/inkstone-mdx",
  );
  await expect(issue).toHaveText("Report an issue…");
  await expect(issue).toHaveAttribute(
    "href",
    "https://github.com/kingshuoxu/inkstone-mdx/issues/new",
  );
  for (const link of [repository, issue]) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await page.screenshot({ path: "docs/project-links-en.png" });
  await page.locator("#close-help").click();
  await page.locator("#language").selectOption("zh-CN");
  await page.locator("#help").click();
  await expect(repository).toHaveText("GitHub 仓库");
  await expect(issue).toHaveText("反馈问题…");
  await page.screenshot({ path: "docs/project-links-zh.png" });
  await page.locator("#close-help").click();
  await expect(page.locator("dialog")).not.toBeVisible();
});
