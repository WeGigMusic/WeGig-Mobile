import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { Colours } from "../theme/colours";
import { formatDateUk, fromYmdToLocalDate, toYmdLocal } from "../lib/date";

export function DateField(props: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [iosOpen, setIosOpen] = React.useState(false);
  const [androidOpen, setAndroidOpen] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState<Date>(
    fromYmdToLocalDate(props.value),
  );

  React.useEffect(() => {
    setDraftDate(fromYmdToLocalDate(props.value));
  }, [props.value]);

  const open = () => {
    if (Platform.OS === "ios") {
      setDraftDate(fromYmdToLocalDate(props.value));
      setIosOpen(true);
      return;
    }

    setAndroidOpen(true);
  };

  const displayValue = props.value?.trim()
    ? formatDateUk(props.value)
    : props.placeholder ?? "Select date";

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{props.label}</Text>

      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.field,
          pressed ? { opacity: 0.92 } : null,
        ]}
      >
        <Text
          style={[
            styles.value,
            !props.value?.trim() ? styles.placeholder : null,
          ]}
        >
          {displayValue}
        </Text>

        <Ionicons
          name="calendar-outline"
          size={17}
          color={Colours.text.muted}
        />
      </Pressable>

      {Platform.OS === "android" && androidOpen ? (
        <DateTimePicker
          value={fromYmdToLocalDate(props.value)}
          mode="date"
          display="default"
          onChange={(_, selected) => {
            setAndroidOpen(false);
            if (selected) props.onChange(toYmdLocal(selected));
          }}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={iosOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosOpen(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Pressable
                  onPress={() => setIosOpen(false)}
                  style={({ pressed }) => [
                    styles.sheetBtn,
                    pressed ? { opacity: 0.8 } : null,
                  ]}
                >
                  <Text style={styles.sheetBtnTextMuted}>Cancel</Text>
                </Pressable>

                <Text style={styles.sheetTitle}>Select date</Text>

                <Pressable
                  onPress={() => {
                    props.onChange(toYmdLocal(draftDate));
                    setIosOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.sheetBtn,
                    pressed ? { opacity: 0.8 } : null,
                  ]}
                >
                  <Text style={styles.sheetBtnText}>Done</Text>
                </Pressable>
              </View>

              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={draftDate}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  onChange={(_, selected) => {
                    if (selected) setDraftDate(selected);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },

  label: {
    color: Colours.text.secondary,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    backgroundColor: Colours.background.card,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  value: {
    color: Colours.text.primary,
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 20,
  },

  placeholder: {
    color: Colours.text.muted,
    fontWeight: "400",
  },

  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.48)",
  },

  sheet: {
    backgroundColor: "#111318",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    paddingBottom: 20,
  },

  sheetHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sheetTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 19,
  },

  sheetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },

  sheetBtnText: {
    color: "#2F8CFF",
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  sheetBtnTextMuted: {
    color: Colours.text.muted,
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 18,
  },

  pickerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
});