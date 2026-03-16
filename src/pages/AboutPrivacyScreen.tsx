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

type AboutPrivacyScreenProps = {
  onBack?: () => void;
};

export default function AboutPrivacyScreen({
  onBack,
}: AboutPrivacyScreenProps) {
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
        <Text style={styles.title}>About WeGig</Text>

 <Text style={styles.story}>
  WeGig started because we love live music but kept forgetting gigs we had been to.

  {"\n\n"}
  Most of the time we were only reminded through old photos, and that was only when we actually remembered to take them. It made us realise how many great nights were slowly being lost. We felt it was about time there was a simple way to keep a proper log so we could remember, share and record our gig journeys going forward.

  {"\n\n"}
  Live music is more than just events. It is memories, discovery and the people you shared those moments with.

  {"\n\n"}
  We built WeGig to make it easy to track the gigs you have been to, relive the nights that mattered and discover what is coming next.
</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>

          <Text style={styles.body}>
            Last updated: 16 March 2026
            {"\n\n"}
            WeGig (“we”, “our”, “us”) is a social music app that helps fans
            track gigs, discover live music, and share their gig experiences
            with friends.
            {"\n\n"}
            We collect basic account information such as display name, email
            address when sign-in is enabled, and optional profile details such
            as city.
            {"\n\n"}
            We may also collect app usage data, including gigs you add or track,
            artists and venues you interact with, badges and stats activity, and
            basic analytics such as screens viewed and feature usage.
            {"\n\n"}
            We may collect device information such as device type, operating
            system version, and anonymous crash or performance data.
            {"\n\n"}
            We use this information to personalise gig discovery, show “Next gig
            near you” recommendations, sync your gig history across devices,
            improve app performance and features, and communicate important
            updates.
            {"\n\n"}
            If you choose to provide your city or enable location features in
            future versions, WeGig may use this to improve local gig
            recommendations. We do not track precise background location.
            {"\n\n"}
            We do not sell your personal data. We may share limited data with
            analytics providers, authentication providers such as Apple or
            Google, and legal authorities if required by law.
            {"\n\n"}
            We store data using modern industry security practices, but no
            service can be completely secure.
            {"\n\n"}
            You can edit profile information, and future versions may include
            account deletion requests and gig export tools.
            {"\n\n"}
            We may update this policy as WeGig evolves.
            {"\n\n"}
            Contact: wegigapp@proton.me
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

  story: {
    fontSize: 16,
    lineHeight: 24,
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
    fontSize: 20,
    fontWeight: "700",
    color: Colours.text.primary,
    marginBottom: 12,
  },

  body: {
    fontSize: 15,
    lineHeight: 22,
    color: Colours.text.muted,
  },
});