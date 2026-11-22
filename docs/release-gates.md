# Release gates — 22 November 2026

## Build baseline
- iOS build 24: EAS d9c385ea-8340-4e53-aafe-66d41cbbb1f2, installed via TestFlight and reproduced the offline withdrawal defect; it predates the fix.
- Android build 27 (1.0.0) is available through Google Play Internal testing. The supplied AAB verified version code 27, OkHttp and OkHttp URLConnection 4.12.1, and absence of the seven blocked permissions. Calendar permissions are present.
- Android build 27 passed photo selection, upcoming gig sharing, export, calendar, Discover city search, and offline analytics withdrawal. The switch stayed off on reconnect, Supabase showed consent version 1 saved as off, and the timestamped PostHog check found no events after withdrawal in the observed window.
- Account deletion passed with a disposable account. The physical iPhone recording was already sent in the App Review reply for Guideline 5.1.1(v). Carry the existing evidence into the next submission notes as requested by Apple. Apple acceptance is pending.
- Google cancellation recovery API PR #3 is merged and deployed as 097862b. Production health returned HTTP 200. Android build 27 predates the matching mobile handling and the calendar error-feedback change. Exercise cancellation on a matching Play-distributed build.

## Release blockers
- [x] Verify compiled Android permissions and resolved OkHttp version for build 27.
- [ ] Verify offline withdrawal on an iOS build containing the fix, account switching, and actual analytics payload fields. Android offline withdrawal passed on build 27.
- [x] Verify Android photo picker, sharing, export, calendar and Discover city search on build 27.
- [ ] Complete store-distributed sandbox billing lifecycle checks (see release-payment-validation.md).
- [ ] Resolve or document Apple currency issue and confirm correct production storefront display.
- [ ] Assess remaining dependency advisories, compatible updates and actual exposure; no automatic force upgrades or implicit risk acceptance.
- [ ] Finalise provider data handling, DPIA and store privacy answers (see store-privacy-review.md); historical analytics deletion remains separate.
- [ ] Await Apple acceptance of the account deletion response and reconcile Google pending changes with the final binary and staged rollout intent.
- [x] Validate mobile source through fecbadd. TypeScript, 39 automated tests, Expo Doctor 18/18, and local iOS and Android JavaScript exports passed on 22 November. Re-run affected checks if source changes before release.
- [ ] Verify final release binary provenance and smoke test changes since iOS build 24 and Android build 27.
- [x] Verify the staged website at mobile and desktop widths. Browser checks passed at 320, 390 and 1440 CSS pixels. The replacement QR points to the WeGig website.
- [ ] Confirm both public store listings before publishing the website branch. Both listing URLs returned HTTP 404 from the unauthenticated release check on 22 November. Google Play Internal testing remains available separately.

Ticket scanning remains future roadmap; no scanner feature testing required this cycle. Keep disabled. No public publication, production deployment, merge or risk sign-off implied by this checklist.

External administrative follow-ups: HMRC VAT correction, Apple currency support, historical PostHog records, MusicBrainz intermittent failures. Assess launch impact individually.


## Next TestFlight candidate

The checked source baseline is `a1915c2` on `feature/support-wegig`. Use the iOS `production` EAS profile for the consolidated TestFlight build. The generated configuration uses bundle ID `com.wegig.mobile`, version 1.0.0, remote build numbering with auto-increment, and optional analytics enabled subject to consent. Photo-library usage is present, with camera and microphone usage descriptions absent. Verify the actual build number and source commit in EAS before device testing.

The source contains in-app account deletion, the offline analytics withdrawal fix and its refresh regression test, updated location and analytics privacy wording, and calendar failure feedback. TypeScript and all 39 tests passed on this baseline.

### TestFlight validation

1. Check offline analytics withdrawal first. Opt in, go offline, switch analytics off and note the withdrawal time. Reconnect with WeGig open and confirm the switch stays off. Verify the saved Supabase preference and compare PostHog event timestamps with the withdrawal time.
2. Check account switching with a separate test account if available. Each account should retain its own choice. Review the analytics payload from an opted-in session against the draft declarations.
3. Check the changed calendar failure message only if the calendar write can be made to fail safely. The ordinary creation flow already passed on Android.
4. Recheck the contribution currency when reviewing Apple support case 103020803539. Keep Google cancellation testing on the next Play internal build.

### App Review notes for the eventual submission

For Guideline 5.1.1(v), users can permanently delete their account from Profile → Delete account in WeGig. The physical iPhone recording showing sign-in, navigation and deletion confirmation was sent in the App Review reply dated 21 November. Reference that existing recording in App Review Information → Notes when submitting the selected build.

Privacy declarations remain provisional until provider retention and sharing, live SDK payload fields and the unsigned DPIA are reconciled.

### Production artist search smoke check

Radiohead and Portishead returned matching results, and Blur returned HTTP 502. Earlier production checks saw Radiohead return both 200 and 502. The live API already spaces requests and retries upstream 429 and 503 responses. These samples show intermittent availability across searches. The exact upstream cause is unconfirmed. No mobile code change is planned for this candidate on that evidence.
