# Store privacy review — 22 November 2026

Working assessment, not submitted declarations or legal sign-off.

## Location
Foreground device location is optional. After permission is granted, `src/lib/locationBias.ts` uses a recent cached fix or requests a balanced-accuracy fix, then rounds latitude and longitude to two decimals before callers receive them.

| Flow | Data and destination | Storage evidence |
| --- | --- | --- |
| City autocomplete | `CitySearchInput` sends search text and rounded device coordinates in the query to WeGig API `/places/cities/search`, with the session token if signed in. The API validates the coordinates and forwards them as a bias to Google Places. | No database write in this handler. Render access-log and Google request retention remain unverified. |
| Add Gig venue autocomplete | The mobile app sends search text, a Places session token and, when available, rounded device coordinates directly to Google Places. | No device-coordinate persistence found in this flow. Provider retention remains unverified. |
| Edit Gig venue autocomplete and saved gig | Edit Gig can bias Google Places search using the saved venue's coordinates. Venue details can be persisted with the gig. These coordinates describe the venue, not the device's current location. | The account's gig can contain precise venue coordinates as part of its saved content. |
| Sharing a gig | The app prepares a user-initiated share with event information, including the venue where applicable. | No device-location field found in the reviewed share flow. Keep Apple's separate Shared Location question open until the reviewer wording and intended scope are reconciled. |

No caller of the Mapbox reverse-geocoding helper was found in the reviewed mobile source. Check the actual release binary and provider configuration before making broader claims about collection.

### Provider evidence

Google Maps Platform documents request logging, including URLs, timestamps and requester IPs, with retention varying by purpose. It does not specify whether the Places Autocomplete POST body or its coordinate fields are retained, or give a Places-specific retention period. Keep the store assessment conservative until that is confirmed.

Render documents built-in public HTTP request logs on Pro workspaces and higher. Workspace log retention is 7 days on Hobby, 14 on Pro and 30 on Scale or Enterprise. Confirm the workspace tier and any log streams in the private settings. The API city handler does not persist the request or log its coordinates directly.

Provider sources: https://developers.google.com/maps/security/compliance/security-compliance and https://render.com/docs/logging.

**Apple working answer:** the rounded device coordinates fall within Apple's Coarse Location definition. Prepare Coarse Location for App Functionality as the conservative answer. A real-time-only exclusion would require evidence that neither WeGig nor a provider retains access to the coordinates. Linkage still needs evidence.

**Google Play working answer:** use Precise Location for the two-decimal device coordinates sent off-device. A 0.01° by 0.01° rounding cell is at most about 1.24 km², below Google's 3 km² threshold. Mark the feature optional and used for app functionality. Draft as collected and not processed ephemerally while coordinate retention is unconfirmed. Confirm the applicable provider terms before making the final sharing determination.

Platform definitions: https://developer.apple.com/app-store/app-privacy-details/ and https://support.google.com/googleplay/android-developer/answer/10787469.

## Analytics
Explicit events reviewed in App.tsx, AuthScreen.tsx, ProfileScreen.tsx, useSupportBilling.ts and analytics.ts: stats_viewed, profile_viewed, discover_viewed, gig_created, support_screen_viewed, password_recovery_opened, login_completed (method), sign_up_started, password_reset_requested, login_method_selected (provider), password_changed, logout_completed, support_purchase_completed (store), analytics_foreground_started. Identification uses account ID. No raw coordinates, search terms or email in these explicit payloads. The SDK app properties are limited in source to app version, build number and OS name. Actual transport and session metadata remain unverified. Authentication events before consent may not be delivered; foreground starts are not unique sessions. Session replay and geo-IP enrichment disabled in source. Verify live payloads and withdrawal before submission.

## Working declarations
Account email and identifier, saved gig content and transaction history: collected for app functionality (and applicable financial/fraud purposes). Optional usage and device analytics: consent-controlled, linked to account; confirm SDK fields and diagnostics. Location: optional functionality, transmitted as above; confirm platform classification. Profile name/photo stored locally in reviewed implementation; verify sharing/export paths. Ticket scanner not exposed in reviewed navigation; API gate defaults off, production variable reported absent. No advertising tracking identified in reviewed code; confirm all SDKs and providers. Verify encryption in transit, retention, deletion and processor settings. Do not claim no collection solely because data is not persisted.

## Release evidence needed
Final-binary permissions, live analytics payload fields, iOS consent behaviour, provider retention/logs, release-binary location verification, current store questionnaires, DPIA review, historical analytics deletion and residual dependency exposure. Website policy amendments staged separately; in-app consent wording updated. No store declaration submitted.

## Draft entries by store

| Data | Apple working entry | Google Play working entry |
| --- | --- | --- |
| Email and account ID | Email Address and User ID, linked, App Functionality | Email address and User IDs, collected for account management and app functionality |
| Saved gigs and notes | Other User Content, linked, App Functionality | Other user-generated content, collected for app functionality |
| Optional usage analytics | Product Interaction and User ID, linked, Analytics | App interactions and User IDs, optional, collected for analytics |
| Contributions | Purchase History, linked, App Functionality | Purchase history, collected for app functionality and fraud prevention as applicable |
| Device location | Coarse Location, App Functionality. Retention and linkage discussed above. | Precise Location, optional, collected for app functionality. Confirm sharing treatment. |

The profile name and photo are local in the reviewed app. Native share and export are user-initiated. Review the actually distributed versions and live analytics payloads before finalising the forms. Card details are handled by the stores. The location and SDK evidence above is still provisional.

## DPIA draft review

The 21 November draft remains unsigned. Update launch scope to remove dormant ticket import and Google ticket recognition, and distinguish local profile photos from any future gig-image uploads. Add the current Google Places and Render location flows, including the two different store classifications. Reflect successful disposable-account deletion testing and separately record retained transaction safeguards, historical PostHog deletion and the Android build 27 offline-withdrawal pass (switch, Supabase and PostHog) and the pending iOS check. Keep children's analytics consent, provider and transfer evidence, retention and final director approval open. Do not treat the provisional residual-risk ratings as approved.
