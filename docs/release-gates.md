# Release gates — 22 November 2026

## Build baseline
- iOS build 24: EAS d9c385ea-8340-4e53-aafe-66d41cbbb1f2, uploaded to App Store Connect; processing/test results pending.
- Android preview: EAS 6488091b-bc3e-4c69-8f26-5dfbca56ef1f; four public configuration variables loaded, analytics enabled subject to consent; compilation pending when recorded.
- In-app privacy wording commit 9efa045 is newer than these builds; include in final candidate. Documentation-only commits do not require rebuilds.

## Release blockers
- [ ] Verify compiled Android permissions and resolved OkHttp version.
- [ ] Verify analytics consent, withdrawal, offline sync, account switching and actual payloads.
- [ ] Verify photo picker, sharing, export, calendar and location on affected builds.
- [ ] Complete store-distributed sandbox billing lifecycle checks (see release-payment-validation.md).
- [ ] Resolve or document Apple currency issue and confirm correct production storefront display.
- [ ] Assess remaining dependency advisories, compatible updates and actual exposure; no automatic force upgrades or implicit risk acceptance.
- [ ] Finalise provider data handling, DPIA and store privacy answers (see store-privacy-review.md); historical analytics deletion remains separate.
- [ ] Address Apple review feedback and reconcile Google pending changes with final binary and staged rollout intent.
- [ ] Validate final source commit with typecheck, regression tests and Expo Doctor; review diffs before merge.
- [ ] Verify final release binary provenance and smoke test changes since build 24/Android preview.
- [ ] Confirm both public store listings, QR destination and landing page on mobile/desktop before publishing website branch launch/store-links in WeGig-Landing.

Ticket scanning remains future roadmap; no scanner feature testing required this cycle. Keep disabled. No public publication, production deployment, merge or risk sign-off implied by this checklist.

External administrative follow-ups: HMRC VAT correction, Apple currency support, historical PostHog records, MusicBrainz intermittent failures. Assess launch impact individually.
