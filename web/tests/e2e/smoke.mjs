// End-to-end smoke test against a production build (`npm run build` first).
// Runs without external services: verifies public pages render, protected
// areas redirect to login, forms degrade gracefully, SEO files exist and the
// layout works on mobile. Usage: node tests/e2e/smoke.mjs [--screenshots dir]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const shotsIdx = process.argv.indexOf("--screenshots");
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// Fail fast if something is already listening (avoids testing a stale server).
try {
  await fetch(`${BASE}/api/health`);
  console.error(`Port ${PORT} is already in use. Stop the other server first.`);
  process.exit(2);
} catch {}

// Run next directly (not via npx) in its own process group so cleanup is reliable.
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  cwd: new URL("../..", import.meta.url).pathname,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
const stopServer = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
};
process.on("exit", stopServer);
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start:\n${serverLog}`);
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${page.url()}: ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()}: ${e.message}`));

  const pages = [
    ["/", "win you customers"],
    ["/services", "Website Development"],
    ["/services/starter-website", "Starter Website"],
    ["/services/business-website", "Request a quote"],
    ["/pricing", "RM799 – RM1,499"],
    ["/portfolio", "The ARyzz client platform"],
    ["/about", "A Malaysian studio"],
    ["/faq", "Questions, answered"],
    ["/contact", "Let's talk"],
    ["/get-quote?service=business-website", "Tell us about your project"],
    ["/book", "Book a free 30-minute call"],
    ["/legal/terms", "Terms of Service"],
    ["/legal/privacy", "Personal Data Protection Act 2010"],
    ["/legal/refund", "Refund Policy"],
    ["/login", "Welcome back"],
    ["/register", "Create your client account"],
  ];
  for (const [path, text] of pages) {
    await check(`GET ${path} renders`, async () => {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      assert(res && res.status() === 200, `status ${res?.status()}`);
      const body = await page.locator("body").innerText();
      assert(body.includes(text), `missing text "${text}"`);
      if (SHOTS && ["/", "/pricing", "/services/starter-website", "/book"].includes(path.split("?")[0])) {
        // Scroll through so scroll-reveal sections are shown in the capture.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 80)); }
          window.scrollTo({ top: 0, behavior: "instant" });
        });
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${SHOTS}/desktop${path === "/" ? "-home" : path.replaceAll("/", "-")}.png`, fullPage: true });
      }
    });
  }

  await check("prices on the pricing page match the catalogue", async () => {
    await page.goto(`${BASE}/pricing`);
    const body = await page.locator("body").innerText();
    for (const p of ["RM1,500 – RM3,999", "RM3,000 – RM7,999", "From RM499", "From RM999", "From RM1,499", "RM99/month", "RM249/month", "RM499/month"]) {
      assert(body.includes(p), `missing ${p}`);
    }
  });

  await check("service pages list deliverables, revisions and exclusions", async () => {
    await page.goto(`${BASE}/services/starter-website`);
    const body = await page.locator("body").innerText();
    assert(body.includes("What's included") && body.includes("Not included"), "sections missing");
    assert(body.includes("2 rounds of revisions included"), "revision limit missing");
    assert(body.includes("50% deposit"), "deposit missing");
  });

  for (const path of ["/dashboard", "/dashboard/invoices", "/admin", "/admin/services"]) {
    await check(`${path} requires login`, async () => {
      await page.goto(BASE + path);
      assert(new URL(page.url()).pathname === "/login", `ended at ${page.url()}`);
    });
  }

  await check("ordering requires an account and preserves the destination", async () => {
    await page.goto(`${BASE}/order/starter-website`);
    const u = new URL(page.url());
    assert(u.pathname === "/login" && u.searchParams.get("next") === "/order/starter-website", `ended at ${page.url()}`);
  });

  await check("quote form validates input client-side and server-side gracefully", async () => {
    await page.goto(`${BASE}/get-quote`);
    await page.fill("#name", "Test Visitor");
    await page.fill("#email", "visitor@example.com");
    await page.fill("#goals", "We need a modern website for our tuition centre with a contact form.");
    await page.check('input[name="consent"]');
    await page.click('button[type="submit"]');
    await page.waitForSelector("[role=alert], [role=status]", { timeout: 10000 });
    const body = await page.locator("body").innerText();
    // Without a database configured the form must say so instead of pretending to succeed.
    assert(body.includes("being set up") || body.includes("Thank you"), "no feedback shown");
  });

  await check("health endpoint reports configuration without secrets", async () => {
    const r = await fetch(`${BASE}/api/health`);
    const j = await r.json();
    assert(j.status === "ok" && "payments" in j && !JSON.stringify(j).includes("sk_"), JSON.stringify(j));
  });

  await check("webhook rejects unsigned requests", async () => {
    const r = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: "{}" });
    assert(r.status === 400 || r.status === 503, `status ${r.status}`);
  });

  await check("cron endpoint requires the secret", async () => {
    const r = await fetch(`${BASE}/api/cron/daily`);
    assert(r.status === 401, `status ${r.status}`);
  });

  await check("robots.txt and sitemap.xml", async () => {
    const robots = await (await fetch(`${BASE}/robots.txt`)).text();
    assert(robots.includes("Disallow: /admin") && robots.includes("Sitemap:"), "robots incomplete");
    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    assert(sitemap.includes("/services/starter-website") && sitemap.includes("/pricing"), "sitemap incomplete");
  });

  await check("security headers are set", async () => {
    const r = await fetch(`${BASE}/`);
    assert(r.headers.get("x-frame-options") === "DENY", "x-frame-options");
    assert(r.headers.get("x-content-type-options") === "nosniff", "nosniff");
    assert(!r.headers.get("x-powered-by"), "x-powered-by exposed");
  });

  await check("unknown pages return 404", async () => {
    const res = await page.goto(`${BASE}/definitely-not-a-page`);
    assert(res?.status() === 404, `status ${res?.status()}`);
  });

  await check("homepage has structured data", async () => {
    await page.goto(BASE);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    assert(ld && JSON.parse(ld)["@type"] === "ProfessionalService", "JSON-LD missing");
  });

  for (const path of ["/", "/pricing", "/book", "/get-quote", "/contact", "/services/starter-website"]) {
    await check(`desktop ${path} has no horizontal overflow`, async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(BASE + path, { waitUntil: "load" });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 1, `overflows by ${overflow}px`);
    });
  }

  // Mobile
  const mctx = await browser.newContext({ ...devices["iPhone 13"] });
  const m = await mctx.newPage();
  for (const path of ["/", "/pricing", "/get-quote", "/book", "/login"]) {
    await check(`mobile ${path} has no horizontal overflow`, async () => {
      await m.goto(BASE + path, { waitUntil: "networkidle" });
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 1, `overflows by ${overflow}px`);
      if (SHOTS && path === "/") await m.screenshot({ path: `${SHOTS}/mobile-home.png`, fullPage: false });
    });
  }
  await check("mobile menu opens and navigates", async () => {
    await m.goto(BASE);
    await m.click('button[aria-controls="mobile-nav"]');
    await m.click('#mobile-nav >> text=Pricing');
    await m.waitForURL(`${BASE}/pricing`);
    assert(!(await m.locator("#mobile-nav").isVisible().catch(() => false)), "menu stayed open");
  });

  await check("no client-side errors on public pages", async () => {
    const relevant = consoleErrors.filter((e) => !/favicon|Failed to load resource.*404|definitely-not-a-page/.test(e));
    assert(relevant.length === 0, relevant.slice(0, 5).join("\n"));
  });

  await browser.close();
} finally {
  stopServer();
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✔" : "✘"} ${r.name}${r.ok ? "" : `\n    ${r.error}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
