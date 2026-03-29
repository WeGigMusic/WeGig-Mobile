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
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.hint}>Tap outside to close</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingHorizontal: 16,
    paddingTop: 150,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#17191C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  title: {
    color: Colours.text.primary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    color: Colours.text.secondary,
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    marginTop: 14,
    color: Colours.text.muted,
    fontSize: 12,
    fontWeight: "600",
  },
});