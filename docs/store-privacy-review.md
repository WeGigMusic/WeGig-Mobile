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

Google Maps Platform's standard terms §4.4 explicitly say Google receives coordinates, search terms and IP addresses and may retain and use them to provide and improve Google products and services. The terms incorporate controller-controller terms. Google's compliance page gives no Places-specific retention period. Treat the transfer as non-ephemeral and do not rely on the Play service-provider exception for Places under these terms. Verify the agreement applicable to WeGig's billing account and any exception before submission.

Section 4.4(c)(ii) also distinguishes information supplied directly by end users in the normal functioning of Maps from information supplied by the customer. It restricts sending European end-user personal data, including data of UK users. The WeGig API forwards device-derived coordinates. Treat that server-side flow as a contract question before public release. If it is not permitted under the applicable agreement, remove it and retain typed-city search. Rounding alone does not demonstrate anonymisation.

Render's DPA describes processing customer personal data under customer instructions. Treat Render hosting as service-provider processing for Google Play to the extent it acts on those instructions. Render documents built-in public HTTP request logs on Pro and higher, with workspace log retention of 7 days on Hobby, 14 on Pro and 30 on Scale or Enterprise. WeGig's tier and any log streams remain private configuration checks. The API handler has no database write or direct logging of those coordinates.

Provider sources: https://developers.google.com/maps/security/compliance/security-compliance https://cloud.google.com/maps-platform/terms, https://render.com/docs/logging and https://render.com/dpa.

**Apple working answer:** the rounded device coordinates fall within Apple's Coarse Location definition. Prepare Coarse Location for App Functionality as the conservative answer. A real-time-only exclusion would require evidence that neither WeGig nor a provider retains access to the coordinates. Linkage still needs evidence.

**Google Play working answer:** use Precise Location for the two-decimal device coordinates sent off-device. A 0.01° by 0.01° rounding cell is at most about 1.24 km², below Google's 3 km² threshold. Mark the feature optional and used for app functionality. Draft as collected, shared with Google Places, and not processed ephemerally under the standard terms. Revisit only if the final build removes the transfer or an applicable exception is substantiated.

Platform definitions: https://developer.apple.com/app-store/app-privacy-details/ and https://support.google.com/googleplay/android-developer/answer/10787469.

## Analytics
Optional analytics will be available at public launch and stays off until the user opts in. After sign-in, the app prompts accounts with no saved choice for the current consent version. The Profile switch lets the user change that choice later. Declining leaves the app usable.

Explicit events reviewed in App.tsx, AuthScreen.tsx, ProfileScreen.tsx, useSupportBilling.ts and analytics.ts: stats_viewed, profile_viewed, discover_viewed, gig_created, support_screen_viewed, password_recovery_opened, login_completed (method), sign_up_started, password_reset_requested, login_method_selected (provider), password_changed, logout_completed, support_purchase_completed (store), analytics_foreground_started. Identification uses account ID. No raw coordinates, search terms or email in these explicit payloads. The SDK app properties are limited in source to app version, build number and OS name. Actual transport and session metadata remain unverified. Authentication events before consent may not be delivered; foreground starts are not unique sessions. Session replay and geo-IP enrichment disabled in source. Verify live payloads and withdrawal before submission.

## Working declarations
Account email and identifier, saved gig content and transaction history: collected for app functionality (and applicable financial/fraud purposes). Optional usage and device analytics: consent-controlled, linked to account; confirm SDK fields and diagnostics. Location: optional functionality, transmitted as above; confirm platform classification. Profile name/photo stored locally in reviewed implementation; verify sharing/export paths. Ticket scanner not exposed in reviewed navigation; API gate defaults off, production variable reported absent. No advertising tracking identified in reviewed code; confirm all SDKs and providers. Verify encryption in transit, retention, deletion and processor settings. Do not claim no collection solely because data is not persisted.

## Draft entries by store

| Data | Apple working entry | Google Play working entry |
| --- | --- | --- |
| Email and account ID | Email Address and User ID, linked, App Functionality | Email address and User IDs, collected for account management and app functionality |
| Saved gigs and notes | Other User Content, linked, App Functionality | Other user-generated content, collected for app functionality |
| Optional usage analytics | Product Interaction and User ID, linked, Analytics | App interactions and User IDs, optional, collected for analytics |
| Contributions | Purchase History, linked, App Functionality | Purchase history, collected for app functionality and fraud prevention as applicable |
| Device location | Coarse Location, App Functionality. Retention and linkage discussed above. | Precise Location, optional, collected and shared with Google Places, non-ephemeral, for app functionality in the current draft. |

The profile name and photo are local in the reviewed app. Native share and export are user-initiated. Review the actually distributed versions and live analytics payloads before finalising the forms. Card details are handled by the stores. The location and SDK evidence above is still provisional.

## Children's consent for optional analytics

Scope checked here is the UK, EU and US. Earlier broad availability selections do not establish the final territories. Other markets and state-specific requirements remain subject to a targeted review of the actual list.

- UK: Article 8 uses age 13 when relying on consent for an online service offered directly to children. Below it, verified parental authorisation is required where Article 8 applies. Assess proportionate age assurance for relying on children's own consent. Applying the Children's Code protections broadly does not replace the consent-age assessment.
- EU: Article 8 defaults to 16 and Member States can lower their threshold to no less than 13. A single 13+ term does not cover all EU markets. A verified 16+ eligibility floor for optional analytics can simplify the Article 8 implementation while preserving access to core app features. It does not resolve all local requirements.
- US: COPPA generally covers services directed to children under 13 and general-audience services with actual knowledge that they collect personal information from under-13s. If covered, obtain verifiable parental consent where required, or keep the relevant processing off. Check launch-state rules separately. Do not assume the account-linked PostHog implementation qualifies for an internal-operations exception.
- Implementation implication: the current Allow prompt alone does not establish age eligibility. Keep optional analytics available at launch for eligible users. If required in the selected launch markets, put eligibility checks ahead of both the first-sign-in prompt and the Profile opt-in, leaving unknown or ineligible accounts off and core features usable. Do not collect a full date of birth by default. Platform age signals have limited availability and need an unknown-signal path.

Sources: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/, https://eur-lex.europa.eu/eli/reg/2016/679/oj, https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions, https://developer.apple.com/support/age-assurance/ and https://developer.android.com/distribute/age-appropriate-experiences/regional-protections.

## Minimum privacy work before public release

- Match the public privacy policy and both store declarations to the final release configuration and applicable distributed versions. Existing policy, in-app deletion and the physical iPhone App Review recording are in place. Carry forward that evidence.
- Confirm Google Maps contractual coverage for the location forwarding and Render workspace tier and log streams. The draft assumes Places can retain the data and treats it as shared. Confirm Apple linkage and the final analytics payload against the shipped build.
- Optional account-linked analytics is in launch scope. Resolve the existing children's consent and regional launch questions, verify the final iOS withdrawal flow and actual SDK payload, and reflect the feature in both declarations.
- Record approval and any unresolved risks in the existing DPIA. Confirm that its launch scope reflects the dormant scanner and local-only profile photo. Carry forward the completed Android build 27 offline withdrawal and disposable-account deletion evidence. An outstanding historical deletion request stays in its own follow-up, unless the DPIA identifies it as a launch dependency.

Store listings, provider settings and the 21 November DPIA document were not changed by this review.

References: https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy/, https://support.google.com/googleplay/android-developer/answer/10787469, and https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/how-do-we-do-a-dpia/.
