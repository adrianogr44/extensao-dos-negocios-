# PostReels v2 — Session State

## Current status as of July 21, 2026

### ✅ Done

1. **Schema** — `Platform` enum (`INSTAGRAM`, `FACEBOOK`, `YOUTUBE`) added to Profile & Video. Unique constraint `@@unique([nicheId, platform, username])`. `prisma db push --accept-data-loss` applied. Client regenerated.
2. **Download API** — `/api/videos/download` route generalized from `download-instagram`. Accepts `platform`. Profile upsert uses compound key. Old `download-instagram/` directory removed.
3. **Extension types** — `Platform` type + `platform` on `DownloadTask` + `PendingDownload`. All in `src/lib/types.ts`.
4. **Extension downloader** — Sends `platform` in API request body (`src/lib/downloader.ts`).
5. **Extension manifest** — `wxt.config.ts` has host permissions for `facebook.com` and `youtube.com`.
6. **Facebook extraction** — `src/lib/facebook.ts`: reel detection, profile extraction.
7. **YouTube extraction** — `src/lib/youtube.ts`: shorts detection, profile extraction.
8. **Facebook content script** — `entrypoints/facebook.content.ts`: injects download button on FB Reels pages, sends `platform: 'FACEBOOK'`.
9. **YouTube content script** — `entrypoints/youtube.content.ts`: injects download button on YouTube Shorts/Channel pages, sends `platform: 'YOUTUBE'`.
10. **Content script naming fix** — Renamed from `facebook-content.ts` / `youtube-content.ts` to `facebook.content.ts` / `youtube.content.ts`. WXT requires the `.content.ts` suffix (not `-content.ts`) for named content scripts. Without this, the built JS files existed but were never injected — the manifest only registered the Instagram content script.
10. **Instagram content script** — `entrypoints/content.ts`: now sends `platform: 'INSTAGRAM'` in message payload.
11. **Background handler** — Extracts `platform` from message payload, passes through to tasks and download manager.
12. **Popup UI** — Shows platform badge (`IG`/`FB`/`YT`) on each download task row and pending download section.
13. **Frontend restructure** — New route hierarchy:
    - `/videos` → 3 platform cards (Instagram/Facebook/YouTube) with video counts
    - `/videos/[platform]` → Niches that have profiles on that platform
    - `/videos/[platform]/[nichoId]` → Profiles for that niche+platform with platform badge
    - Sidebar updated: "Vídeos" added (links to `/videos`), "Nichos" still available
14. **Platform badges everywhere** — Platform shown on:
    - Profile cards in nichos list (`nichos/page.tsx`)
    - Profile listing in niche detail (`nichos/[id]/page.tsx`)
    - Profile header in profile videos page (`nichos/[id]/perfil/[profileId]/page.tsx`)
15. **Both projects compile** — `tsc --noEmit` clean on dashboard, `wxt build` clean on extension (4 content scripts generated).

### ❌ Pending (LOW)

- **Migration** — Run `prisma migrate dev --name add_platform` to create a proper migration file (requires interactive or manual SQL).
- **System ffmpeg** — Install via `sudo apt-get install -y ffmpeg` for `drawtext` filter.
