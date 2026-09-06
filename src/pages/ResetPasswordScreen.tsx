import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { posthog } from "../lib/analytics";

type Props = {
  onComplete: () => void;
};

export default function ResetPasswordScreen({
  onComplete,
}: Props) {
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] =
    React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [focusedField, setFocusedField] = React.useState<
    "password" | "confirmPassword" | null
  >(null);

  async function updatePassword() {
    try {
      const nextPassword = password.trim();

      if (nextPassword.length < 6) {
        throw new Error(
          "Password must be at least 6 characters."
        );
      }

      if (nextPassword !== confirmPassword.trim()) {
        throw new Error("Passwords do not match.");
      }

      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: nextPassword,
      });

      if (error) {
        throw error;
      }

      posthog.capture("password_reset_completed");
      void posthog.flush();

      Alert.alert(
        "Password updated",
        "Your password has been changed successfully.",
        [
          {
            text: "Continue",
            onPress: onComplete,
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Couldn’t update password",
        error?.message ?? "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          Create new password
        </Text>

        <Text style={styles.subtitle}>
          Choose a new password for your WeGig account.
        </Text>

        <TextInput
          placeholder="New password"
          placeholderTextColor="#8E8E98"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocusedField("password")}
          onBlur={() => setFocusedField(null)}
          style={[
            styles.input,
            focusedField === "password"
              ? styles.inputFocused
              : null,
          ]}
        />

        <TextInput
          placeholder="Confirm new password"
          placeholderTextColor="#8E8E98"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onFocus={() =>
            setFocusedField("confirmPassword")
          }
          onBlur={() => setFocusedField(null)}
          onSubmitEditing={() => {
            void updatePassword();
          }}
          style={[
            styles.input,
            focusedField === "confirmPassword"
              ? styles.inputFocused
              : null,
          ]}
        />

        <Pressable
          onPress={() => {
            void updatePassword();
          }}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
            loading ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.buttonText}>
            {loading
              ? "Updating…"
              : "Update password"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  content: {
    width: "100%",
    gap: 12,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 2,
  },

  subtitle: {
    color: "#8E8E98",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    marginBottom: 14,
  },

  input: {
    height: 52,
    backgroundColor: "#15151B",
    color: "#FFFFFF",
    borderRadius: 15,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#2A2A34",
    fontSize: 15,
    fontWeight: "700",
  },

  inputFocused: {
    borderColor: "#2F8CFF",
    shadowColor: "#2F8CFF",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  button: {
    height: 52,
    backgroundColor: "#2F8CFF",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },

  buttonPressed: {
    opacity: 0.9,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});