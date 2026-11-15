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
  await page.$eval('input[name="email"]', (el) => el.form.requestSubmit());
  await until("is on its way");
  const code = /Your code is (\d{6})/.exec(await text())?.[1];
  if (!code) return false;
  await page.type('input[name="code"]', code);
  await page.$eval('input[name="code"]', (el) => el.form.requestSubmit());
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
await page.$eval('input[name="email"]', (el) => el.form.requestSubmit());
await until("is on its way");
await check("an address off the roster gets the same answer and no code", async () => !(await has("Your code is")));
await page.type('input[name="code"]', "000000");
await page.$eval('input[name="code"]', (el) => el.form.requestSubmit());
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
await check("owner accepts crew", () => until("Accepted. They have been told."));
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
await go("/mrbyc/this-week");
await check("this week names her next thing", () => has("Your next:"));
await go("/mrbyc/rides");
await clickText("I can't make it");
await check("a member can take back her hand", () => until("Your hand is down."));
await go("/mrbyc/me");
await page.$eval('input[name="boatName"]', (el) => (el.value = "Dinghy Dream"));
await clickText("Save my details");
await check("a member corrects her own details", async () => (await until("Saved.")) && (await page.$eval('input[name="boatName"]', (el) => el.value)) === "Dinghy Dream");
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

// Officer: change and cancel an event, fix a notice
const openPanel = (t) => page.evaluate((t) => { const d = [...document.querySelectorAll("details")].find((x) => x.querySelector("summary").textContent.includes(t)); if (d) d.open = true; return !!d; }, t);
const inPanel = (t, sel) => page.evaluateHandle((t, sel) => [...document.querySelectorAll("details")].find((x) => x.querySelector("summary").textContent.includes(t)).querySelector(sel), t, sel);
await go("/mrbyc/calendar");
await page.evaluate(() => [...document.querySelectorAll("a.event")].find((a) => a.textContent.includes("Chili cook-off")).click());
await until("Change or cancel this event");
await openPanel("Change or cancel");
await page.$eval('details input[name="location"]', (el) => (el.value = "Clubhouse porch"));
await clickText("Save changes");
await check("officer edits an event", async () => (await until("Event saved")) && (await has("Clubhouse porch")));
await openPanel("Change or cancel");
await page.type('input[name="reason"]', "Gale warning.");
await clickText("Cancel the event");
await check("officer cancels and the sign-ups are told", async () => (await until("who signed up were told")) && (await has("Cancelled: Chili cook-off")));
await openPanel("Change or cancel");
await clickText("Put the event back on");
await check("officer puts it back on", () => until("The event is back on."));
await go("/mrbyc/news");
await openPanel("Fuel dock closed today");
await (await inPanel("Fuel dock closed today", 'input[name="title"]')).evaluate((el) => (el.value = "Fuel dock open again"));
await (await inPanel("Fuel dock closed today", "button.btn.go")).click();
await check("officer fixes a notice", async () => (await until("Notice saved")) && (await has("Fuel dock open again")));
await openPanel("Fuel dock open again");
await (await inPanel("Fuel dock open again", "button.btn.quiet")).click();
await check("officer removes a notice", async () => (await until("Notice removed.")) && !(await has("Fuel dock open again")));

// Officer: members, roles, groups
await go("/mrbyc/officers/groups");
await page.type('input[placeholder="Race committee"]', "Race committee");
await clickText("Add group");
await check("officer adds a group", () => until("Race committee added"));
await go("/mrbyc/officers/members/new");
await page.type('input[name="firstName"]', "Lena");
await page.type('input[name="lastName"]', "Ostrova");
await page.type('input[name="email"]', "lena.ostrova@example.com");
await page.evaluate(() => [...document.querySelectorAll("label.check")].find((l) => l.textContent.includes("Race committee")).querySelector("input").click());
await clickText("Add to roster");
await check("officer adds a member straight onto a group", () => until("Lena is on the roster."));
await go("/mrbyc/officers/groups");
await check("the group lists her", () => has("Lena Ostrova"));
await go("/mrbyc/officers/roster");
await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent === "Ada Brennan").click());
await until("Access");
await page.select('select[name="role"]', "member");
await clickText("Save");
await check("an officer cannot take away her own officer access", () => until("Ask another officer"));

// Officer: documents, club pages, data
fs.writeFileSync("/tmp/e2e-rates.pdf", "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
await go("/mrbyc/documents");
await page.type('input[name="title"]', "2027 slip rates");
await page.type('input[name="category"]', "Rules");
await (await page.$('input[name="file"]')).uploadFile("/tmp/e2e-rates.pdf");
await clickText("Add document");
await check("officer uploads a document", () => until("2027 slip rates is up."));
const docHref = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent === "2027 slip rates")?.getAttribute("href"));
const docRes = await page.evaluate(async (h) => { const r = await fetch(h); return `${r.status} ${r.headers.get("content-type")}`; }, docHref);
await check("the uploaded file opens for a member", docRes === "200 application/pdf");
const dead = await page.evaluate(() => [...document.querySelectorAll("main a")].filter((a) => a.getAttribute("href") === "#").length);
await check("no document link is a dead end", dead === 0);
await go("/mrbyc/officers/site");
await page.$eval('details[open] textarea[name="body"]', (el) => (el.value = "Welcome aboard.\n\nRacing Thursdays all summer."));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
fs.writeFileSync("/tmp/e2e-photo.png", png);
await (await page.$('details[open] input[name="photo"]')).uploadFile("/tmp/e2e-photo.png");
await page.evaluate(() => document.querySelector("details[open] button.btn.go").click());
await check("officer saves the front page with a photo", () => until("Page saved"));
await go("/mrbyc");
await check("front page shows the welcome, photo, join and contact", async () => (await has("Racing Thursdays")) && (await page.$(".home-photo img")) !== null && (await has("How to join")) && (await has("Contact")));
await go("/mrbyc/officers/site");
await openPanel("About");
await (await inPanel("About", 'textarea[name="body"]')).evaluate((el) => (el.value = "Founded on the Mianus River. Members of all ages."));
await (await inPanel("About", "button.btn.go")).click();
await until("Page saved");
await go("/mrbyc/about");
await check("officer edits the About page", () => has("Founded on the Mianus River"));
for (const k of ["join", "contact", "privacy"]) { await go(`/mrbyc/${k}`); await check(`${k} page has content`, async () => (await text()).length > 400); }
const csv = await page.evaluate(async () => { const r = await fetch("/mrbyc/officers/export/members.csv"); return { s: r.status, t: await r.text() }; });
await check("officer downloads the roster without secret links", csv.s === 200 && csv.t.includes("firstName") && !csv.t.includes("demo-mrbyc"));
const all = await page.evaluate(async () => { const r = await fetch("/mrbyc/officers/export/everything.json"); return r.ok ? Object.keys(await r.json()).length : 0; });
await check("officer downloads everything as one file", all >= 15);

await page.setViewport(phone);
await signOut("mrbyc");
await check("members-only file is closed when signed out", async () => (await page.evaluate(async (h) => (await fetch(h, { cache: "no-store" })).status, docHref)) === 401);
await check("data downloads are closed when signed out", async () => (await page.evaluate(async () => (await fetch("/mrbyc/officers/export/members.csv")).status)) === 403);

// Page weight on a phone: the dock QR code page should load fast on one bar.
await go("/mrbyc/this-week");
const kb = await page.evaluate(() => Math.round(performance.getEntriesByType("resource").concat(performance.getEntriesByType("navigation")).reduce((n, e) => n + (e.transferSize || e.encodedBodySize || 0), 0) / 1024));
await check(`this week weighs under 600 KB on a phone (${kb} KB)`, kb < 600);
const small = await page.evaluate(() => [...document.querySelectorAll("main a, main button, main input, main select, .tabs a, .foot a")].filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height && (r.height < 24 || r.width < 24) && getComputedStyle(el).display !== "inline"; }).length);
await check(`no tap target under 24 px (${small})`, small === 0);

// Membership application, end to end: online form, sponsor, three sign-offs
await go("/mrbyc/join");
await check("joining page shows the real rules and an online form", async () => (await has("Apply online")) && (await has("$465")) && (await has("Town of Greenwich")));
await clickText("Apply online");
await until("Apply to join");
const fill = async (n, v) => page.type(`input[name="${n}"]`, v);
await fill("firstName", "Marco"); await fill("lastName", "Vitale"); await fill("email", "marco.vitale@example.com");
await fill("phone", "203-555-0199"); await fill("address", "12 River Road"); await fill("zip", "06807");
await fill("spouseName", "Nina Vitale"); await fill("boatName", "Osprey"); await fill("boatType", "Sail"); await fill("boatLength", "22");
await fill("sponsorName", "Priya Raman"); await fill("sponsorEmail", "priya.raman@example.com");
await page.evaluate(() => [...document.querySelectorAll('input[name="interests"]')].slice(0, 2).forEach((c) => (c.checked = true)));
await (await page.$('input[name="proofs"]')).uploadFile("/tmp/e2e-photo.png", "/tmp/e2e-rates.pdf");
await page.waitForFunction(() => document.querySelector('input[name="proofs"]').files.length === 2);
await page.click('input[name="residency"]');
await page.$eval('input[name="firstName"]', (el) => el.form.requestSubmit());
await check("a neighbour applies online with two proofs", () => until("Your application is in"));
const statusPath = new URL(page.url()).pathname;
await check("the status page shows what is still missing", () => has("Waiting on your sponsor's sign-off and your check"));
await check("the applicant is told how to pay", () => has("Mail a check for $465 payable to MRBYC"));
await go("/mrbyc/officers/applications");
await check("the queue is closed to the public", () => has("Sign in"));
await signIn("mrbyc", "elena.soto@example.com");
await go("/mrbyc/officers/applications");
await check("the Membership Governor sees the new application", () => has("Marco Vitale"));
await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent === "Marco Vitale").click());
await until("Proofs of residency");
const appPath = new URL(page.url()).pathname, appId = appPath.split("/").pop();
const proofHref = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent === "Proof 1").getAttribute("href"));
await check("officers can open the proofs", async () => (await page.evaluate(async (h) => (await fetch(h, { cache: "no-store" })).status, proofHref)) === 200);
await go("/mrbyc/officers");
await check("the governor was told", () => has("New membership application"));
await signOut("mrbyc");
await signIn("mrbyc", "priya.raman@example.com");
await check("a member cannot open the proofs", async () => (await page.evaluate(async (h) => (await fetch(h, { cache: "no-store" })).status, proofHref)) === 403);
await go(`/mrbyc/join/sponsor/${appId}`);
await clickText("I sponsor Marco");
await check("the sponsor signs off online", () => until("You are on record as sponsor"));
await signOut("mrbyc");
await signIn("mrbyc", "elena.soto@example.com");
await go(appPath);
await check("the officer sees the sponsor sign-off", () => has("Sponsor: Priya Raman, signed off online"));
await page.click('input[name="paid"]');
await page.type('input[name="paymentNote"]', "Check 1043");
await clickText("Save");
await until("Saved.");
await clickText("Membership Committee approved");
await check("committee sign-off is recorded and the applicant told", () => until("Membership Committee recorded"));
await clickText("Board of Governors approved");
await until("Board of Governors recorded");
await clickText("Voted in: make a member");
await check("the vote makes Marco and Nina members", () => until("Marco is a member"));
await go("/mrbyc/officers/roster");
await check("both are on the roster", async () => (await has("Marco Vitale")) && (await has("Nina Vitale")));
await check("proofs are deleted once decided", async () => (await page.evaluate(async (h) => (await fetch(h, { cache: "no-store" })).status, proofHref)) === 404);
await go(statusPath);
await check("the applicant's page says welcome", () => has("Welcome aboard"));
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
  await page.$eval('input[name="email"]', (el) => el.form.requestSubmit());
  await until("is on its way");
  return !(await has("Your code is"));
});

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
