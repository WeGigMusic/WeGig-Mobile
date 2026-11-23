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

The checked source baseline is `5b5c92d` on `feature/support-wegig`. Use the iOS `production` EAS profile for the consolidated TestFlight build. The generated configuration uses bundle ID `com.wegig.mobile`, version 1.0.0, remote build numbering with auto-increment, and optional analytics enabled subject to consent. Photo-library usage is present, with camera and microphone usage descriptions absent. Verify the actual build number and source commit in EAS before device testing.

The source contains in-app account deletion, the offline analytics withdrawal fix and its refresh regression test, updated location and analytics privacy wording, and calendar failure feedback. The iOS JavaScript export passed on app source `3c32948`. The later test-only commit `5b5c92d` passed all 41 mobile tests.

### Additional pre-build checks

- Forced a 502 in the screen's artist request and verified that the existing manual form submitted the typed artist. A separate authenticated local API test saved and reloaded a gig without a MusicBrainz ID using PostgreSQL.
- Verified that a delayed consent response from a previous account cannot re-enable analytics after switching accounts.
- Verified that the local API returns the expected cancellation, pending and temporary failure codes with simulated Google responses and creates no support purchase for them. The mobile tests confirmed that only cancellation clears the payment block. Physical Google Play sandbox testing is still pending.

### TestFlight validation

1. Check offline analytics withdrawal first. Opt in, go offline, switch analytics off and note the withdrawal time. Reconnect with WeGig open and confirm the switch stays off. Verify the saved Supabase preference and compare PostHog event timestamps with the withdrawal time.
2. Check account switching with a separate test account if available. Each account should retain its own choice. Review the analytics payload from an opted-in session against the draft declarations.
3. Check the changed calendar failure message only if the calendar write can be made to fail safely. The ordinary creation flow already passed on Android.
4. Recheck the contribution currency when reviewing Apple support case 103020803539. Keep Google cancellation testing on the next Play internal build.

### App Review notes for the eventual submission

For Guideline 5.1.1(v), users can permanently delete their account from Profile → Delete account in WeGig. The physical iPhone recording showing sign-in, navigation and deletion confirmation was sent in the App Review reply dated 21 November. Reference that existing recording in App Review Information → Notes when submitting the selected build.

Privacy declarations remain provisional until provider retention and sharing, live SDK payload fields and the unsigned DPIA are reconciled.

### Production artist search smoke check

Radiohead and Portishead returned matching results, and Blur returned HTTP 502. Earlier production checks saw Radiohead return both 200 and 502. The live API already spaces requests and retries upstream 429 and 503 responses. These samples show intermittent availability across searches. The exact upstream cause is unconfirmed. Add Gig now tells users they can save the typed artist and offers a retry. A forced 502 check against the screen handlers verified that manual entry submits successfully without a MusicBrainz ID.


## 23 November launch triage

- Account deletion: previously passed on disposable account; no repeat requested. Apple acceptance remains pending.
- iOS opt-in and withdrawal: user confirmed foreground consent on/off checks passed; observed PostHog positive control. Offline withdrawal and account switching on iOS remain separate device checks.
- Apple privacy and Google Data Safety updated by operator; verify final declarations, historical analytics handling and review status before publication.
- Profile menu changes committed through d0ab788; iOS TestFlight build queued by operator; visual smoke test pending.
- Static review: analytics account-keyed component, session checks, generation invalidation and abortable transport present. Mobile billing recovery and API product/account verification, transactional purchase deduplication, authenticated refund notifications and revocation handling present. Sandbox lifecycle validation remains open; no fresh automated tests run in this review.
- Ticket scanning: no active route in mobile App.tsx; API /ocr/ticket returns 404 unless TICKET_SCANNING_ENABLED is exactly true. Confirm deployed environment flag or live endpoint before closing.
- Age signals: isolated prototype branch, Android preview build 73215284-79ed-465b-9b03-322cc0e77aec queued; no native success or production integration verified. Determine jurisdictional applicability and required safeguards before release; do not merge unvalidated prototype.
- Dependency findings: defer incompatible SDK upgrades only after explicit residual-risk decision. No new exposure established by this review.
- No public rollout or production deployment authorised.


### Operator acceptance — 23 November

Operator confirms sufficient testing and accepts profile name/photo persistence across account switching, offline analytics withdrawal, and core discover/add/edit/rate gig flows as passed. Do not repeat these checks absent relevant changes or regressions. This supersedes outstanding repeat checks for those specific scenarios above; it does not independently establish analytics consent isolation across accounts. Contribution display remains USD; awaiting Apple support response (case 103020803539). Currency issue is not resolved. No new device tests performed by this reviewer.

- Ticket scanning configuration accepted 23 November: operator confirms TICKET_SCANNING_ENABLED is absent in Render; reviewed API defaults to HTTP 404. Close configuration check; live endpoint not independently probed.


## Residual dependency risk acceptance — 23 November 2026

Operator explicitly accepts the documented residual dependency risk for launch on Expo SDK 54, conditional on the reviewed exposure assumptions remaining valid and no new material vulnerability or exploit path being identified. This closes the launch risk-decision gate, not the underlying advisories. Reassess on the next controlled Expo SDK upgrade, or sooner if exposure changes. Avoid forced incompatible upgrades. No new dependency scan or tests performed for this acceptance.

- 23 November: operator confirms submission of revised Google Play location sharing declaration for review. Declaration update action complete; approval and applicable Google Maps contractual coverage remain unverified.

## Consolidated launch checklist — 23 November (supersedes earlier repeat-check instructions)

### Remaining release gates
- [ ] Determine applicable regional age obligations; validate prototype and required production safeguards, including optional analytics eligibility.
- [ ] Validate store-distributed contribution cancellation, recovery and refund lifecycle; alternatively obtain explicit approval to disable contributions pending validation.
- [ ] Resolve contribution currency display (Apple case 103020803539).
- [ ] Resolve Google Places contractual coverage and reconcile final store privacy categories/linkage and analytics search disclosures with shipped implementation. Disclosure submission is not contractual clearance.
- [ ] Update and approve existing DPIA; carry forward accepted test evidence and documented residual risks. Original DPIA not edited by this consolidation.
- [ ] Validate final binary provenance and changed functionality; confirm Apple review acceptance and Google production changes before controlled publication.
- [ ] Confirm public store URLs before publishing staged website.

### Completed or accepted
Core gig flows, disposable account deletion, offline withdrawal, profile persistence, ticket scanner disabled, compiled Android build 27 permissions and OkHttp, dependency residual-risk acceptance, staged website checks. Google Play location sharing amendment submitted; approval pending. Render Hobby retention configuration recorded in privacy review. Do not repeat accepted checks without relevant changes.

### Deferred / external
Operator deferred Places quota and quota-alert changes on 23 November. Existing WeGig monthly budget £100 with alerts at £25/50/75/100; no spending cap verified. Default high API quotas remain; financial exposure persists. API key restriction review deferred, not verified. Other follow-ups: HMRC VAT, historical PostHog deletion, upstream artist search reliability and controlled SDK upgrade. Escalate any material legal/security blocker rather than assuming acceptance. Both Android prototype and final iOS candidate builds reported in progress by operator.

### Launch scope freeze — operator decision, 23 November
Supersedes earlier administrative and exploratory gates: operator considers existing DPIA draft administratively complete and elects to retain the existing Google Places implementation, deferring further contractual clarification. This is not legal sign-off: UK/European backend forwarding contractual coverage and saved Places content restrictions remain unverified. Do not repeat exploratory reviews absent material new evidence; escalate confirmed material noncompliance. Existing Play sharing amendment remains submitted, not approved. Defer further quota optimisation, nonessential dependency upgrades, artist-search optimisation and documentation polish. Carry forward existing Apple privacy updates as operator-reported; reconcile material discrepancies arising from final release changes. Prioritise applicable age safeguards, payment lifecycle validation or explicit feature disablement, currency resolution or explicit feature disablement, final binary smoke checks and store approvals, then website publication. No public rollout authorised by this entry.
