import * as Location from "expo-location";

export type LocationBias = {
  latitude: number;
  longitude: number;
};

export async function getLocationBias(): Promise<
  LocationBias | undefined
> {
  try {
    const permission =
      await Location.getForegroundPermissionsAsync();

    if (
      permission.status !== "granted"
    ) {
      return undefined;
    }

    const lastKnown =
      await Location.getLastKnownPositionAsync({
        maxAge: 10 * 60 * 1000,
        requiredAccuracy: 50000,
      });

    if (lastKnown) {
      return {
        latitude:
          Math.round(lastKnown.coords.latitude * 100) / 100,
        longitude:
          Math.round(lastKnown.coords.longitude * 100) / 100,
      };
    }

    const current =
      await Location.getCurrentPositionAsync({
        accuracy:
          Location.Accuracy.Balanced,
      });

    return {
      latitude:
        Math.round(current.coords.latitude * 100) / 100,
      longitude:
        Math.round(current.coords.longitude * 100) / 100,
    };
  } catch {
    return undefined;
  }
}