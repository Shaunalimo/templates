# Form / Survey Starter

A 4-step survey form with progress bar, zod-validated submissions, JSON-file persistence on EFS, and an owner responses dashboard with first-run password setup and CSV export.

## What's inside

```
form/
  server.js                  # express + /api/submit + /admin
  lib/submissions.js         # JSON file store at lib/data/submissions.json
  lib/admin-config.js        # first-run admin password (scrypt), ADMIN_PASSWORD override
  routes/submit.js           # POST /api/submit (zod-validated)
  routes/admin.js            # /admin API: setup, verify, submissions (+summary), export.csv
  public/index.html          # 4-step form (about you, work, feedback, review)
  public/results.html        # thank-you screen
  public/app.js              # step state machine, validation, submit
  public/admin.html          # owner dashboard: setup / login / responses
  public/admin.js            # dashboard logic (stats, list, CSV export)
  public/styles.css          # design
```

## Start it locally

```bash
npm install
npm start
```

Open http://localhost:3000.

## Persistence

Submissions land in `lib/data/submissions.json` on the container's EFS-backed workspace — they survive restarts.

## Responses dashboard

Visit **`/admin`**. On first visit you set your own password — no env var, no shared secret. After that it's a normal login. You get summary stats (total responses, average rating, most-wanted features), an expandable list of every response, and one-click **CSV export**.

Prefer to pin the password in config instead? Set `ADMIN_PASSWORD` (VibeKit `/env`) and it takes over — the first-run screen is skipped.

## Ask the agent

- "Add a Slack webhook so I get pinged when someone submits."
- "Add a new question to the survey and show it in the responses dashboard + CSV." — extend the zod schema in `routes/submit.js`, the UI in `index.html`/`app.js`, and the detail view + CSV columns in `routes/admin.js`.
- "Email me a weekly digest of new responses." — when rendering submission values as HTML, run each through the `escapeHtml()` helper exported from `routes/admin.js` to prevent stored XSS.
