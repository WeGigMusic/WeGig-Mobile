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
          WeGig started because we love live music but kept forgetting gigs
          we had been to.
          {"\n\n"}
          Most of the time we were only reminded through old photos, and
          that was only when we actually remembered to take them. It made
          us realise how many great nights were slowly being lost. We felt
          it was about time there was a simple way to keep a proper log so
          we could remember, share and record our gig journeys going forward.
          {"\n\n"}
          Live music is more than just events. It is memories, discovery
          and the people you shared those moments with.
          {"\n\n"}
          We built WeGig to make it easy to track the gigs you have been to,
          relive the nights that mattered and discover what is coming next.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>

          <Text style={styles.body}>
            Last updated: 22 November 2026
            {"\n\n"}
            WeGig is operated by WeGig Limited. This policy explains how
            we use your information and the choices you have.
            {"\n\n"}
            Your information
            {"\n\n"}
            We use your account information and the gig details you save
            to provide WeGig, sync your gig history and display your
            personal stats. Your chosen profile name and photo are
            stored on your device.
            {"\n\n"}
            If you allow location access, we use your location to help
            suggest nearby gigs and venues. For city and venue search, rounded
            location can be sent to Google Places, directly or through
            the WeGig API. You can change this
            permission in your device settings. We do not track your
            location in the background.
            {"\n\n"}
            Optional usage analytics are off by default. If you agree,
            we use PostHog to understand which features people use and
            improve WeGig. This includes app version, build and operating system, and
            activity such as opening an artist page or setlist. These
            events do not include artist names, venues or gig dates.
            This information may be linked to your account identifier.
            {"\n\n"}
            You can change your choice under Share usage analytics in
            Profile. Declining does not restrict access to WeGig.
            Turning analytics off stops new collection on your device.
            Changes made offline may need to sync before taking effect
            on other devices. You can contact us to request deletion of
            previously collected analytics.
            {"\n\n"}
            If you make an optional contribution, Apple or Google handles
            the payment. We receive transaction details to confirm the
            contribution, recognise supporter status and handle refunds.
            We do not receive your payment card details.
            {"\n\n"}
            Sharing and storage
            {"\n\n"}
            We do not sell your personal data. We use service providers
            for hosting, account sign-in, analytics and payments. We may
            also disclose information where required by law.
            {"\n\n"}
            We use safeguards to protect your information. Account and
            gig information is kept while you use WeGig, unless you
            delete it or request account deletion.
            {"\n\n"}
            Your choices and account deletion
            {"\n\n"}
            You can edit your profile and export your gig history from
            the Profile screen.
            {"\n\n"}
            To delete your account, open Profile and select Delete account.
            This removes your sign-in account and saved gig history.
            The app also clears your saved profile, gig data and gig
            reminders from the device where you request deletion.
            {"\n\n"}
            We also request deletion of the analytics data linked to your
            account. This is processed separately and may take longer
            to complete.
            {"\n\n"}
            Limited transaction and deletion records are retained to
            handle refunds, prevent transaction reuse and keep deleted
            accounts closed. Retained purchase records are no longer
            linked to your WeGig account.
            {"\n\n"}
            Account deletion does not automatically refund contributions
            or remove copies you have exported or shared elsewhere.
            {"\n\n"}
            You can contact us to request access to, correction of or
            deletion of your personal information, or for help if you
            cannot access your account.
            {"\n\n"}
            Contact
            {"\n\n"}
            Email: help-wegig@proton.me
            {"\n\n"}
            If you are unhappy with how we handle your information, you
            can also complain to the UK Information Commissioner’s Office
            at ico.org.uk.
            {"\n\n"}
            We may update this policy as WeGig develops. The date above
            shows when it was last revised.
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
    marginBottom: 12,
    color: Colours.text.primary,
  },

  body: {
    fontSize: 15,
    lineHeight: 22,
    color: Colours.text.muted,
  },
});