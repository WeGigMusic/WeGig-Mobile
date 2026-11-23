import type { StoreAgeSignal } from "./storeAgeSignals";

/** Prototype only. A store age range is not consent or an account identity.
 * Never persist or transmit the underlying signal to analytics.
 * Unknown eligibility is deliberately not treated as adulthood.
 */
export function allowsOptionalAnalytics(signal: StoreAgeSignal): boolean {
  if (signal.status !== "shared") return false;
  const { lowerBound, upperBound } = signal.ageRange;
  return typeof lowerBound === "number" &&
    Number.isFinite(lowerBound) && lowerBound >= 18 &&
    (upperBound === null || (typeof upperBound === "number" &&
      Number.isFinite(upperBound) && upperBound >= lowerBound));
}
