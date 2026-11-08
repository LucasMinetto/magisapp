# Phase 4 Plan: PWA Deploy + QR Code Sync

## Context
Mobile app for Ordem Paranormal RPG players (PWA on GitHub Pages). Phase 1-3 complete: DB, hooks, all UI screens. Now need:
1. PWA deployment to GitHub Pages
2. QR Code sync pairing (HTTPS + WS + DuckDNS + QR + user/senha)

## Global Constraints
- **Stack**: Expo SDK 58, React Native, TypeScript, op-sqlite, Zustand, Zod, Fuse.js
- **Deploy**: GitHub Pages (static export via `expo export --platform web`)
- **Sync**: Local WiFi HTTPS + WebSocket, DuckDNS, QR code with credentials
- **Scope**: Player features only (no mestre/campaign editor)
- **Worktree**: `.worktrees/hermes-app-celular` (isolated from desktop)
- **Tests**: Must pass `npx vitest run` (19 tests), `npx tsc --noEmit` (0 errors core), `npx expo-doctor` (20/20)

## Tasks

### Task 1: PWA Configuration & GitHub Pages Deploy
**Files**: `app.json`, `app.config.ts`, `public/`, `.github/workflows/deploy.yml`, `package.json` scripts
**Requirements**:
- Configure `app.json` for PWA: `web.output: 'static'`, `web.build.babel.include: ['@expo/*', 'expo-*']`, icon/splash for PWA
- Add `expo-webpack-config` or use `expo export --platform web`
- Create GitHub Actions workflow (`.github/workflows/deploy.yml`) for auto-deploy on push to `hermes-app-celular` branch
- Configure `package.json` with `deploy` script: `expo export --platform web && npx gh-pages -d dist`
- Add `manifest.json` via Expo config (icons, name, short_name, start_url, display: standalone, background_color, theme_color)
- Configure service worker via `expo-pwa` or Workbox for offline-first
- Ensure `baseUrl` in router matches GitHub Pages repo name

**Acceptance**: `npm run deploy` produces `dist/` ready for GitHub Pages; workflow deploys on push; PWA installs on mobile.

### Task 2: QR Code Generation & Deep Linking
**Files**: `src/components/sync/QRCodeGenerator.tsx`, `app/campanha/sync/qr.tsx`, `src/hooks/useQRCode.ts`, `app/_layout.tsx` (deep link handling)
**Requirements**:
- Use `expo-barcode-scanner` for scanning, `qrcode.react` or similar for generating
- QR payload: JSON with `{ serverUrl, username, password, campaignId }` (base64 encoded)
- Generate QR on Sync screen when credentials configured
- Scan QR on Login/Setup screen to auto-fill credentials
- Deep link handler: `magistrado://sync?data=<base64>` → parse, validate, save to auth DB, navigate to Sync
- Handle app not installed: fallback to web page with instructions

**Acceptance**: Sync screen shows QR with credentials; scanning QR on another device fills credentials and connects.

### Task 3: Sync Protocol Implementation (Client)
**Files**: `src/sync/client.ts`, `src/hooks/useSync.ts`, `src/hooks/useSyncQueue.ts` (enhance)
**Requirements**:
- HTTPS + WebSocket client for local WiFi sync
- DuckDNS resolution: `https://<subdomain>.duckdns.org` → validate cert (self-signed OK for local)
- Sync flow: GET `/api/sync/status` → POST `/api/sync/push` (batch queue) → GET `/api/sync/pull` (changes since last sync)
- Conflict resolution: last-write-wins (timestamp), server authoritative for conflicts
- Retry with exponential backoff (max 3 retries)
- Background sync when app foregrounded
- Progress UI: pending/sending/synced/error counts (already in Sync screen)

**Acceptance**: Force push in Sync screen sends queue to desktop, pulls changes, updates local DB.

### Task 4: Integration Testing & Polish
**Files**: `__tests__/sync.test.ts`, `__tests__/qr.test.ts`, `__tests__/pwa.test.ts`
**Requirements**:
- Test QR generation/parsing roundtrip
- Test sync client with mock server (MSW)
- Test PWA manifest generation
- Test offline DB access (op-sqlite WASM)
- Verify all 19 existing tests still pass
- Run `expo-doctor`, `tsc`, `vitest` clean

**Acceptance**: All tests pass; manual sync test with desktop works.

## Technical Decisions (Rulings)
- **Ruling**: Use `expo export --platform web` (not `@expo/webpack-config`) for simpler static export
- **Ruling**: QR payload base64-encoded JSON for URL safety
- **Ruling**: Self-signed certs allowed for local sync (expo-dev-client handles this)
- **Ruling**: GitHub Pages deploy from `dist/` via `gh-pages` npm package
- **Ruling**: Deep link scheme `magistrado://` configured in `app.json` → `expo.scheme`

## Dependencies to Add
- `qrcode.react` (QR generation)
- `gh-pages` (deploy)
- `expo-pwa` or `workbox` (service worker) - optional, Expo handles basics