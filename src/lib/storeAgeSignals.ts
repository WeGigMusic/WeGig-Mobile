import { requireOptionalNativeModule } from "expo";
import * as AgeRange from "expo-age-range";
import { Platform } from "react-native";

export type StoreAgeSignal =
  | { status: "not-required" }
  | { status: "unavailable"; required: boolean }
  | { status: "verification-required" }
  | { status: "not-shared" }
  | { status: "shared"; ageRange: AgeRange.AgeRangeResponse };

export async function readStoreAgeSignal(): Promise<StoreAgeSignal> {
  let required = false;
  try {
    if (Platform.OS === "ios") {
      const eligible = await AgeRange.isEligibleForAgeFeaturesAsync();
      if (eligible === false) return { status: "not-required" };
      if (eligible !== true) return { status: "unavailable", required };
      required = true;
    } else if (Platform.OS === "android") {
      const native = requireOptionalNativeModule<{ isMandatorySharingAsync(): Promise<boolean | null> }>("WeGigAgeSignals");
      if (!native) return { status: "unavailable", required };
      const mandatory = await native.isMandatorySharingAsync();
      if (mandatory === false) return { status: "not-required" };
      if (mandatory !== true) return { status: "unavailable", required };

      required = true;
      const access = await AgeRange.requestAgeSignalsAccessAsync();
      if (access === "VERIFICATION_REQUIRED") return { status: "verification-required" };
      if (access === "NOT_SHARED") return { status: "not-shared" };
      if (access !== "SHARED") return { status: "unavailable", required };
    } else {
      return { status: "unavailable", required };
    }

    const ageRange = await AgeRange.requestAgeRangeAsync({ threshold1: 13, threshold2: 18 });
    if (ageRange.lowerBound === null && ageRange.upperBound === null) return { status: "unavailable", required };
    return { status: "shared", ageRange };
  } catch (error) {
    if (required && (error as { code?: string } | null)?.code === "ERR_AGE_RANGE_USER_DECLINED") {
      return { status: "not-shared" };
    }
    return { status: "unavailable", required };
  }
}
