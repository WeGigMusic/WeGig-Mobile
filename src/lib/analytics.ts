import PostHog from "posthog-react-native";

export const posthog = new PostHog("phc_zvQgDRM5mPmUp7Q23oTPYL7WYwsuSKGDTfNbkngQ2S7K", {
  host: "https://eu.posthog.com",
});

posthog.debug();

posthog.capture("mobile_test_event");
void posthog.flush();