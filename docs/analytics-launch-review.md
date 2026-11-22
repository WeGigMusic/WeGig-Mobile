# Analytics launch review (22 November 2026)

Reviewed analytics.ts, AnalyticsPreference.tsx, AnalyticsConsent.tsx, App.tsx,
AuthScreen, ProfileScreen, GigsScreen, DiscoverScreen, StatsScreen and useSupportBilling.
This is a partial static inventory, not live verification.

The preview and production EAS profiles make analytics available after account-level
opt-in. The SDK identifies opted-in users by account ID without providing email.
Replay, automatic lifecycle tracking, remote configuration and surveys are disabled.
The SDK app properties are limited to app version, build number and OS name.
Artist-page and setlist events record the interaction without artist, venue or date.
The SDK may attach its own transport and session metadata; confirm the actual payload
on a device before finalising the declarations.

Observed event calls: gig_created, stats_viewed, profile_viewed,
password_recovery_opened, login_completed, sign_up_started, password_changed,
logout_completed. Auth events before consent may be dropped; logout resets
immediately. Do not bypass the gate or buffer pre-consent events.

Proposed low-cardinality events after explicit consent: discover_viewed,
app_session_started, gig_search_completed (boolean result only), support_screen_viewed,
support_purchase_completed (only once verified). Avoid raw search terms, gig notes,
venue coordinates, payment tokens, email or error bodies. Do not add events until
nested component inventory and tests are complete.

UK PECR statistical exception: aggregate service-improvement statistics,
clear information and easy opt-out, no retained individual activity beyond
aggregation. Existing identified PostHog event history does not qualify by default.
EU national rules vary; retain opt-in globally until jurisdiction-specific assessment.
Sources:
https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications

Before release: verify no events before consent or after decline/withdrawal,
including offline withdrawal and account switching; verify allowed events arrive;
review retention, SDK network traffic and disclosures, including child users.
No production settings changed by this document.
