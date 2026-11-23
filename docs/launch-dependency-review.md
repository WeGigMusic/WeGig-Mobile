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

## Remaining moderate findings

The lockfile audit counts affected parent packages as well as root advisories. The three direct moderate findings are:

| Dependency | Observed use | Compatible fix assessment |
| --- | --- | --- |
| glob 13.0.7 | Expo CLI, config, fingerprinting and Metro config run filesystem discovery during development and builds. | Advisory affects versions through 14.0.1. No fix within 13 was identified. |
| minimatch 9.0.9 and 10.2.6 | Expo CLI and glob process project-side patterns. No app interaction passes user input to these call sites. | Patched in 11.0.1. An override crosses the installed majors. |
| uuid 3.4.0 | Expo ngrok creates a development tunnel name using v4 without a supplied buffer. | The advisory concerns v3, v5 and v6 with a caller-supplied buffer. The fix crosses major versions and the audited call does not use the affected API. |

No direct exposure to user input in the installed mobile app was identified for these paths. Keep the findings open for the controlled Expo SDK upgrade and use reviewed source and assets in the meantime. This review does not accept residual risk.


## Residual dependency risk acceptance — 23 November 2026

Operator explicitly accepts the documented residual dependency risk for launch on Expo SDK 54, conditional on the reviewed exposure assumptions remaining valid and no new material vulnerability or exploit path being identified. This closes the launch risk-decision gate, not the underlying advisories. Reassess on the next controlled Expo SDK upgrade, or sooner if exposure changes. Avoid forced incompatible upgrades. No new dependency scan or tests performed for this acceptance.
