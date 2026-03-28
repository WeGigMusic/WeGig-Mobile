import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colours } from "../theme/colours";

type BadgeInfoModalProps = {
  visible: boolean;
  title: string;
  description: string;
  onClose: () => void;
};

export function BadgeInfoModal({
  visible,
  title,
  description,
  onClose,
}: BadgeInfoModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.hint}>Tap anywhere to close</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 18,
    padding: 18,
    backgroundColor: Colours.background.card,
    borderWidth: 1,
    borderColor: Colours.ui.border,
  },
  title: {
    color: Colours.text.primary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    color: Colours.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    marginTop: 14,
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "600",
  },
});