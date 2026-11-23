# Contribution release validation

Use disposable test accounts and store sandbox/license testing. Do not use real charges to simulate failure. Android sideloaded preview is for functional checks; use a Play-distributed test build for billing.

## Remaining checks
- Apple: verify refund notification delivery, transaction revocation and supporter badge removal when no qualifying unrevoked purchase remains.
- Google: verify refund notification delivery through configured Pub/Sub, server re-verification, ledger revocation and badge removal under the same condition.
- Both: restore unfinished transactions after interruption; verify idempotency, no duplicate credit, correct account association and correct environment. Do not deliberately interrupt a real purchase.
- Both: verify all seven product mappings and displayed store prices (£1, £2, £5, £10, £20, £50, £100), including amounts accessed through Other amount. Check cancellation and errors without awarding supporter status.
- iOS/iPadOS: compare storefront product display with checkout currency; Apple support case remains open.

## Evidence
Record platform, build, sandbox or production environment, test timestamp, expected/actual result, redacted transaction reference, webhook outcome, ledger and badge state. Never record tokens or receipts in this document. A refund initiated in a store does not prove server notification processing. Existing initial £1 sandbox tests and automated regression checks need not be repeated separately unless needed for a lifecycle scenario.

No public release or live-payment validation is implied.


## Refund during recovery

A server-confirmed `PURCHASE_REFUNDED` response ends that recovery attempt without granting supporter status or consuming the transaction. Other verification failures remain retryable. Validate with a store-distributed test build that a refunded item does not block another contribution after recovery, and that the supporter badge reflects the server ledger after refresh.

## Consolidated device session — 23 November

For each store, use a disposable account and the final matching store-distributed test build. Check all seven displayed prices, including Other amount, against the store checkout; cancel checkout first and confirm no badge or ledger credit. Then complete one sandbox contribution, interrupt or relaunch before confirmation where safely supported, and verify recovery produces exactly one ledger credit and the correct badge. Request a sandbox refund through the supported store mechanism and verify notification receipt, ledger revocation, badge removal after refresh (if no other qualifying purchase), and ability to contribute again. If interruption cannot be reproduced, record it as unverified rather than passing it. Existing successful sandbox purchases may be reused for refund testing if their build and account evidence are sufficient.

Currency inspection: useSupportBilling.ts obtains prices from the native product displayPrice (or Android offer displayPrice); no USD literal or conversion in that path. Do not force GBP for global users. Compare the exact product, storefront and native checkout, and await Apple case 103020803539 before speculative changes. The cause remains unconfirmed.
