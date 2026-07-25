import { chromium } from "playwright";
import { appendFileSync, writeFileSync } from "node:fs";

const base = "http://127.0.0.1:3001";
const defaultRoutes = [
  "/", "/login", "/dashboard", "/workspace", "/tree", "/weather", "/home-garden",
  "/agent", "/agent-pipeline", "/beauty", "/beauty/makeup", "/beauty/outfit", "/beauty/profile",
  "/chat", "/companion", "/decision", "/emotion", "/game", "/harmony", "/learning-path",
  "/memory", "/organizer", "/proactive", "/review", "/search", "/work", "/work/charts",
  "/work/images", "/work/literature", "/work/ppt"
];
const routes = process.env.ROUTES ? process.env.ROUTES.split(",").filter(Boolean) : defaultRoutes;
const outFile = process.env.OUT_FILE || "../ui-crawl-results.ndjson";

const skipPattern = /Open Next\.js Dev Tools|删除|退出|注销|上传|导入|提交|保存|发布|授权|扫码|下载|生成|开始|编译|创建|注册|登录|发送|清空|重置|移除|收获|浇水|施肥|拍照|录音|选择文件|file/i;
const maxClicksPerRoute = Number(process.env.MAX_CLICKS || 18);
writeFileSync(outFile, "");

let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
} catch {
  browser = await chromium.launch({ channel: "chrome", headless: true });
}
const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
const results = [];

page.on("dialog", async d => {
  results.push({ route: page.url().replace(base, ""), type: "dialog", message: d.message() });
  await d.dismiss().catch(() => {});
});

for (const route of routes) {
  const errors = [];
  page.removeAllListeners("console");
  page.on("console", msg => {
    if (["error", "warning"].includes(msg.type())) errors.push(`${msg.type()}: ${msg.text()}`.slice(0, 500));
  });

  try {
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.waitForTimeout(500);
    if (page.url().includes("/login") && route !== "/login") {
      const demo = page.getByText("使用演示账号", { exact: true });
      if (await demo.count()) {
        await demo.first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1800);
        await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }

    const initialUrl = page.url();
    const handles = await page.locator("button:not([disabled]), a[href], [role=button], input[type=button], input[type=submit]").evaluateAll(nodes => nodes.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.value || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("href") || "").trim().replace(/\s+/g, " ").slice(0, 80),
        href: el.getAttribute("href") || "",
        visible: rect.width > 2 && rect.height > 2 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none"
      };
    })).catch(() => []);

    let clicked = 0;
    const clickedItems = [];
    const skipped = [];
    for (const h of handles.filter(h => h.visible).slice(0, maxClicksPerRoute)) {
      if (skipPattern.test(h.text) || skipPattern.test(h.href) || /^https?:\/\//.test(h.href)) {
        skipped.push(h.text || h.href || h.tag);
        continue;
      }
      try {
        await page.goto(initialUrl, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(150);
        const candidates = page.locator("button:not([disabled]), a[href], [role=button], input[type=button], input[type=submit]");
        const count = await candidates.count();
        if (h.index >= count) continue;
        const target = candidates.nth(h.index);
        if (!(await target.isVisible().catch(() => false))) continue;
        await target.click({ timeout: 2200 });
        await page.waitForTimeout(250);
        clicked++;
        clickedItems.push(h.text || h.href || h.tag);
      } catch (e) {
        clickedItems.push(`FAILED: ${h.text || h.href || h.tag} :: ${String(e.message || e).slice(0, 160)}`);
      }
    }

    const routeResult = {
      route,
      finalUrl: page.url().replace(base, ""),
      controls: handles.filter(h => h.visible).length,
      clicked,
      skipped: skipped.slice(0, 30),
      clickedItems: clickedItems.slice(0, 50),
      errors: [...new Set(errors)].slice(0, 20)
    };
    results.push(routeResult);
    appendFileSync(outFile, JSON.stringify(routeResult) + "\n");
  } catch (e) {
    const routeResult = { route, fatal: String(e.message || e), errors };
    results.push(routeResult);
    appendFileSync(outFile, JSON.stringify(routeResult) + "\n");
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
