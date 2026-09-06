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
          lastKnown.coords.latitude,
        longitude:
          lastKnown.coords.longitude,
      };
    }

    const current =
      await Location.getCurrentPositionAsync({
        accuracy:
          Location.Accuracy.Balanced,
      });

    return {
      latitude:
        current.coords.latitude,
      longitude:
        current.coords.longitude,
    };
  } catch {
    return undefined;
  }
}