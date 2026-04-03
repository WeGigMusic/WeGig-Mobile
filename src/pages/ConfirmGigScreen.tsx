import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppHeader } from "../components/AppHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { Colours } from "../theme/colours";
import type { CreateGigInput } from "../shared/types/Gig";

type Props = {
  prefill: Partial<CreateGigInput>;
  onPressLogo?: () => void;
  onBack: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  loading?: boolean;
};

export function ConfirmGigScreen(props: Props) {
  const {
    prefill,
    onPressLogo,
    onBack,
    onConfirm,
    onEdit,
    loading = false,
  } = props;

  const artist = String(prefill.artist ?? "").trim();
  const venue = String(prefill.venue ?? "").trim();
  const city = String(prefill.city ?? "").trim();
  const date = String(prefill.date ?? "").trim();
  const notes = String(prefill.notes ?? "").trim();

  const missingRequired = !artist || !venue || !city || !date;

  const handleConfirm = () => {
    if (missingRequired) {
      Alert.alert(
        "Missing details",
        "This gig needs artist, venue, city and date before it can be added.",
      );
      return;
    }

    onConfirm();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        onPressLogo={onPressLogo}
        onPressBack={onBack}
        backLabel="Discover"
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Add this gig?</Text>
            <View style={styles.badge}>
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={Colours.text.primary}
              />
            </View>
          </View>

          <Text style={styles.subtitle}>
            We found these details from Discover. You can add it now or edit
            first.
          </Text>
        </View>

        <View style={styles.card}>
          <Field label="Artist" value={artist} required />
          <Field label="Venue" value={venue} required />
          <Field label="City" value={city} required />
          <Field label="Date" value={date} required />

          {notes ? <Field label="Notes" value={notes} /> : null}

          {missingRequired ? (
            <Text style={styles.warning}>
              Some required details are missing. Choose “Edit details” to finish
              this gig first.
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsCard}>
          <PrimaryButton
            title={loading ? "Adding…" : "Add to my gigs"}
            onPress={handleConfirm}
            disabled={loading || missingRequired}
          />

          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={Colours.text.primary}
            />
            <Text style={styles.secondaryBtnText}>Edit details</Text>
          </Pressable>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Adding gig…</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value?: string;
  required?: boolean;
}) {
  const value = String(props.value ?? "").trim();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {props.label}
        {props.required ? " *" : ""}
      </Text>
      <Text style={styles.value}>{value || "—"}</Text>
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
    padding: 14,
  },

  actionsCard: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 14,
    gap: 10,
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
    marginTop: 6,
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  badge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(47,140,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(47,140,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  field: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.border,
  },

  label: {
    color: Colours.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginBottom: 3,
  },

  value: {
    color: Colours.text.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },

  warning: {
    marginTop: 12,
    color: Colours.text.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  secondaryBtn: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  secondaryBtnText: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 17,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    paddingTop: 2,
  },

  loadingText: {
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },
});