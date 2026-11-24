import type { StoreAgeSignal } from "./storeAgeSignals";

// Outside mandatory sharing, the existing opt-in applies without proof of age.
export function allowsOptionalAnalytics(signal: StoreAgeSignal): boolean {
  if (signal.status === "not-required") return true;
  if (signal.status !== "shared") return false;
  const { lowerBound, upperBound } = signal.ageRange;
  return typeof lowerBound === "number" &&
    Number.isFinite(lowerBound) && lowerBound >= 18 &&
    (upperBound === null || (typeof upperBound === "number" &&
      Number.isFinite(upperBound) && upperBound >= lowerBound));
}

export function ageAccessMessage(signal: StoreAgeSignal, previouslyRequired = false): string | null {
  switch (signal.status) {
    case "not-required":
      return null;
    case "unavailable":
      return signal.required || previouslyRequired ? "We couldn’t check your age range. Please try again." : null;
    case "verification-required":
      return "Open Google Play to finish checking your age, then return to WeGig.";
    case "not-shared":
      return "Share your age range through your app store to continue.";
    case "shared": {
      const { upperBound, significantChangeStatus } = signal.ageRange;
      if (upperBound !== null && upperBound < 13) return "You need to be 13 or older to use WeGig.";
      if (significantChangeStatus === "PENDING" || significantChangeStatus === "DECLINED") {
        return "Ask your parent or guardian to review WeGig in Google Play.";
      }
      return null;
    }
  }
}

