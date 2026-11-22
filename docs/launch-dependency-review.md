# Launch dependency review — 22 November 2026

Local validation of dependency commit f00e097: TypeScript passed, 26 regression tests passed, Expo Doctor 18/18. The latest lockfile audit reports 19 findings (18 moderate, 1 high), down from 37. The tested PostCSS 8.5.33 override is now in the lockfile. Expo remains on SDK 54 (54.0.38).

## Remaining findings

- image-size 1.2.1 via Metro: high severity; patched 2.1.0 is outside Metro's declared range. Review compatible upstream updates.
- glob and minimatch: audit recommends a major Expo upgrade; do not apply force fixes blindly.
- uuid via Expo tooling: no compatible fix reported in the audit.

These findings are not proven harmless. Assess actual exposure, including build-time inputs, before release and obtain explicit release risk acceptance if unresolved. Keep SDK 54 for the current validation cycle; reassess supported upgrades separately.

## Native release gates

Permission commit 17cae60 blocks camera, microphone, broad storage/media and overlay permissions at configuration level. Verify merged Android manifest and profile photo selection, sharing, exports, calendar and location in a compiled build. Verify resolved OkHttp version. Ticket scanning is deferred; confirm it is inaccessible in release app and production API before finalising privacy declarations.

No production release or risk acceptance is implied by this document.

## Advisory research and proposed remediation


image-size 1.2.1 remains flagged for later parser DoS issues despite fixing the original GHSA-m5qc-5hw7-8vg7 range. The 2.1.0 trial broke Metro asset bundling and was reverted. Metro imports 1.2.1 from its Node asset-processing code to read image dimensions. Do not introduce an unreviewed fork. Upstream tracking: https://github.com/react/metro/issues/1762 and https://www.npmjs.com/package/image-size?activeTab=versions.

The remaining high finding is in Metro’s Node build-time image parser. The photo picker and other app image flows do not invoke Metro’s parser. The moderate findings still need an individual exposure review. Restrict build inputs to reviewed source/assets and trusted dependencies. This does not eliminate supply-chain risk. Residual risk has not been accepted. Native OkHttp exact artifact availability and resolved version still require confirmation from Gradle/build evidence.
