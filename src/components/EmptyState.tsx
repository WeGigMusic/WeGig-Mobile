import { View, Text, Pressable, StyleSheet } from "react-native";

type EmptyStateProps = {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  onPress?: () => void;
};

export function EmptyState({
  title = "Nothing yet",
  subtitle,
  buttonLabel,
  onPress,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {buttonLabel && onPress ? (
        <Pressable onPress={onPress} style={styles.button}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#999",
    textAlign: "center",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2383e2",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});