# Flynnstoned — Independent Website & Staff Dashboard

A new, independent implementation based on the Flynnstoned Airo export. The Airo website is NOT modified. The layout, homepage sections, and the 12 deals from `src/content/pages/home.json` are carried over. It does **not** preserve every Airo media asset because those images were not in the export.

## Features

- Public homepage, deals section, and event cards populated from **the same PostgreSQL database** as the calendar.
- Public `/calendar` page populated from the events records.
- Staff `/admin` login; create, edit, publish/unpublish, and delete events and deals.
- Start and end dates automatically control public visibility; optional featured flag makes an event appear first.
- Photo URLs, plus uploads when Cloudinary credentials are configured.
- First startup seeds the 12 deals from the GoDaddy content JSON. **Old calendar database records are not exported** and must be entered or migrated separately.

## Deployment (Render example)

1. Upload the **contents** of this folder to a **private GitHub repo**; do not upload `.env` or `node_modules`.
2. Create a managed PostgreSQL database (Render Postgres or another provider). Copy its connection URL.
3. Create a Render **Web Service** connected to the repository. Select Node runtime, `npm install` as build command and `npm start` as start command. Use Node 22+.
4. Set environment variables `DATABASE_URL`, `SESSION_SECRET` (random value 32+ characters), and `ADMIN_PASSWORD` (unique strong password). Configure `DATABASE_SSL=false` only if your PostgreSQL provider requires an unencrypted local connection.
5. Optional for images: set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Cloudinary usage must comply with its policies and your legal obligations. Alternatively paste an already-hosted photo's HTTPS URL.
6. Visit Render's test address, then `/admin`. Publish a sample event; confirm it appears on `/` and `/calendar`.
7. Do not switch the GoDaddy domain until functionality, content, security, and applicable cannabis advertising rules are reviewed.

## Limitations & security notes

- This project is independent and requires hosting, PostgreSQL, a staff password, and optional Cloudinary to be configured. It is **not deployed** by receiving this ZIP.
- A password-based admin login uses a signed HttpOnly cookie and basic IP-based login throttling, but the rate limit is in process-memory; before a public launch, add a reverse-proxy rate limit, individual user accounts/MFA if multiple staff need access, auditing, and security review. Serve via HTTPS (the cookie is Secure).
- Images in the original Airo media manifest are mostly references, not embedded image binaries. Most cards therefore use a simple fallback until photos are uploaded.
- Images, purchase offers, age gating, and signup flows must be evaluated for New York cannabis compliance. The VIP area is a static placeholder and does not collect emails yet. The original pumpkin contest submission system is not replicated.
- No integration with GoDaddy's existing event database. Events must be recreated or imported once.
- Run `npm install`, then `npm start` after setting env vars. API/database setup requires the PostgreSQL `CREATE TABLE` privilege at first start.
