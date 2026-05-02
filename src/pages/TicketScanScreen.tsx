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
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { Colours } from "../theme/colours";
import { apiPost } from "../lib/api";
import { posthog } from "../lib/analytics";
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

const NOTE_JUNK_PATTERNS = [
  /ticketmaster/i,
  /skiddle/i,
  /eventim/i,
  /axs/i,
  /see tickets/i,
  /seetickets/i,
  /ticketweb/i,
  /live nation/i,
  /\border\b/i,
  /\bbooking\b/i,
  /\bbarcode\b/i,
  /\bqr\b/i,
  /\bterms?\b/i,
  /\bconditions?\b/i,
  /\bsection\b/i,
  /\brow\b/i,
  /\bseat\b/i,
  /\bref\b/i,
  /\breference\b/i,
  /\bfee\b/i,
  /\bprice\b/i,
  /\bentry\b/i,
  /\baccount\b/i,
  /\bcustomer\b/i,
  /\bdelivery\b/i,
  /\bvalid\b/i,
  /https?:\/\//i,
];

function cleanRawTextForNotes(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 3)
    .filter((line) => !NOTE_JUNK_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n");
}

export function TicketScanScreen(props: Props) {
  const [imageUri, setImageUri] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<TicketScanResult | null>(null);
  const [showRawText, setShowRawText] = React.useState(false);

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
      [{ resize: { width: 2200 } }],
      {
        compress: 0.92,
        format: SaveFormat.JPEG,
      },
    );

    return processed.uri;
  };

  const scanUri = async (uri: string) => {
    posthog.capture("ticket_import_started");
    void posthog.flush();

    setLoading(true);
    setResult(null);
    setShowRawText(false);

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
      aspect: [4, 3],
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
      aspect: [4, 3],
    });

    if (res.canceled || !res.assets?.[0]?.uri) return;
    await scanUri(res.assets[0].uri);
  };

  const usePrefill = () => {
    if (!result?.prefill) {
      Alert.alert("Nothing found", "We could not extract enough detail yet.");
      return;
    }

    const cleanedScanText = cleanRawTextForNotes(result.rawText ?? "");
    const existingNotes =
      typeof result.prefill.notes === "string"
        ? result.prefill.notes.trim()
        : "";

    const mergedNotes = [existingNotes, cleanedScanText]
      .filter(Boolean)
      .join("\n\n");

    props.onScanned({
      ...result.prefill,
      notes: mergedNotes || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        onPressLogo={props.onPressLogo}
        onPressBack={props.onBack}
        backLabel="Add Gig"
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Scan a ticket</Text>
            <View style={styles.scanBadge}>
              <Ionicons
                name="scan-outline"
                size={16}
                color={Colours.text.primary}
              />
            </View>
          </View>

          <Text style={styles.subtitle}>
            Take a clear photo and crop tightly around the ticket text. We’ll
            auto-fill what we can, then you can review before saving.
          </Text>
        </View>

        <View style={styles.previewCard}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.emptyPreview}>
              <View style={styles.emptyPreviewIcon}>
                <Ionicons
                  name="ticket-outline"
                  size={24}
                  color={Colours.text.muted}
                />
              </View>
              <Text style={styles.emptyPreviewTitle}>
                No ticket image selected yet
              </Text>
              <Text style={styles.emptyPreviewText}>
                Best results: flat ticket, strong light, no glare, close crop.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => void takePhoto()}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed ? styles.actionBtnPressed : null,
            ]}
          >
            <Ionicons
              name="camera-outline"
              size={18}
              color={Colours.text.primary}
            />
            <Text style={styles.actionBtnText}>Take photo</Text>
          </Pressable>

          <Pressable
            onPress={() => void chooseFromLibrary()}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed ? styles.actionBtnPressed : null,
            ]}
          >
            <Ionicons
              name="images-outline"
              size={18}
              color={Colours.text.primary}
            />
            <Text style={styles.actionBtnText}>Library</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.card}>
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.loadingTitle}>Reading ticket…</Text>
              <Text style={styles.loadingText}>
                This can take a few seconds on the first scan.
              </Text>
            </View>
          </View>
        ) : null}

        {result ? (
          <View style={styles.card}>
            <Text style={styles.resultTitle}>Scan result</Text>

            <View style={styles.fieldsWrap}>
              <Field label="Artist" value={result.prefill.artist} />
              <Field label="Venue" value={result.prefill.venue} />
              <Field label="City" value={result.prefill.city} />
              <Field label="Date" value={result.prefill.date} />
              <Field
                label="Confidence"
                value={`${Math.round((result.confidence ?? 0) * 100)}%`}
              />
            </View>

            <Pressable
              onPress={() => setShowRawText((prev) => !prev)}
              style={({ pressed }) => [
                styles.rawToggleBtn,
                pressed ? { opacity: 0.9 } : null,
              ]}
            >
              <View style={styles.rawToggleLeft}>
                <Ionicons
                  name={
                    showRawText
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                  }
                  size={16}
                  color={Colours.text.primary}
                />
                <Text style={styles.rawToggleText}>Show raw scan text</Text>
              </View>
            </Pressable>

            {showRawText ? (
              <View style={styles.rawCard}>
                <Text style={styles.rawText}>
                  {result.rawText || "No text returned"}
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: 10 }}>
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
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <Text style={styles.fieldValue}>{String(props.value ?? "—")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  body: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 13,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  title: {
    color: Colours.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },

  subtitle: {
    color: Colours.text.muted,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  scanBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(47,140,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  previewCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    overflow: "hidden",
    minHeight: 260,
  },

  previewImage: {
    width: "100%",
    height: 280,
  },

  emptyPreview: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  emptyPreviewIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colours.ui.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyPreviewTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },

  emptyPreviewText: {
    marginTop: 8,
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
  },

  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    backgroundColor: Colours.background.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },

  actionBtnPressed: {
    opacity: 0.9,
  },

  actionBtnText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },

  loadingTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 20,
  },

  loadingText: {
    color: Colours.text.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  resultTitle: {
    color: Colours.text.primary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 8,
  },

  fieldsWrap: {
    gap: 8,
  },

  fieldRow: {
    gap: 2,
  },

  fieldLabel: {
    color: Colours.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  fieldValue: {
    color: Colours.text.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },

  rawToggleBtn: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  rawToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  rawToggleText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  rawCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  rawText: {
    color: Colours.text.muted,
    lineHeight: 19,
    fontSize: 13,
  },
});