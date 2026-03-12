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
        pressed ? { opacity: 0.9 } : null,
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
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colours.background.card,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 14,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colours.ui.border,
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
    backgroundColor: Colours.background.cardStrong,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  presetImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 8,
  },
  presetLabel: {
    color: Colours.text.primary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  actionBtn: {
    backgroundColor: Colours.background.cardStrong,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  actionText: {
    color: Colours.text.primary,
    fontWeight: "700",
  },
  removeBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  removeText: {
    color: Colours.text.danger,
    fontWeight: "700",
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelText: {
    color: Colours.text.muted,
    fontWeight: "600",
  },
});