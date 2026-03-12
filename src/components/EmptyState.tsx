import { View, Text, Pressable } from "react-native";

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  onPress?: () => void;
};

export function EmptyState({
  title,
  subtitle,
  buttonLabel,
  onPress,
}: EmptyStateProps) {
  return (
    <View style={{ padding: 24, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 8, color: "#fff" }}>
        {title}
      </Text>

      {subtitle ? (
        <Text
          style={{
            fontSize: 15,
            color: "#999",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          {subtitle}
        </Text>
      ) : null}

      {buttonLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={{
            backgroundColor: "#2383e2",
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}