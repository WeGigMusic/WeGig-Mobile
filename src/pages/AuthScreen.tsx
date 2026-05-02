import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { posthog } from "../lib/analytics";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<
    "email" | "password" | null
  >(null);

  async function signUp() {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      posthog.capture("sign_up_started");
      void posthog.flush();

      Alert.alert("Success", "Check your email to confirm your account.");
    } catch (e: any) {
      Alert.alert("Sign Up Failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.session?.user) {
        const user = data.session.user;

        posthog.identify(user.id, {
          email: user.email ?? null,
        });

        posthog.capture("login_completed");
        void posthog.flush();
      }
    } catch (e: any) {
      Alert.alert("Login Failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../../assets/wegig-logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.form}>
          <TextInput
            placeholder="Email"
            placeholderTextColor="#8E8E98"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            style={[
              styles.input,
              focusedField === "email" ? styles.inputFocused : null,
            ]}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#8E8E98"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            style={[
              styles.input,
              focusedField === "password" ? styles.inputFocused : null,
            ]}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, loading ? styles.disabledBtn : null]}
            onPress={signIn}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? "Loading..." : "Continue"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, loading ? styles.disabledBtn : null]}
            onPress={signUp}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryBtnText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    justifyContent: "center",
    padding: 24,
  },

  card: {
    width: "100%",
  },

  logoWrap: {
    alignItems: "center",
    marginBottom: 28,
  },

  logoImage: {
    width: 110,
    height: 110,
  },

  form: {
    gap: 12,
  },

  input: {
    backgroundColor: "#16161C",
    color: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#2A2A32",
    fontSize: 15,
    fontWeight: "600",
  },

  inputFocused: {
    borderColor: "#2F8CFF",
    shadowColor: "#2F8CFF",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  primaryBtn: {
    backgroundColor: "#2F8CFF",
    padding: 15,
    borderRadius: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(126,182,255,0.45)",
    shadowColor: "#2F8CFF",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  secondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  disabledBtn: {
    opacity: 0.65,
  },

  primaryBtnText: {
    textAlign: "center",
    fontWeight: "900",
    color: "#FFFFFF",
    fontSize: 15,
    letterSpacing: 0.2,
  },

  secondaryBtnText: {
    textAlign: "center",
    fontWeight: "900",
    color: "#FFFFFF",
    fontSize: 15,
    letterSpacing: 0.2,
  },
});