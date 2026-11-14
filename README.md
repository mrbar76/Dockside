# Dockside

One shared core for member-run boat clubs. Each club brings its own look.
First club: Mianus River Boat & Yacht Club. Built Nov 13, 2026 from Coding Plan v2.

## What is here

A web app that is also the club's public site and an installable phone icon.

Members
- This week: urgent notices, live tides, events, open seats, news, on one page
- Personal link that opens their week with no sign-in (read-only, no contact details)
- Calendar with sign-up, and a subscription feed for the phone's own calendar
- Crew and ride board: owners post seats, members raise a hand, the owner decides
- Directory and documents behind sign-in
- Sign-in with an emailed 6-digit code. Couples sharing an email each get a profile
- A choice of channel: email, text, phone-icon alerts, or nothing sent

Officers
- Post once: page, calendar, dock sheet and each member's channel
- Groups (Board, committees), urgent or weekly delivery, a log of what went out
- Sign up a member who phoned in (logged under the officer's name)
- Roster import from a spreadsheet, printable weekly sheet with a QR code

## One core, many looks

Nothing in `app/[club]` or `components` knows which club it is drawing.

| Level | What changes | Where |
| --- | --- | --- |
| 1. Tokens | Colors, typefaces, corner radius, burgee colors | `clubs.theme` in the database (`lib/core/theme.ts`) |
| 2. Skin | Layout treatment: mastheads, date blocks, notice styling | `app/skins.css`, one block per skin |
| 3. Custom | A wholly separate front end | reads `/api/v1/[club]/this-week` |

The demo seeds two clubs to prove it: `mrbyc` (skin `chart`) and the made-up
`harbor-point` (skin `signal`). A design change for one club is a data edit or
one CSS block. The core is untouched.

## Club separation

Every table except the club list and the sign-in tables carries `club_id`.
All club reads and writes go through `withClub()` in `lib/db/index.ts`, which
drops to a restricted database role and sets the club for that transaction.
Postgres row rules then refuse anything outside that club, whatever the query
says. `tests/core.test.ts` tries to read, change, delete and insert across
clubs and checks every table has the rule.

## Run it

Needs Node 22 and Postgres 16.

```
cp .env.example .env        # set DATABASE_URL and BETTER_AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed             # two demo clubs, made-up people
npm run dev                 # http://localhost:3000
```

Demo sign-ins (the code shows on screen in demo mode): `ada.brennan@example.com`
(officer), `hadleys@example.com` (two members, one address), `priya.raman@example.com`.
Personal link example: `/mrbyc/w/demo-mrbyc-priya`.

Checks
```
npm test                    # 22 tests incl. the cross-club leak test (needs a dockside_test database)
npm run build && npm start
node scripts/e2e.mjs        # 28 browser checks against the running app, saves screenshots to shots/
```

## Deploying on Railway (outline, not yet done)

1. New project, add a Postgres service, add this repo as a web service.
2. Variables: `DATABASE_URL` (from Postgres), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
   (the public address), `DEMO_MODE=false`, then the SMTP, VAPID and Twilio
   settings in `.env.example` as each channel is switched on.
3. Start command: `npm run db:migrate && npm start`.
4. Scheduled jobs: `npm run weekly` once a week, `scripts/backup.sh` nightly.
5. Custom club addresses: add the domain in Railway and set `CLUB_HOSTS`.

## Verified and not verified

Verified here: type check, lint, production build, 22 core tests, 28 browser
checks (sign-in, household profiles, event sign-up, capacity, crew board,
officer posting, delivery log, roster import, weekly sheet, two clubs kept apart).
Tides come live from NOAA station 8469549.

Written but not exercised against a real service: sending email (SMTP), phone
alerts on a real device, text messages, the backup script, the weekly job on a
schedule, custom domains through `proxy.ts`, anything on Railway.

Not built yet: editing or cancelling events and notices, managing roles and
groups on screen, document uploads to Cloudflare R2 (documents are links for
now), more public site pages than the home page, the talk-it-in posting helper,
request rate limits, an accessibility pass, and the later modules (work hours,
slips and wait list, dues).

## Layout

```
app/[club]/         pages, server actions, feed, manifest, icon routes
app/skins.css       one block per club skin
components/         shared interface pieces
lib/db/             schema, row rules, migrations runner, demo seed
lib/core/           data module, delivery, tides, calendar feed, roster, time
scripts/            weekly job, backup, browser checks
tests/              core tests
```
