# Analytics launch review (22 November 2026)

Reviewed analytics.ts, AnalyticsPreference.tsx, AnalyticsConsent.tsx, App.tsx,
AuthScreen, ProfileScreen, GigsScreen, DiscoverScreen, StatsScreen and useSupportBilling.
This is a partial static inventory, not live verification.

Production flag false disables both SDK and consent UI. For consent-based launch,
set true only after controlled testing and compliance review; never fabricate consent.
Current SDK identifies account ID and optionally email. Assess removal of email and
update disclosures if changed. Keep replay, automatic lifecycle tracking, remote
configuration and surveys disabled pending assessment.

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
