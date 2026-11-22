# Launch dependency review — 22 November 2026

Local validation of dependency commit f00e097: TypeScript passed, 26 regression tests passed, Expo Doctor 18/18. Audit reduced from 37 findings to 20 (18 moderate, 2 high). Expo remains on SDK 54 (54.0.38).

## Remaining findings

- image-size 1.2.1 via Metro: high severity; patched 2.1.0 is outside Metro's declared range. Review compatible upstream updates.
- postcss 8.4.49 via Expo Metro config: high severity; patched 8.5.33 is outside declared range. Review upstream updates or a separately tested override.
- glob and minimatch: audit recommends a major Expo upgrade; do not apply force fixes blindly.
- uuid via Expo tooling: no compatible fix reported in the audit.

These findings are not proven harmless. Assess actual exposure, including build-time inputs, before release and obtain explicit release risk acceptance if unresolved. Keep SDK 54 for the current validation cycle; reassess supported upgrades separately.

## Native release gates

Permission commit 17cae60 blocks camera, microphone, broad storage/media and overlay permissions at configuration level. Verify merged Android manifest and profile photo selection, sharing, exports, calendar and location in a compiled build. Verify resolved OkHttp version. Ticket scanning is deferred; confirm it is inaccessible in release app and production API before finalising privacy declarations.

No production release or risk acceptance is implied by this document.

## Advisory research and proposed remediation

PostCSS 8.4.49 is affected by GHSA-r28c-9q8g-f849, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp and GHSA-qx2v-qp2m-jg93. Candidate 8.5.33 is outside Expo's declared range. Trial a scoped override in an isolated branch, regenerate lockfile and run clean install, audit, typecheck, regression tests, Expo Doctor and Metro export before adoption. Source: https://advisories.gitlab.com/npm/postcss/GHSA-r28c-9q8g-f849/ and https://npmscan.io/package/npm/postcss/8.4.49.

image-size 1.2.1 remains flagged for later parser DoS issues despite fixing the original GHSA-m5qc-5hw7-8vg7 range. Candidate 2.1.0 is a major API change from installed 1.x; inspect Metro usage before any override. Do not introduce an unreviewed fork. Upstream tracking: https://github.com/react/metro/issues/1762 and https://www.npmjs.com/package/image-size?activeTab=versions.

These dependencies are introduced via build tooling; no runtime exploit path established yet. Restrict build inputs to reviewed source/assets and trusted dependencies. This does not eliminate supply-chain risk. No override applied or risk accepted. Native OkHttp exact artifact availability and resolved version still require confirmation from Gradle/build evidence.
