import React from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  StyleSheet,
  Pressable,
  View,
} from "react-native";
import { Colours } from "../theme/colours";

type HelpScreenProps = {
  onBack?: () => void;
};

function FaqItem(props: { question: string; answer: string; isLast?: boolean }) {
  return (
    <View style={[styles.faqItem, props.isLast ? styles.faqItemLast : null]}>
      <Text style={styles.faqQuestion}>{props.question}</Text>
      <Text style={styles.faqAnswer}>{props.answer}</Text>
    </View>
  );
}

export default function HelpScreen({ onBack }: HelpScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
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
      >
        <Text style={styles.title}>Help</Text>
        <Text style={styles.intro}>
          A few quick answers to get you going with WeGig.
        </Text>

        <View style={styles.card}>
          <FaqItem
            question="What is WeGig?"
            answer="WeGig helps you keep track of the gigs you have been to, look back on live music memories, and discover what is coming next."
          />
          <FaqItem
            question="How do I add a gig?"
            answer="Go to the Add tab, fill in the gig details, and save it to your list."
          />
          <FaqItem
            question="Can I edit my profile?"
            answer="Yes. On the Profile screen you can update your display name, city, avatar and haptics settings."
          />
          <FaqItem
            question="Can I export my gigs?"
            answer="Not yet. Export is planned for a future update."
          />
          <FaqItem
            question="How do I report a bug or share an idea?"
            answer="Open Send feedback from your Profile screen and send us the details."
            isLast
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Need more help?</Text>
          <Text style={styles.body}>
            If something is not working properly or you have a question, use the
            feedback form and we will review it.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colours.background.app,
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

  sectionTitle: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 8,
  },

  faqItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colours.ui.divider ?? Colours.ui.border,
  },

  faqItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  faqQuestion: {
    color: Colours.text.primary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 6,
  },

  faqAnswer: {
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 19,
  },

  body: {
    color: Colours.text.muted,
    fontWeight: "500",
    fontSize: 14,
    lineHeight: 20,
  },
});