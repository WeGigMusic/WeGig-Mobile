import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
} from "react-native";
import { Colours } from "../theme/colours";
import { avatarPresets, type AvatarPreset } from "../config/avatarPresets";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickPreset: (presetId: string) => void;
  onUpload: () => void;
  onRemove: () => void;
  showRemove?: boolean;
};

type GridItem =
  | (AvatarPreset & { kind: "preset" })
  | { id: "upload"; label: "Upload"; kind: "upload" };

export function AvatarPickerModal({
  visible,
  onClose,
  onPickPreset,
  onUpload,
  onRemove,
  showRemove,
}: Props) {
  const gridItems: GridItem[] = [
    ...avatarPresets.map((item) => ({ ...item, kind: "preset" as const })),
    { id: "upload", label: "Upload", kind: "upload" as const },
  ];

  const renderItem = ({ item }: { item: GridItem }) => {
    if (item.kind === "upload") {
      return (
        <Pressable
          style={({ pressed }) => [
            styles.presetCard,
            styles.uploadCard,
            pressed ? { opacity: 0.92, transform: [{ scale: 0.98 }] } : null,
          ]}
          onPress={onUpload}
        >
          <View style={styles.uploadIconWrap}>
            <Text style={styles.uploadIcon}>＋</Text>
          </View>
          <Text style={styles.presetLabel}>Upload</Text>
        </Pressable>
      );
    }

    return (
      <Pressable
        style={({ pressed }) => [
          styles.presetCard,
          pressed ? { opacity: 0.92, transform: [{ scale: 0.98 }] } : null,
        ]}
        onPress={() => onPickPreset(item.id)}
      >
        <Image source={item.image} style={styles.presetImage} />
        <Text style={styles.presetLabel}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>Choose profile photo</Text>
          <Text style={styles.sectionTitle}>Instrument avatars</Text>

          <FlatList
            data={gridItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={3}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />

          {showRemove ? (
            <Pressable style={styles.removeBtn} onPress={onRemove}>
              <Text style={styles.removeText}>Remove current photo</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#07080A",
    justifyContent: "flex-end",
  },

  sheet: {
    backgroundColor: "#0D0F13",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 16,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 4,
  },

  title: {
    color: Colours.text.primary,
    fontSize: 20,
    fontWeight: "800",
  },

  sectionTitle: {
    color: Colours.text.muted,
    fontSize: 14,
    fontWeight: "700",
  },

  listContent: {
    gap: 12,
    paddingTop: 4,
  },

  row: {
    justifyContent: "space-between",
  },

  presetCard: {
    width: "31%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minHeight: 156,
    justifyContent: "center",
  },

  presetImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },

  uploadCard: {
    backgroundColor: "rgba(47,140,255,0.08)",
    borderColor: "rgba(47,140,255,0.28)",
  },

  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(47,140,255,0.14)",
    borderWidth: 2,
    borderColor: "#2F8CFF",
  },

  uploadIcon: {
    color: "#2F8CFF",
    fontSize: 34,
    fontWeight: "500",
    lineHeight: 34,
    marginTop: -2,
  },

  presetLabel: {
    color: Colours.text.primary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  removeBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },

  removeText: {
    color: Colours.text.danger,
    fontWeight: "800",
    fontSize: 15,
  },

  cancelBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },

  cancelText: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 15,
  },
});