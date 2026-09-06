import React from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiGet } from "../lib/api";
import { Colours } from "../theme/colours";
import {
  getLocationBias,
  type LocationBias,
} from "../lib/locationBias";

type CitySuggestion = {
  id: string;
  placeId?: string;
  name: string;
  placeName: string;
};

export function CitySearchInput(props: {
  value: string;
  onChangeText: (
    value: string,
  ) => void;
  placeholder?: string;
  suppressSuggestions?: boolean;
}) {
  const [open, setOpen] =
    React.useState(false);

  const [focused, setFocused] =
    React.useState(false);

  const [loading, setLoading] =
    React.useState(false);

  const [results, setResults] =
    React.useState<
      CitySuggestion[]
    >([]);

  const [
    locationBias,
    setLocationBias,
  ] =
    React.useState<
      LocationBias | undefined
    >();

  const selectedCityRef =
    React.useRef("");

  React.useEffect(() => {
    let active = true;

    void getLocationBias().then(
  (
    location:
      | LocationBias
      | undefined,
  ) => {
    if (active) {
      setLocationBias(
        location,
      );
    }
  },
);

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!props.value.trim()) {
      selectedCityRef.current =
        "";

      setResults([]);
      setOpen(false);
      setLoading(false);
    }
  }, [props.value]);

  React.useEffect(() => {
    if (
      props.suppressSuggestions
    ) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const q =
      props.value.trim();

    const selected =
      selectedCityRef.current.trim();

    if (
      q.length < 2 ||
      (
        selected &&
        q.toLowerCase() ===
          selected.toLowerCase()
      )
    ) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    let active = true;

    const timer =
      setTimeout(
        async () => {
          setLoading(true);

          try {
            const params =
              new URLSearchParams({
                q,
              });

            if (locationBias) {
              params.set(
                "latitude",
                String(
                  locationBias.latitude,
                ),
              );

              params.set(
                "longitude",
                String(
                  locationBias.longitude,
                ),
              );
            }

            const res =
              await apiGet<{
                cities:
                  CitySuggestion[];
              }>(
                `/places/cities/search?${params.toString()}`,
              );

            if (!active) {
              return;
            }

            const cities =
              Array.isArray(
                res?.cities,
              )
                ? res.cities
                : [];

            setResults(
              cities,
            );

            setOpen(
              cities.length > 0,
            );
          } catch {
            if (!active) {
              return;
            }

            setResults([]);
            setOpen(false);
          } finally {
            if (active) {
              setLoading(false);
            }
          }
        },
        250,
      );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    props.value,
    props.suppressSuggestions,
    locationBias,
  ]);

  const handleChangeText = (
    text: string,
  ) => {
    const next =
      text.trim();

    const selected =
      selectedCityRef.current.trim();

    if (
      selected &&
      next.toLowerCase() !==
        selected.toLowerCase()
    ) {
      selectedCityRef.current =
        "";
    }

    props.onChangeText(
      text,
    );

    if (
      props.suppressSuggestions
    ) {
      setOpen(false);
      setResults([]);
      setLoading(false);
      return;
    }

    setOpen(
      next.length >= 2 &&
        !selectedCityRef.current,
    );
  };

  const handleSelectCity = (
    city: CitySuggestion,
  ) => {
    const cityName =
      city.name.trim();

    selectedCityRef.current =
      cityName;

    setResults([]);
    setOpen(false);
    setLoading(false);

    props.onChangeText(
      cityName,
    );

    Keyboard.dismiss();
  };

  const handleClear = () => {
    selectedCityRef.current =
      "";

    setResults([]);
    setOpen(false);
    setLoading(false);

    props.onChangeText("");
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.inputWrap,
          focused
            ? styles.inputWrapFocused
            : null,
        ]}
      >
        <Ionicons
          name="location-outline"
          size={17}
          color={
            focused
              ? "#7EB6FF"
              : Colours.text.muted
          }
        />

        <TextInput
          value={props.value}
          onChangeText={
            handleChangeText
          }
          onFocus={() =>
            setFocused(true)
          }
          onBlur={() =>
            setFocused(false)
          }
          placeholder={
            props.placeholder ??
            "Search city"
          }
          placeholderTextColor="rgba(255,255,255,0.42)"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
        />

        {loading ? (
          <ActivityIndicator
            size="small"
          />
        ) : props.value.trim() ? (
          <Pressable
            onPress={
              handleClear
            }
            hitSlop={10}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color="rgba(255,255,255,0.32)"
            />
          </Pressable>
        ) : null}
      </View>

      {!props.suppressSuggestions &&
      open &&
      results.length > 0 ? (
        <View
          style={
            styles.suggestCard
          }
        >
          {results.map(
            (city) => (
              <Pressable
                key={city.id}
                onPress={() =>
                  handleSelectCity(
                    city,
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.suggestRow,

                  pressed
                    ? styles.rowPressed
                    : null,
                ]}
              >
                <View
                  style={
                    styles.iconBox
                  }
                >
                  <Ionicons
                    name="location"
                    size={14}
                    color="#7EB6FF"
                  />
                </View>

                <View
                  style={
                    styles.flex
                  }
                >
                  <Text
                    style={
                      styles.suggestTitle
                    }
                  >
                    {city.name}
                  </Text>

                  {city.placeName ? (
                    <Text
                      style={
                        styles.suggestMeta
                      }
                    >
                      {
                        city.placeName
                      }
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    wrap: {
      gap: 10,
    },

    flex: {
      flex: 1,
    },

    inputWrap: {
      minHeight: 48,
      borderRadius: 17,
      backgroundColor:
        "rgba(255,255,255,0.065)",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.12)",
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    inputWrapFocused: {
      borderColor:
        "#2F8CFF",
      backgroundColor:
        "rgba(47,140,255,0.10)",
    },

    input: {
      flex: 1,
      color:
        Colours.text.primary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "700",
      paddingVertical:
        Platform.OS === "ios"
          ? 13
          : 9,
    },

    suggestCard: {
      backgroundColor:
        "rgba(255,255,255,0.04)",
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.055)",
    },

    suggestRow: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        "rgba(255,255,255,0.06)",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    rowPressed: {
      opacity: 0.9,
    },

    iconBox: {
      width: 30,
      height: 30,
      borderRadius: 11,
      backgroundColor:
        "rgba(126,182,255,0.1)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    suggestTitle: {
      color:
        Colours.text.primary,
      fontWeight: "900",
      fontSize: 14,
      lineHeight: 18,
    },

    suggestMeta: {
      marginTop: 2,
      color:
        Colours.text.muted,
      fontWeight: "700",
      fontSize: 12,
      lineHeight: 16,
    },
  });