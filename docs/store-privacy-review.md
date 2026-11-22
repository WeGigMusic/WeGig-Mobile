# Store privacy review — 22 November 2026

Working assessment, not submitted declarations or legal sign-off.

## Location
Reviewed src/lib/locationBias.ts obtains foreground permission, balanced accuracy or cached position, then rounds both coordinates to two decimal places. AddGigScreen and CitySearchInput transmit these rounded values for search bias. API src/index.ts /places/cities/search validates and forwards coordinates to searchCities; no direct database write in that handler. Approximate location is transmitted; precise location cannot be ruled out across other paths. Apple's and Google's definitions differ; two decimals do not alone establish Google's approximate-location threshold. Confirm provider, retention and all other paths before submission.

## Analytics
Explicit events reviewed in App.tsx, AuthScreen.tsx, ProfileScreen.tsx, useSupportBilling.ts and analytics.ts: stats_viewed, profile_viewed, discover_viewed, gig_created, support_screen_viewed, password_recovery_opened, login_completed (method), sign_up_started, password_reset_requested, login_method_selected (provider), password_changed, logout_completed, support_purchase_completed (store), analytics_foreground_started. Identification uses account ID. No raw coordinates, search terms or email in these explicit payloads. SDK automatic properties remain unverified. Authentication events before consent may not be delivered; foreground starts are not unique sessions. Session replay and geo-IP enrichment disabled in source. Verify live payloads and withdrawal before submission.

## Working declarations
Account email and identifier, saved gig content and transaction history: collected for app functionality (and applicable financial/fraud purposes). Optional usage and device analytics: consent-controlled, linked to account; confirm SDK fields and diagnostics. Location: optional functionality, transmitted as above; confirm platform classification. Profile name/photo stored locally in reviewed implementation; verify sharing/export paths. Ticket scanner not exposed in reviewed navigation; API gate defaults off, production variable reported absent. No advertising tracking identified in reviewed code; confirm all SDKs and providers. Verify encryption in transit, retention, deletion and processor settings. Do not claim no collection solely because data is not persisted.

## Release evidence needed
Compiled permissions, live analytics payloads and consent behavior, provider retention/logs, full location path inventory, current store questionnaires, DPIA review, historical analytics deletion and residual dependency exposure. Website policy amendments staged separately; in-app consent wording updated. No store declaration submitted.
