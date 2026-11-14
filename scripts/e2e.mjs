// End-to-end check in a real browser, against a running app seeded with demo
// data (npm run db:seed, npm run build, npm start). Also saves screenshots.
// Usage: node scripts/e2e.mjs [baseUrl]
import fs from "node:fs";
import puppeteer from "puppeteer-core";

fs.mkdirSync("shots", { recursive: true });

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
const phone = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desk = { width: 1280, height: 900, deviceScaleFactor: 1 };
let failed = 0;
const text = () => page.evaluate(() => document.body.innerText);
const check = async (name, cond) => { const ok = typeof cond === "function" ? await cond() : cond; console.log(`${ok ? "pass" : "FAIL"}  ${name}`); if (!ok) failed++; };
const has = async (s) => (await text()).includes(s);
const go = (path) => page.goto(base + path, { waitUntil: "networkidle0" });
const until = (s) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, s).then(() => true, () => false);
const shot = (name) => page.screenshot({ path: `shots/${name}.png`, fullPage: !page.viewport().isMobile });

async function signIn(slug, email) {
  await go(`/${slug}/sign-in`);
  await page.type('input[name="email"]', email);
  await page.click("button.btn.go");
  await until("is on its way");
  const code = /Your code is (\d{6})/.exec(await text())?.[1];
  if (!code) return false;
  await page.type('input[name="code"]', code);
  await page.click("button.btn.go");
  return until("Hello, ");
}
async function signOut(slug) {
  await go(`/${slug}/me`);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Sign out").click());
  await page.waitForFunction(() => document.body.innerText.includes("Sign in"), { timeout: 15000 });
}
const clickText = (t) => page.evaluate((t) => [...document.querySelectorAll("button, a")].find((b) => b.textContent.trim() === t)?.click(), t);

await page.setViewport(phone);

// Public and personal-link views
await go("/mrbyc/this-week");
await check("public this-week shows events and news", async () => (await has("Chili cook-off")) && (await has("Water shuts off")));
await check("public this-week hides ride details and group notices", async () => !(await has("Last sail before haul-out")) && !(await has("Float storage plan")));
await check("tide panel shows live NOAA data", () => has("water at"));
await shot("mrbyc-this-week-phone");
await go("/mrbyc/w/demo-mrbyc-priya");
await check("personal link greets the member with no sign-in", () => has("Hello, Priya"));
await check("personal link shows rides but no contact details", async () => (await has("Last sail before haul-out")) && !(await has("hadleys@")) && !(await has("okafor@")) && !(await has("+1203")));
await go("/harbor-point/w/demo-mrbyc-priya");
await check("one club's personal link does not open another club", () => has("That page is not here"));

// Sign-in guard rails
await go("/mrbyc/sign-in");
await page.type('input[name="email"]', "stranger@example.com");
await page.click("button.btn.go");
await until("is on its way");
await check("an address off the roster gets the same answer and no code", async () => !(await has("Your code is")));
await page.type('input[name="code"]', "000000");
await page.click("button.btn.go");
await check("a wrong code is refused", () => until("did not match"));

// A household sharing one email address
await check("sign in with an emailed code (household address)", () => signIn("mrbyc", "hadleys@example.com"));
await check("signed-in week greets June", () => has("Hello, June"));
await go("/mrbyc/calendar");
await page.evaluate(() => [...document.querySelectorAll("a.event")].find((a) => a.textContent.includes("Chili cook-off")).click());
await until("Change my sign-up");
await page.$eval('input[name="partySize"]', (el) => (el.value = "4"));
await page.click("button.btn.go");
await check("event sign-up saves", () => until("You are signed up"));
await check("headcount reflects the change (2+1+3 becomes 4+1+3)", () => has("8 going"));
await shot("mrbyc-event-phone");
await go("/mrbyc/rides");
await check("owner sees the raised hand with experience level", () => has("Priya Raman, new to boats"));
await clickText("Accept");
await check("owner accepts crew", () => until("Accepted. They can see it on the board."));
await shot("mrbyc-rides-phone");
await go("/mrbyc/me");
await check("household profile picker appears", () => has("Who is using this phone?"));
await shot("mrbyc-me-phone");
await clickText("Walt");
await check("switching profile works", () => page.waitForFunction(() => document.querySelector("h1")?.textContent === "Walt Hadley", { timeout: 15000 }).then(() => true, () => false));
await go("/mrbyc/officers");
await check("a member cannot open the officers page", async () => !(await has("Post a notice")));
await go("/mrbyc/calendar");
const feedHref = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("phone's calendar"))?.getAttribute("href"));
await check("calendar subscription link is offered", !!feedHref?.startsWith("webcal://"));
await signOut("mrbyc");

// Member without a boat sees her accepted seat
await signIn("mrbyc", "priya.raman@example.com");
await go("/mrbyc/rides");
await check("accepted member sees she is aboard", () => has("You are aboard"));
await signOut("mrbyc");

// Officer: post once
await check("officer signs in", () => signIn("mrbyc", "ada.brennan@example.com"));
await go("/mrbyc/officers");
await page.type('input[name="title"]', "Fuel dock closed today");
await page.type('textarea[name="body"]', "Pump repair until 4 pm.");
await page.click('input[name="urgent"]');
await page.click("button.btn.go");
await check("urgent notice goes to all 10 members by their channel", () => until("sent to 10 members"));
await check("delivery log shows text and email channels", async () => (await has("text")) && (await has("email")) && (await has("Logged (demo)")));
await page.setViewport(desk);
await go("/mrbyc/officers");
await shot("mrbyc-officers-desktop");
await go("/mrbyc/calendar");
await page.evaluate(() => [...document.querySelectorAll("a.event")].find((a) => a.textContent.includes("Dock work party")).click());
await until("Signing up for");
await page.select('select[name="memberId"]', await page.evaluate(() => [...document.querySelectorAll('select[name="memberId"] option')].find((o) => o.textContent === "Nora Feld").value));
await page.click("button.btn.go");
await check("officer signs up a member who phoned in", () => until("logged under your name"));
await go("/mrbyc/officers/roster");
await page.type('textarea[name="csv"]', 'first,last,email,phone,boat,boat type\nSam,Rivera,sam.rivera@example.com,203-555-0100,"Osprey, the second",sail\nNo,Email,,,,');
await clickText("Add to roster");
await check("roster import adds one and skips the bad row", () => until("1 added, 0 updated, 1 skipped"));
await go("/mrbyc/officers/sheet");
await check("weekly sheet has a QR code and the urgent notice", async () => (await page.$(".qr svg")) !== null && (await has("Fuel dock closed today")));
await shot("mrbyc-sheet-desktop");
await go("/mrbyc");
await shot("mrbyc-home-desktop");
await go("/mrbyc/this-week");
await shot("mrbyc-this-week-desktop");
await page.setViewport(phone);
await signOut("mrbyc");

// Second club, second look, same core
await go("/harbor-point/this-week");
await check("second club shows only its own events", async () => (await has("Frostbite series")) && !(await has("Chili cook-off")));
await shot("harbor-point-this-week-phone");
await page.setViewport(desk);
await go("/harbor-point");
await shot("harbor-point-home-desktop");
const skins = [];
for (const slug of ["mrbyc", "harbor-point"]) { await go(`/${slug}`); skins.push(await page.$eval(".club", (el) => `${el.dataset.skin}|${getComputedStyle(el).fontFamily}|${getComputedStyle(el).backgroundColor}`)); }
await check("the two clubs render with different skins and type", skins[0] !== skins[1] && skins[0].startsWith("chart") && skins[1].startsWith("signal"));
await check("a member of one club is not a member of the other", async () => {
  await page.setViewport(phone);
  await go("/harbor-point/sign-in");
  await page.type('input[name="email"]', "ada.brennan@example.com");
  await page.click("button.btn.go");
  await until("is on its way");
  return !(await has("Your code is"));
});

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
