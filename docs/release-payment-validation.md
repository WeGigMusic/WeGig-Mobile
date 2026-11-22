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
