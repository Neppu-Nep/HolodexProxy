# Changelog

Notable user-visible changes per release. The userscript auto-updates from raw `main`, so each `vX.Y.Z` commit shipped immediately to users at the date listed.

## [Unreleased]

### Planned — 0.7.5 (fixes)
- Install the XHR interception before settings/cache load so early Holodex requests are not missed
- Escape user-provided values in the settings modal (safe against crafted imported settings files)
- Fix archive injection when Holodex returns an empty favorites video list
- Harden thumbnail replacement and YouTube field access; live viewer counts parsed as numbers
- Multi-instance coexistence guard (Stable vs Dev build)

### Planned — 0.8.0
- Stable Twitch placeholder IDs: a live stream keeps its identity across update cycles
- Batched live/upcoming status refresh — one YouTube API call per 50 IDs instead of one per channel (quota)
- Members-only playlist negative caching with periodic re-check (quota)
- `quotaExceeded` detection surfaced in the settings UI
- Cache schema versioning with a migration hook
- Auto-fill channel fields from pasted URLs / YouTube lookup; higher-resolution channel photos
- Settings UI: toast notifications, inline validation, per-channel last-updated/live status, keyboard support
- New menu commands: Pause Proxy, Copy Debug Info

## v0.7.4 (2026-09-04)
- Fixed Twitch live stream detection after changes to Twitch's page markup: the JSON-LD parser now handles both the old and new response formats and falls back gracefully for title/start time instead of failing.

## v0.7.3 (2026-02-04)
- Settings modal: the managed channels list is now paginated (10 per page) and can be sorted by name by clicking the "Name" column header.

## v0.7.2 (2026-02-04)
- Settings modal: added Export/Import buttons to save settings to (and restore from) a `holodex-proxy-settings.json` file.
- Settings modal: each channel now has a "Refresh" button that immediately force-refreshes that channel's details and video archive (YouTube channels only).
- Twitch-only channels now also appear on Holodex's favorites list, using data built from the config (previously a YouTube ID was required).

## v0.7.1 (2025-03-30)
- Minor layout fix for the settings modal (removed the fixed max width so it uses the full modal width); README rewritten to document the new settings UI and added Violentmonkey as a supported userscript manager.

## v0.7 (2025-03-30)
- New settings UI: a "Holodex Proxy Settings" modal (opened from the userscript manager menu) where you can set your YouTube API key and add/edit/delete channels (name, Twitter handle, thumbnail URL, YouTube ID, Twitch username) — no more editing the script source.
- Settings also expose the update intervals (live/upcoming checks in minutes, channel/archive refresh in hours) and an "update one channel at a time" toggle; saving applies immediately and triggers a refresh, and the first run forces an update.
- Configuration moved from hardcoded script variables into userscript-manager storage, so after upgrading you must re-enter your API key and channels in the new dialog (new default example channels included).
- Extensive error-handling rework in the API interception and YouTube/Twitch fetching: invalid/unparsable responses no longer break the page, API errors are logged and skipped, duplicate video IDs are filtered, and missing members-only/shorts playlists are treated as normal.

## v0.6.1 (2025-03-19)
- The XHR interceptor now only processes requests to holodex.net instead of hooking every request the page makes.

## v0.6 (2025-01-05)
- Script file renamed to `holodex-proxy.user.js` and `@updateURL`/`@downloadURL` metadata added, so userscript managers can now auto-update the script.
- Channel-data refresh now skips cleanly when no YouTube API key is configured instead of erroring.

## v0.5.2 (2024-09-13)
- Cached live/upcoming videos are now re-checked and cleaned (ended or vanished streams removed) on every channel-data refresh; full channel video re-crawls now happen at most once a week.
- Channels removed from your config are now deleted from the local cache.

## v0.5.1 (2024-08-13)
- Streams stored in the channel archive are updated with final data once they end, and stale live/upcoming entries that never started are removed from the cache.

## v0.5 (2024-06-06)
- Members-only YouTube streams (live/upcoming) are now fetched and shown alongside public ones.
- Channel archives are now crawled across all playlist types (videos, streams, members-only, shorts) and refreshed hourly one channel at a time, with channel details updated daily — instead of one weekly bulk fetch.
- Live/upcoming check interval raised from 5 to 10 minutes to conserve API quota; script now runs at `document-start` so interception works reliably from page load.
- Fixed parsing of Twitch's JSON-LD live data ("@graph" structure).

## v0.4.1 (2024-05-18)
- Reworked the update cycle so live/upcoming data and channel/archive data refresh on independent schedules instead of being tied together; channel details now also include banner/thumbnail fields for channel pages.

## v0.4 (2024-05-18)
- Custom channels now get working channel pages on Holodex: requests to Holodex's channel/video APIs for your channels are answered from a locally cached copy (channel info, stats, video lists), avoiding 404s.
- Past streams are now supported: your channels' recent uploads/VODs (with duration and end time) are merged into Holodex's video listings, while finished streams no longer show up in the live list.
- Channels with a YouTube ID now appear on Holodex's favorites page; channel data is cached in localStorage and refreshed weekly; optional per-channel Twitter handle added.

## v0.3 (2024-03-07)
- Initial release: a userscript that injects user-specified YouTube and Twitch channels into Holodex by intercepting its live/upcoming API responses and merging in your channels' streams.
- Channels are configured by editing the `ChannelInfos` list in the script; YouTube live/upcoming data requires your own YouTube Data API v3 key, while Twitch live status is scraped from the channel page (no key needed).
- Custom channel avatars replace Holodex's placeholder icons; channels appear under the "Independents" org.
- Data refreshes automatically every 5 minutes.
