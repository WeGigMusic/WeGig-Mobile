import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { Colours } from "../theme/colours";
import { apiPost } from "../lib/api";
import type { CreateGigInput } from "../shared/types/Gig";

type TicketScanResult = {
  rawText: string;
  confidence: number;
  prefill: Partial<CreateGigInput>;
};

type Props = {
  onPressLogo?: () => void;
  onBack: () => void;
  onScanned: (prefill: Partial<CreateGigInput>) => void;
};

export function TicketScanScreen(props: Props) {
  const [imageUri, setImageUri] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<TicketScanResult | null>(null);

  const requestCameraPermission = async () => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (!res.granted) {
      Alert.alert(
        "Camera permission needed",
        "Please allow camera access to scan tickets.",
      );
      return false;
    }
    return true;
  };

  const requestLibraryPermission = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!res.granted) {
      Alert.alert(
        "Photo access needed",
        "Please allow photo access to choose a ticket image.",
      );
      return false;
    }
    return true;
  };

  const preprocessImage = async (uri: string) => {
    const processed = await manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      {
        compress: 0.8,
        format: SaveFormat.JPEG,
      },
    );

    return processed.uri;
  };

  const scanUri = async (uri: string) => {
    setLoading(true);
    setResult(null);

    try {
      const processedUri = await preprocessImage(uri);
      setImageUri(processedUri);

      const form = new FormData();
      form.append("ticket", {
        uri: processedUri,
        name: "ticket.jpg",
        type: "image/jpeg",
      } as any);

      const res = await apiPost<TicketScanResult>("/ocr/ticket", form);
      setResult(res);
    } catch (e: any) {
      Alert.alert("Scan failed", e?.message ?? "Could not read this ticket.");
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
    });

    if (res.canceled || !res.assets?.[0]?.uri) return;
    await scanUri(res.assets[0].uri);
  };

  const chooseFromLibrary = async () => {
    const ok = await requestLibraryPermission();
    if (!ok) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
      selectionLimit: 1,
    });

    if (res.canceled || !res.assets?.[0]?.uri) return;
    await scanUri(res.assets[0].uri);
  };

  const usePrefill = () => {
    if (!result?.prefill) {
      Alert.alert("Nothing found", "We could not extract enough detail yet.");
      return;
    }

    props.onScanned({
      ...result.prefill,
      notes: [
        result.prefill.notes?.trim(),
        result.rawText?.trim()
          ? `Scanned ticket text:\n${result.rawText.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colours.background.app }}>
      <AppHeader onPressLogo={props.onPressLogo} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text
          style={{
            color: Colours.text.primary,
            fontSize: 24,
            fontWeight: "800",
            marginBottom: 8,
          }}
        >
          Scan a ticket
        </Text>

        <Text
          style={{
            color: Colours.text.secondary,
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 16,
          }}
        >
          Take a photo of a paper ticket or choose one from your library. We’ll
          extract what we can, then you can review before saving.
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: Colours.ui.border,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: Colours.background.card,
            minHeight: 220,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: 260 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ color: Colours.text.muted, fontWeight: "600" }}>
              No ticket image selected yet
            </Text>
          )}
        </View>

        <View style={{ gap: 10, marginBottom: 20 }}>
          <PrimaryButton title="Take photo" onPress={() => void takePhoto()} />
          <PrimaryButton
            title="Choose from library"
            onPress={() => void chooseFromLibrary()}
          />
          <Pressable
            onPress={props.onBack}
            style={({ pressed }) => [
              {
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed ? { opacity: 0.8 } : null,
            ]}
          >
            <Text style={{ color: Colours.text.muted, fontWeight: "700" }}>
              Cancel
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: Colours.ui.border,
              borderRadius: 16,
              padding: 16,
              backgroundColor: Colours.background.card,
              alignItems: "center",
              gap: 10,
            }}
          >
            <ActivityIndicator />
            <Text style={{ color: Colours.text.primary, fontWeight: "700" }}>
              Reading ticket…
            </Text>
          </View>
        ) : null}

        {result ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: Colours.ui.border,
              borderRadius: 16,
              padding: 16,
              backgroundColor: Colours.background.card,
              gap: 10,
            }}
          >
            <Text
              style={{
                color: Colours.text.primary,
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              Scan result
            </Text>

            <Field label="Artist" value={result.prefill.artist} />
            <Field label="Venue" value={result.prefill.venue} />
            <Field label="City" value={result.prefill.city} />
            <Field label="Date" value={result.prefill.date} />
            <Field
              label="Confidence"
              value={`${Math.round((result.confidence ?? 0) * 100)}%`}
            />

            <Text
              style={{
                color: Colours.text.secondary,
                fontSize: 13,
                lineHeight: 18,
                marginTop: 8,
              }}
            >
              Raw OCR text
            </Text>

            <View
              style={{
                borderWidth: 1,
                borderColor: Colours.ui.border,
                borderRadius: 12,
                padding: 12,
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
            >
              <Text style={{ color: Colours.text.muted, lineHeight: 19 }}>
                {result.rawText || "No text returned"}
              </Text>
            </View>

            <View style={{ marginTop: 8 }}>
              <PrimaryButton title="Use these details" onPress={usePrefill} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; value?: string | number | null }) {
  return (
    <View>
      <Text
        style={{
          color: Colours.text.secondary,
          fontSize: 12,
          lineHeight: 16,
          marginBottom: 2,
          fontWeight: "700",
        }}
      >
        {props.label}
      </Text>
      <Text
        style={{
          color: Colours.text.primary,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: "600",
        }}
      >
        {String(props.value ?? "—")}
      </Text>
    </View>
  );
}