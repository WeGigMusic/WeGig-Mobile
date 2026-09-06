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
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { AntDesign, Ionicons } from "@expo/vector-icons";

import { supabase } from "../lib/supabase";
import { posthog } from "../lib/analytics";

WebBrowser.maybeCompleteAuthSession();

const HAPTICS_KEY = "wegig.hapticsEnabled";
const DISPLAY_NAME_KEY = "wegig.displayName";

const APPLE_LOGIN_ENABLED = Platform.OS === "ios";

type SocialProvider = "google";

type AuthFields = {
  email: string;
  password: string;
};

type PremiumButtonProps = {
  children: ReactNode;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  style?: object;
};

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
    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Light
    );
  } catch {}
}

function getFriendlyAuthError(error: any) {
  const message = String(error?.message ?? "").toLowerCase();

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("request failed") ||
    message.includes("failed to fetch")
  ) {
    return "You’re offline. Connect to the internet and try again.";
  }

  if (
    message.includes("invalid login credentials") ||
    message.includes("email not confirmed")
  ) {
    return "Email or password is incorrect.";
  }

  if (message.includes("unacceptable audience")) {
    return "Apple login is not configured correctly yet.";
  }

  if (
    message.includes("auth code") ||
    message.includes("code verifier")
  ) {
    return "Google login could not complete. Please try again.";
  }

  if (message.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return error?.message ?? "Something went wrong.";
}

function getCodeFromUrl(url: string) {
  const parsedUrl = new URL(url);
  const code = parsedUrl.searchParams.get("code");

  if (!code) {
    throw new Error("No OAuth code returned.");
  }

  return code;
}

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

    void lightImpactHaptic();
    await onPress();
  }

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => animateTo(0.975)}
        onPressOut={() => animateTo(1)}
        disabled={disabled}
        style={[
          style,
          disabled ? styles.disabledBtn : null,
        ]}
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
  const [resetLoading, setResetLoading] = useState(false);

  const [focusedField, setFocusedField] = useState<
    "email" | "password" | null
  >(null);

  function getAuthFields(): AuthFields {
    const nextEmail = email.trim().toLowerCase();
    const nextPassword = password;

    if (!nextEmail || !nextEmail.includes("@")) {
      throw new Error(
        "Please enter a valid email address."
      );
    }

    if (!nextPassword || nextPassword.length < 6) {
      throw new Error(
        "Password must be at least 6 characters."
      );
    }

    return {
      email: nextEmail,
      password: nextPassword,
    };
  }

  function getEmailForPasswordReset() {
    const nextEmail = email.trim().toLowerCase();

    if (!nextEmail || !nextEmail.includes("@")) {
      throw new Error(
        "Enter your email address first, then tap Forgot password?"
      );
    }

    return nextEmail;
  }

  async function handleSuccessfulLogin(
    user: any,
    method: string
  ) {
    if (user) {
      posthog.identify(user.id, {
        email: user.email ?? null,
      });
    }

    posthog.capture("login_completed", {
      method,
    });

    void posthog.flush();
  }

  async function signUp() {
    try {
      setLoading(true);

      const fields = getAuthFields();

      const { error } = await supabase.auth.signUp({
        email: fields.email,
        password: fields.password,
      });

      if (error) throw error;

      posthog.capture("sign_up_started");
      void posthog.flush();

      Alert.alert(
        "Success",
        "Account created. You can now log in."
      );
    } catch (e: any) {
      Alert.alert(
        "Sign Up Failed",
        getFriendlyAuthError(e)
      );
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    try {
      setLoading(true);

      const fields = getAuthFields();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: fields.email,
          password: fields.password,
        });

      if (error) throw error;

      await handleSuccessfulLogin(
        data.session?.user,
        "email"
      );
    } catch (e: any) {
      Alert.alert(
        "Login Failed",
        getFriendlyAuthError(e)
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    try {
      setResetLoading(true);

      const resetEmail =
        getEmailForPasswordReset();

      const redirectTo =
        Linking.createURL("reset-password");

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          resetEmail,
          {
            redirectTo,
          }
        );

      if (error) throw error;

      posthog.capture(
        "password_reset_requested"
      );

      void posthog.flush();

      Alert.alert(
        "Check your email",
        "If an account exists for that email address, you’ll receive a password reset link."
      );
    } catch (e: any) {
      Alert.alert(
        "Password Reset",
        getFriendlyAuthError(e)
      );
    } finally {
      setResetLoading(false);
    }
  }

  async function signInWithApple() {
    try {
      setLoading(true);

      posthog.capture(
        "login_method_selected",
        {
          provider: "apple",
        }
      );

      const credential =
        await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication
              .AppleAuthenticationScope.EMAIL,
            AppleAuthentication
              .AppleAuthenticationScope.FULL_NAME,
          ],
        });

      if (!credential.identityToken) {
        throw new Error(
          "Apple login did not return an identity token."
        );
      }

      const { data, error } =
        await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });

      if (error) throw error;

      const appleDisplayName = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (appleDisplayName) {
        try {
          const { error: metadataError } =
            await supabase.auth.updateUser({
              data: {
                full_name: appleDisplayName,
                given_name:
                  credential.fullName
                    ?.givenName ?? null,
                family_name:
                  credential.fullName
                    ?.familyName ?? null,
              },
            });

          if (metadataError) {
            console.log(
              "[auth] Apple name metadata save failed",
              metadataError
            );
          }

          const existingDisplayName =
            await AsyncStorage.getItem(
              DISPLAY_NAME_KEY
            );

          if (!existingDisplayName?.trim()) {
            await AsyncStorage.setItem(
              DISPLAY_NAME_KEY,
              appleDisplayName
            );
          }
        } catch (profileError) {
          console.log(
            "[auth] Apple name save failed",
            profileError
          );
        }
      }

      await handleSuccessfulLogin(
        data.session?.user,
        "apple"
      );
    } catch (e: any) {
      if (
        e?.code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }

      Alert.alert(
        "Login Failed",
        getFriendlyAuthError(e)
      );
    } finally {
      setLoading(false);
    }
  }

  async function signInWithProvider(
    provider: SocialProvider
  ) {
    try {
      setLoading(true);

      posthog.capture(
        "login_method_selected",
        {
          provider,
        }
      );

      const redirectTo =
        Linking.createURL("auth-callback");

      const { data, error } =
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });

      if (error) throw error;

      if (!data.url) {
        throw new Error(
          "No OAuth URL returned."
        );
      }

      const result =
        await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

      if (result.type !== "success") {
        return;
      }

      const code = getCodeFromUrl(
        result.url
      );

      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.exchangeCodeForSession(
          code
        );

      if (sessionError) {
        throw sessionError;
      }

      await handleSuccessfulLogin(
        sessionData.session?.user,
        provider
      );
    } catch (e: any) {
      Alert.alert(
        "Login Failed",
        getFriendlyAuthError(e)
      );
    } finally {
      setLoading(false);
    }
  }

  const authDisabled =
    loading || resetLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
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
            onFocus={() =>
              setFocusedField("email")
            }
            onBlur={() =>
              setFocusedField(null)
            }
            style={[
              styles.input,
              focusedField === "email"
                ? styles.inputFocused
                : null,
            ]}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#8E8E98"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onFocus={() =>
              setFocusedField("password")
            }
            onBlur={() =>
              setFocusedField(null)
            }
            style={[
              styles.input,
              focusedField === "password"
                ? styles.inputFocused
                : null,
            ]}
          />

          <View
            style={styles.forgotPasswordWrap}
          >
            <Pressable
              onPress={resetPassword}
              disabled={authDisabled}
              hitSlop={10}
            >
              <Text
                style={[
                  styles.forgotPasswordText,
                  authDisabled
                    ? styles.forgotPasswordDisabled
                    : null,
                ]}
              >
                {resetLoading
                  ? "Sending…"
                  : "Forgot password?"}
              </Text>
            </Pressable>
          </View>

          <PremiumButton
            style={styles.primaryBtn}
            onPress={signIn}
            disabled={authDisabled}
          >
            <Text
              style={styles.primaryBtnText}
            >
              {loading
                ? "Loading…"
                : "Continue"}
            </Text>
          </PremiumButton>

          <PremiumButton
            style={styles.secondaryBtn}
            onPress={signUp}
            disabled={authDisabled}
          >
            <Text
              style={styles.secondaryBtnText}
            >
              Create account
            </Text>
          </PremiumButton>

          <View
            style={styles.dividerWrap}
          >
            <View
              style={styles.dividerLine}
            />

            <Text
              style={styles.dividerText}
            >
              or
            </Text>

            <View
              style={styles.dividerLine}
            />
          </View>

          <PremiumButton
            style={styles.providerBtnLight}
            onPress={() =>
              signInWithProvider("google")
            }
            disabled={authDisabled}
          >
            <AntDesign
              name="google"
              size={18}
              color="#111111"
            />

            <Text
              style={styles.providerTextDark}
            >
              Continue with Google
            </Text>
          </PremiumButton>

          <PremiumButton
            style={styles.providerBtnDark}
            onPress={signInWithApple}
            disabled={
              authDisabled ||
              !APPLE_LOGIN_ENABLED
            }
          >
            <Ionicons
              name="logo-apple"
              size={21}
              color="#FFFFFF"
            />

            <Text
              style={styles.providerTextLight}
            >
              Continue with Apple
            </Text>
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
    shadowOffset: {
      width: 0,
      height: 0,
    },
  },

  forgotPasswordWrap: {
    alignItems: "flex-end",
    marginTop: -2,
    marginBottom: 2,
    paddingRight: 2,
  },

  forgotPasswordText: {
    color: "#2F8CFF",
    fontSize: 13,
    fontWeight: "800",
  },

  forgotPasswordDisabled: {
    opacity: 0.5,
  },

  primaryBtn: {
    height: 52,
    backgroundColor: "#2F8CFF",
    borderRadius: 15,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.22)",
    shadowColor: "#2F8CFF",
    shadowOpacity: 0.28,
    shadowRadius: 13,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 5,
  },

  secondaryBtn: {
    height: 52,
    backgroundColor: "#15151B",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.14)",
  },

  providerBtnLight: {
    height: 50,
    borderRadius: 15,
    backgroundColor: "#F7F7F8",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",
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
    borderColor:
      "rgba(255,255,255,0.16)",
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
    backgroundColor:
      "rgba(255,255,255,0.12)",
  },

  dividerText: {
    color: "#8E8E98",
    fontSize: 13,
    fontWeight: "800",
  },
});