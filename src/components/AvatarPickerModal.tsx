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

export function AvatarPickerModal({
  visible,
  onClose,
  onPickPreset,
  onUpload,
  onRemove,
  showRemove,
}: Props) {
  const renderPreset = ({ item }: { item: AvatarPreset }) => (
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
            data={avatarPresets}
            keyExtractor={(item) => item.id}
            renderItem={renderPreset}
            numColumns={3}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />

          <Pressable style={styles.actionBtn} onPress={onUpload}>
            <Text style={styles.actionText}>Upload your own photo</Text>
          </Pressable>

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
  },

  presetImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },

  presetLabel: {
    color: Colours.text.primary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  actionBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  actionText: {
    color: Colours.text.primary,
    fontWeight: "800",
    fontSize: 15,
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