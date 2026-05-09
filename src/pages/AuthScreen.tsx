import React, { ReactNode, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { posthog } from "../lib/analytics";

WebBrowser.maybeCompleteAuthSession();

const HAPTICS_KEY = "wegig.hapticsEnabled";

async function hapticsAllowed() {
 try {
   const value = await AsyncStorage.getItem(HAPTICS_KEY);
   return value == null || value === "1";
 } catch {
   return true;
 }
}

async function lightImpactHaptic() {
 if (!(await hapticsAllowed())) return;

 try {
   await lightImpactHaptic();
 } catch {}
}


type SocialProvider = "google" | "apple";

const APPLE_LOGIN_ENABLED = false;

type PremiumButtonProps = {
  children: ReactNode;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  style?: object;
};

function PremiumButton({
  children,
  onPress,
  disabled,
  style,
}: PremiumButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  async function handlePress() {
    if (disabled) return;

    await lightImpactHaptic();
    await onPress();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => animateTo(0.975)}
        onPressOut={() => animateTo(1)}
        disabled={disabled}
        style={[style, disabled ? styles.disabledBtn : null]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

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

        posthog.capture("login_completed", {
          method: "email",
        });

        void posthog.flush();
      }
    } catch (e: any) {
      Alert.alert("Login Failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithProvider(provider: SocialProvider) {
    if (provider === "apple" && !APPLE_LOGIN_ENABLED) {
      Alert.alert("Coming soon", "Apple login will be enabled before launch.");
      return;
    }

    try {
      setLoading(true);

      posthog.capture("login_method_selected", {
        provider,
      });

      const redirectTo = Linking.createURL("auth-callback");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (!data.url) {
        throw new Error("No OAuth URL returned.");
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type === "success") {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.exchangeCodeForSession(result.url);

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (user) {
          posthog.identify(user.id, {
            email: user.email ?? null,
          });
        }

        posthog.capture("login_completed", {
          method: provider,
        });

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

          <PremiumButton
            style={styles.primaryBtn}
            onPress={signIn}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? "Loading..." : "Continue"}
            </Text>
          </PremiumButton>

          <PremiumButton
            style={styles.secondaryBtn}
            onPress={signUp}
            disabled={loading}
          >
            <Text style={styles.secondaryBtnText}>Create account</Text>
          </PremiumButton>

          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <PremiumButton
            style={styles.providerBtnLight}
            onPress={() => signInWithProvider("google")}
            disabled={loading}
          >
            <AntDesign name="google" size={18} color="#111111" />
            <Text style={styles.providerTextDark}>Continue with Google</Text>
          </PremiumButton>

          <PremiumButton
            style={styles.providerBtnDark}
            onPress={() => signInWithProvider("apple")}
            disabled={loading || !APPLE_LOGIN_ENABLED}
          >
            <Ionicons name="logo-apple" size={21} color="#FFFFFF" />
            <Text style={styles.providerTextLight}>Continue with Apple</Text>
          </PremiumButton>
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
    paddingHorizontal: 24,
  },

  card: {
    width: "100%",
  },

  logoWrap: {
    alignItems: "center",
    marginBottom: 24,
  },

  logoImage: {
    width: 94,
    height: 94,
  },

  form: {
    gap: 10,
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
    shadowOffset: { width: 0, height: 0 },
  },

  primaryBtn: {
    height: 52,
    backgroundColor: "#2F8CFF",
    borderRadius: 15,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#2F8CFF",
    shadowOpacity: 0.28,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },

  secondaryBtn: {
    height: 52,
    backgroundColor: "#15151B",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  providerBtnLight: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#F7F7F8",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  providerBtnDark: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  disabledBtn: {
    opacity: 0.5,
  },

  primaryBtnText: {
    textAlign: "center",
    fontWeight: "900",
    color: "#FFFFFF",
    fontSize: 15,
    letterSpacing: 0.1,
  },

  secondaryBtnText: {
    textAlign: "center",
    fontWeight: "900",
    color: "#FFFFFF",
    fontSize: 15,
    letterSpacing: 0.1,
  },

  providerTextDark: {
    color: "#050507",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.05,
  },

  providerTextLight: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.05,
  },

  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 7,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  dividerText: {
    color: "#8E8E98",
    fontSize: 13,
    fontWeight: "800",
  },
});