import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { supabase } from "../lib/supabase";
import { posthog } from "../lib/analytics";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    try {
      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      posthog.capture("sign_up_started");

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
    <View style={styles.container}>
      <Text style={styles.logo}>WeGig</Text>
      <Text style={styles.sub}>Track every live music memory</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={signIn}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? "Loading..." : "Login"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={signUp}
        disabled={loading}
      >
        <Text style={styles.btnText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    color: "white",
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 8,
  },
  sub: {
    color: "#999",
    marginBottom: 30,
    fontSize: 15,
  },
  input: {
    backgroundColor: "#16161C",
    color: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A32",
  },
  primaryBtn: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  secondaryBtn: {
    backgroundColor: "#2A2A32",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  btnText: {
    textAlign: "center",
    fontWeight: "700",
    color: "#000",
  },
});