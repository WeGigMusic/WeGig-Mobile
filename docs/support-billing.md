# Support WeGig mobile billing

Requires expo-iap 6.5.0 installed and the expo-iap config plugin already added.
This patch changes only mobile application code, tests and this document. It does
not overwrite app.config.ts, eas.json, package.json or package-lock.json.

After applying, run npm run typecheck and
node --test tests/supportPurchases.test.cjs.

Behaviour:
- Uses authenticated /support/status and /support/verify API endpoints.
- Obtains prices from the store before enabling a payment. GBP amounts in the
  disabled preview remain layout examples only.
- Binds Apple purchases with appAccountToken and Google purchases with the API's
  obfuscated account ID. Verification takes the user from their current session.
- Finishes/consumes a transaction only after successful API verification.
- Retries unfinished transactions at launch, on app foreground and via Retry
  confirmation. Failed or pending confirmation blocks another contribution.
- Production status controls the profile's Founding Supporter badge. Sandbox
  results show a test confirmation and do not award a paid badge.
- Account changes dispose listeners and reset user-specific state.

The dev app IDs com.wegig.mobile.dev/com.wegig.app.dev are screen previews. They
cannot buy products registered under the original store apps. Use original-ID
TestFlight / Play internal testing builds for payment tests. Do not rebuild yet
solely to apply this patch; credentials and the API deployment are still pending.

A fresh native build is required for expo-iap, because the existing development
client was built before it was installed. Expo Go cannot run native billing.

Keep SUPPORT_PAYMENTS_ENABLED unset in the API until release preparation is
complete. Remaining work includes refund/revocation handling, account deletion
and purchase-record retention, test-database migration validation, store keys,
Google product creation, and real sandbox/internal-test purchases. Configure
Google support products as single straightforward buy options without rental,
preorder or discount variants for this initial release.

Validation performed here: TypeScript check and seven transaction coordinator
tests covering duplicate deliveries, verification failure, pending and foreign
purchases, sandbox separation, store finalisation retry and malformed replies.
No iPhone/Android native purchase was exercised in this environment.
