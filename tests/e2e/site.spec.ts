import { expect, test, type Page } from "@playwright/test";

const input = (page: Page) =>
  page.getByRole("textbox", { name: "terminal input", exact: true });
const reader = (page: Page) =>
  page.getByRole("region", { name: /^Read-only file / });
const scrollback = (page: Page) => page.getByTestId("scrollback");

async function command(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press("Enter");
}

async function home(page: Page) {
  await page.goto("./");
  await expect(input(page)).toBeVisible();
}

test("home keeps the ghost, descriptions and no automatic whoami", async ({
  page,
}, info) => {
  await home(page);
  await expect(scrollback(page)).not.toContainText("whoami");
  await expect(
    page.getByRole("button", { name: "ls ~/project", exact: true }).first(),
  ).toBeVisible();
  await expect(scrollback(page)).toContainText("projects and papers");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("home.png") });
});

test("open launches a single primary URL", async ({ page }) => {
  await home(page);
  await page.evaluate(() => {
    window.open = (url) => {
      document.documentElement.dataset.openedUrl = String(url);
      return null;
    };
  });
  await command(page, "open ~/project/geospatial-mae.md");
  await expect(page.locator("html")).toHaveAttribute(
    "data-opened-url",
    "https://github.com/ZejiaYang/MAE_GeoTessera",
  );
});

test("banner navigation works from the projects directory", async ({
  page,
}) => {
  await page.goto("projects/");
  await expect(input(page)).toBeVisible();
  await page
    .getByRole("button", { name: "ls ~/blog", exact: true })
    .first()
    .click();
  await expect(scrollback(page)).toContainText("ls ~/blog");
  await expect(scrollback(page)).not.toContainText("no such file");
  await page
    .getByRole("button", { name: "vim ~/about.txt", exact: true })
    .first()
    .click();
  await expect(reader(page)).toContainText("## experience");
  await reader(page).press("q");
  await expect(input(page)).toBeFocused();
});

test("dashboard file shortcuts work after cd", async ({ page }, info) => {
  test.skip(
    info.project.name === "mobile",
    "Dashboard is intentionally hidden at phone width.",
  );
  await home(page);
  await command(page, "cd project");
  await page
    .getByRole("button", { name: "cat ~/now.txt", exact: true })
    .click();
  await expect(scrollback(page)).toContainText("manifesting meaninglessness");
  await page
    .getByRole("button", { name: "cat ~/elsewhere.txt", exact: true })
    .click();
  await expect(scrollback(page)).toContainText("go ask me in-person.com");
  await expect(scrollback(page)).not.toContainText("no such file");
});

test("keyboard users can leave the input and activate a command", async ({
  page,
}) => {
  await home(page);
  await input(page).fill("fast");
  await input(page).press("Shift+Tab");
  await expect(input(page)).not.toBeFocused();
  const about = page
    .getByRole("button", { name: "vim ~/about.txt", exact: true })
    .first();
  await about.focus();
  await about.press("Enter");
  await expect(reader(page)).toBeFocused();
  await reader(page).press(":");
  await reader(page).press("q");
  await reader(page).press("Enter");
  await expect(reader(page)).toHaveCount(0);
});

test("help examples contain no executable placeholders", async ({ page }) => {
  await home(page);
  await command(page, "help");
  const examples = scrollback(page).locator("[data-cmd]");
  for (const cmd of await examples.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-cmd")!),
  ))
    expect(cmd).not.toMatch(/[<>\[\]|·]/);
  await scrollback(page)
    .getByRole("button", { name: "theme", exact: true })
    .click();
  await expect(scrollback(page)).not.toContainText("unknown theme");
});

test("hash commands use the latest shell context", async ({ page }) => {
  await home(page);
  await command(page, "cd project");
  await expect(page).toHaveURL(/#~\/project$/);
  await page.evaluate(() => {
    location.hash = "#run:pwd";
  });
  await expect(
    scrollback(page).getByText("/home/project", { exact: true }),
  ).toBeVisible();
});

test("editor help closes the reader and clears its stale URL", async ({
  page,
}) => {
  await home(page);
  await command(page, "vim ~/about.txt");
  await expect(reader(page)).toBeVisible();
  await expect(page).toHaveURL(/#vim:about\.txt$/);
  await page.getByRole("button", { name: "?: help", exact: true }).click();
  await expect(reader(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/#vim:/);
  await page.reload();
  await expect(reader(page)).toHaveCount(0);
});

test("global help works while reading and Space still activates buttons", async ({
  page,
}) => {
  await home(page);
  await command(page, "vim ~/about.txt");
  await expect(reader(page)).toBeVisible();
  const help = page.getByRole("button", { name: "help", exact: true }).last();
  await help.focus();
  await help.press("Space");
  await expect(reader(page)).toHaveCount(0);
  await expect(scrollback(page)).toContainText("available commands:");
});

test("IME Enter does not submit partially composed text", async ({ page }) => {
  await home(page);
  await input(page).fill("你好");
  await input(page).evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await expect(input(page)).toHaveValue("你好");
  await expect(scrollback(page)).not.toContainText("command not found");
});

test("a malformed hash is recoverable", async ({ page }) => {
  await page.goto("./#run:%E0%A4%A");
  await expect(input(page)).toBeVisible();
  await expect(scrollback(page)).toContainText("couldn't read that link");
  await command(page, "pwd");
  await expect(
    scrollback(page).getByText("/home", { exact: true }),
  ).toBeVisible();
});

test("a canonical project page has server-rendered content and metadata", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const url = new URL("projects/geospatial-mae/", baseURL!);
  await page.goto(url.href);
  await expect(reader(page)).toContainText("geospatial embeddings");
  await expect(page.locator("h1")).toHaveText("Geospatial Masked Autoencoders");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/projects\/geospatial-mae\/$/,
  );
  await context.close();
});

test("content loads on demand and long code does not overflow the page", async ({
  page,
}, info) => {
  await home(page);
  await page.route("**/content/home/about.txt.json", (route) =>
    route.fulfill({
      json: {
        lines: [
          { spans: [{ text: "# Fixture", tone: "blue", bold: true }] },
          {
            spans: [
              { text: "A paragraph for testing the reading view. ".repeat(15) },
            ],
          },
          { spans: [{ text: "```ts" }] },
          {
            spans: [
              {
                text: "const long = '" + "x".repeat(250) + "';",
                tone: "green",
              },
            ],
          },
          { spans: [{ text: "```" }] },
        ],
      },
    }),
  );
  await command(page, "vim ~/about.txt");
  await expect(reader(page)).toContainText("# Fixture");
  const code = page.getByRole("region", {
    name: "Code block starting at line 3",
    exact: true,
  });
  expect(
    await code.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("reader.png") });
});

test("file entries have canonical links without losing shell navigation", async ({
  page,
}) => {
  await page.goto("projects/");
  const file = scrollback(page).getByRole("link", {
    name: /^geospatial-mae\.md/,
  });
  await expect(file).toHaveAttribute("href", /\/projects\/geospatial-mae\/$/);
  await file.click();
  await expect(reader(page)).toContainText("Geospatial Masked Autoencoders");
  await expect(
    page.getByRole("link", { name: "permalink to this file" }),
  ).toHaveAttribute("href", /\/projects\/geospatial-mae\/$/);
});

test("sitemap contains real reader pages but no empty validation post", async ({
  request,
}) => {
  const sitemap = await request.get("sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/projects/geospatial-mae/");
  expect(xml).not.toContain("__empty");
  const robots = await request.get("robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("/content/");
});

test("private source material is not exported", async ({ request }) => {
  expect((await request.get("cv.md")).status()).toBe(404);
  const content = await request.get("content/home/about.txt.json");
  expect(content.ok()).toBe(true);
  expect(content.headers()["content-type"]).toContain("application/json");
  expect((await content.json()).lines.length).toBeGreaterThan(0);
});

test("meter percentages, fill and accessible values agree", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "Dashboard is intentionally hidden at phone width.",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await home(page);
  const meter = page.getByRole("meter", { name: "python", exact: true });
  const initial = await meter.getAttribute("aria-valuenow");
  await expect
    .poll(() => meter.getAttribute("aria-valuenow"))
    .not.toBe(initial);
  const matches = await meter.evaluate((element) => {
    const percent = element.getAttribute("aria-valuenow");
    const fill = element.querySelector<HTMLElement>(".meter-fill")!;
    return (
      fill.style.width === `${percent}%` &&
      element.textContent!.includes(`${percent}%`)
    );
  });
  expect(matches).toBe(true);
});

test("skills is a plain CV list and arrows recall commands without scrolling", async ({
  page,
}) => {
  await home(page);
  await command(page, "skills");
  await expect(scrollback(page)).toContainText("Frameworks & libraries:");
  await expect(scrollback(page)).toContainText("OpenTelemetry");
  await expect(scrollback(page)).not.toContainText("%");
  await expect(scrollback(page)).toContainText("↑/↓ = command history");
  await command(page, "echo latest-command");
  const top = await scrollback(page).evaluate((element) => element.scrollTop);
  await input(page).press("ArrowUp");
  await expect(input(page)).toHaveValue("echo latest-command");
  expect(await scrollback(page).evaluate((element) => element.scrollTop)).toBe(
    top,
  );
  await input(page).press("ArrowUp");
  await expect(input(page)).toHaveValue("skills");
  await input(page).press("ArrowDown");
  await expect(input(page)).toHaveValue("echo latest-command");
});

test("clear removes the command recall history and preserves the directory", async ({
  page,
}) => {
  await home(page);
  await command(page, "cd project");
  await command(page, "echo should-disappear");
  await command(page, "clear");
  await expect(scrollback(page)).not.toContainText("should-disappear");
  await input(page).press("ArrowUp");
  await expect(input(page)).toHaveValue("");
  await command(page, "pwd");
  await expect(
    scrollback(page).getByText("/home/project", { exact: true }),
  ).toBeVisible();
  await input(page).press("Control+l");
  await input(page).press("ArrowUp");
  await expect(input(page)).toHaveValue("");
});

test("mood and usage print frozen snapshots of the visible live meters", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "The comparison needs the visible dashboard.",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await home(page);
  await expect
    .poll(() =>
      page
        .getByRole("meter", { name: "energy", exact: true })
        .getAttribute("aria-valuenow"),
    )
    .not.toBe("80");
  for (const text of ["mood", "skills --usage"]) {
    await input(page).fill(text);
    const snapshot = await page.evaluate(() => {
      const values = Object.fromEntries(
        Array.from(document.querySelectorAll('[role="meter"]')).map(
          (element) => [
            element.getAttribute("aria-label")!,
            element.getAttribute("aria-valuenow")!,
          ],
        ),
      );
      document
        .querySelector("input")!
        .dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          }),
        );
      return values;
    });
    const label = text === "mood" ? "energy" : "python";
    const row = scrollback(page).getByText(
      new RegExp(`^${label}\\s+[█░]+\\s+${snapshot[label]}%$`),
    );
    await expect(row).toBeVisible();
    const printed = await row.textContent();
    await expect
      .poll(() =>
        page
          .getByRole("meter", { name: label, exact: true })
          .getAttribute("aria-valuenow"),
      )
      .not.toBe(snapshot[label]);
    expect(await row.textContent()).toBe(printed);
  }
});

test("dashboard folding persists and can be undone", async ({ page }, info) => {
  test.skip(
    info.project.name === "mobile",
    "Dashboard is intentionally hidden at phone width.",
  );
  await home(page);
  await page
    .getByRole("button", { name: "fold dashboard pane", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "dashboard" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "toggle dashboard pane", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: "toggle dashboard pane", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "dashboard" }),
  ).toBeVisible();
});
