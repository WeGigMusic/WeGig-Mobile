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
