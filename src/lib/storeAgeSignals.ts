import { requireOptionalNativeModule } from "expo";
import * as AgeRange from "expo-age-range";
import { Platform } from "react-native";

type StoreAgeSignal =
  | { status: "not-required" }
  | { status: "unavailable" }
  | { status: "verification-required" }
  | { status: "not-shared" }
  | { status: "shared"; ageRange: AgeRange.AgeRangeResponse };

export async function readStoreAgeSignal(): Promise<StoreAgeSignal> {
  try {
    if (Platform.OS === "ios") {
      const eligible = await AgeRange.isEligibleForAgeFeaturesAsync();
      if (eligible === false) return { status: "not-required" };
      if (eligible !== true) return { status: "unavailable" };
    } else if (Platform.OS === "android") {
      const native = requireOptionalNativeModule<{ isMandatorySharingAsync(): Promise<boolean> }>("WeGigAgeSignals");
      if (!native) return { status: "unavailable" };
      if (!(await native.isMandatorySharingAsync())) return { status: "not-required" };

      const access = await AgeRange.requestAgeSignalsAccessAsync();
      if (access === "VERIFICATION_REQUIRED") return { status: "verification-required" };
      if (access === "NOT_SHARED") return { status: "not-shared" };
      if (access !== "SHARED") return { status: "unavailable" };
    } else {
      return { status: "unavailable" };
    }

    const ageRange = await AgeRange.requestAgeRangeAsync({ threshold1: 13, threshold2: 18 });
    if (ageRange.lowerBound === null && ageRange.upperBound === null) return { status: "unavailable" };
    return { status: "shared", ageRange };
  } catch {
    return { status: "unavailable" };
  }
}
