# Release gates — 22 November 2026

## Build baseline
- iOS build 24: EAS d9c385ea-8340-4e53-aafe-66d41cbbb1f2, installed via TestFlight and reproduced the offline withdrawal defect; it predates the fix.
- Android build 27 (1.0.0) is available through Google Play Internal testing. The supplied AAB verified version code 27, OkHttp and OkHttp URLConnection 4.12.1, and absence of the seven blocked permissions. Calendar permissions are present.
- Android build 27 passed photo selection, upcoming gig sharing, export, calendar, Discover city search, and offline analytics withdrawal. The switch stayed off on reconnect, Supabase showed consent version 1 saved as off, and the timestamped PostHog check found no events after withdrawal in the observed window.
- Account deletion passed with a disposable account. The physical iPhone recording was already sent in the App Review reply for Guideline 5.1.1(v). Carry the existing evidence into the next submission notes as requested by Apple. Apple acceptance is pending.
- The Google cancellation recovery change is in draft API PR #3 and the corresponding mobile handling is newer than build 27. Calendar error feedback is also newer than build 27.

## Release blockers
- [x] Verify compiled Android permissions and resolved OkHttp version for build 27.
- [ ] Verify offline withdrawal on an iOS build containing the fix, account switching, and actual analytics payload fields. Android offline withdrawal passed on build 27.
- [x] Verify Android photo picker, sharing, export, calendar and Discover city search on build 27.
- [ ] Complete store-distributed sandbox billing lifecycle checks (see release-payment-validation.md).
- [ ] Resolve or document Apple currency issue and confirm correct production storefront display.
- [ ] Assess remaining dependency advisories, compatible updates and actual exposure; no automatic force upgrades or implicit risk acceptance.
- [ ] Finalise provider data handling, DPIA and store privacy answers (see store-privacy-review.md); historical analytics deletion remains separate.
- [ ] Await Apple acceptance of the account deletion response and reconcile Google pending changes with the final binary and staged rollout intent.
- [ ] Validate final source commit with typecheck, regression tests and Expo Doctor; review diffs before merge.
- [ ] Verify final release binary provenance and smoke test changes since iOS build 24 and Android build 27.
- [ ] Confirm both public store listings and visually check the landing page on mobile and desktop before publishing the website branch. The replacement QR destination has been verified.

Ticket scanning remains future roadmap; no scanner feature testing required this cycle. Keep disabled. No public publication, production deployment, merge or risk sign-off implied by this checklist.

External administrative follow-ups: HMRC VAT correction, Apple currency support, historical PostHog records, MusicBrainz intermittent failures. Assess launch impact individually.
