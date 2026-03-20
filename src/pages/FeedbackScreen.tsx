import React from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  StyleSheet,
  Pressable,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  TextInput,
} from "react-native";
import { Colours } from "../theme/colours";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";

type FeedbackScreenProps = {
  onBack?: () => void;
};

type FeedbackType = "Bug" | "Idea" | "General";

function TypeChip(props: {
  label: FeedbackType;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        props.active ? styles.chipActive : null,
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Text
        style={[styles.chipText, props.active ? styles.chipTextActive : null]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export default function FeedbackScreen({ onBack }: FeedbackScreenProps) {
  const messageRef = React.useRef<TextInput | null>(null);
  const replyEmailRef = React.useRef<TextInput | null>(null);

  const [type, setType] = React.useState<FeedbackType>("General");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [replyEmail, setReplyEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject) {
      Alert.alert("Missing subject", "Please add a short subject.");
      return;
    }

    if (!trimmedMessage) {
      Alert.alert("Missing message", "Please tell us a bit more.");
      return;
    }

    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      Alert.alert(
        "Feedback sent",
        "Thanks for sharing this with us. We really appreciate it.",
      );

      setType("General");
      setSubject("");
      setMessage("");
      setReplyEmail("");
      Keyboard.dismiss();

      onBack?.();
    } catch {
      Alert.alert("Error", "Something went wrong while sending feedback.");
    } finally {
      setSubmitting(false);
    }
  }, [message, onBack, subject]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.flex}>
            {onBack ? (
              <View style={styles.header}>
                <Pressable onPress={onBack} style={styles.backButton}>
                  <Text style={styles.backText}>‹ Back</Text>
                </Pressable>
              </View>
            ) : null}

            <ScrollView
              style={styles.container}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>Send feedback</Text>
              <Text style={styles.intro}>
                Found a bug, got an idea, or want to suggest something? Send it
                here.
              </Text>

              <View style={styles.card}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.chipRow}>
                  <TypeChip
                    label="Bug"
                    active={type === "Bug"}
                    onPress={() => setType("Bug")}
                  />
                  <TypeChip
                    label="Idea"
                    active={type === "Idea"}
                    onPress={() => setType("Idea")}
                  />
                  <TypeChip
                    label="General"
                    active={type === "General"}
                    onPress={() => setType("General")}
                  />
                </View>

                <View style={styles.fieldGap} />

                <TextField
                  label="Subject"
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="e.g. Search is not showing results"
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  onSubmitEditing={() => messageRef.current?.focus()}
                />

                <View style={styles.fieldGap} />

                <TextField
                  ref={messageRef}
                  label="Message"
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what happened or what you would like to see"
                  autoCapitalize="sentences"
                  multiline
                  numberOfLines={6}
                  returnKeyType="next"
                  blurOnSubmit
                  onSubmitEditing={() => replyEmailRef.current?.focus()}
                />

                <View style={styles.fieldGap} />

                <TextField
                  ref={replyEmailRef}
                  label="Reply email (optional)"
                  value={replyEmail}
                  onChangeText={setReplyEmail}
                  placeholder="e.g. name@email.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    void handleSubmit();
                  }}
                />

                <Text style={styles.helperText}>
                  This is an MVP form for now. Later this can post to your
                  backend and save feedback properly.
                </Text>

                <PrimaryButton
                  title={submitting ? "Sending…" : "Send feedback"}
                  onPress={handleSubmit}
                  disabled={submitting}
                />
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colours.background.app,
  },

  flex: {
    flex: 1,
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },

  backText: {
    color: Colours.brand.primary,
    fontSize: 16,
    fontWeight: "700",
  },

  container: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colours.text.primary,
    marginBottom: 4,
  },

  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: Colours.text.muted,
    marginBottom: 4,
  },

  card: {
    backgroundColor: Colours.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    padding: 16,
  },

  label: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 10,
  },

  chipRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  chipActive: {
    backgroundColor: "rgba(47,140,255,0.18)",
    borderColor: "rgba(47,140,255,0.45)",
  },

  chipText: {
    color: Colours.text.muted,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 16,
  },

  chipTextActive: {
    color: Colours.text.primary,
  },

  fieldGap: {
    height: 12,
  },

  helperText: {
    marginTop: 10,
    marginBottom: 14,
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 18,
  },
});