import { chromium } from "playwright";

const base = "http://127.0.0.1:3001";
const routes = ["/dashboard","/tree","/weather","/home-garden","/beauty","/work","/learning-path","/agent-pipeline"];
let browser;
try { browser = await chromium.launch({ channel: "msedge", headless: true }); }
catch { browser = await chromium.launch({ channel: "chrome", headless: true }); }
const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
const results = [];

for (const route of routes) {
  const misses = [];
  page.removeAllListeners("response");
  page.on("response", response => {
    if (response.status() === 404) misses.push(response.url());
  });
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1200);
  results.push({ route, misses: [...new Set(misses)] });
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
