import PostHog from "posthog-react-native";

export const analyticsEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === "true";

let active: PostHog | undefined;
let generation = 0;
const gates = new WeakMap<PostHog, AbortController>();

class ConsentPostHog extends PostHog {
  async fetch(...args: Parameters<PostHog["fetch"]>): ReturnType<PostHog["fetch"]> {
    const gate = gates.get(this);
    if (!gate || gate.signal.aborted) throw new Error("Analytics disabled");
    const [url, options] = args;
    const request = new AbortController();
    const abort = () => request.abort();
    gate.signal.addEventListener("abort", abort);
    options.signal?.addEventListener("abort", abort);
    try {
      if (gate.signal.aborted || options.signal?.aborted) abort();
      if (request.signal.aborted) throw new Error("Analytics disabled");
      return await super.fetch(url, { ...options, signal: request.signal });
    } finally {
      gate.signal.removeEventListener("abort", abort);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

export function stopAnalytics(): void {
  generation++;
  const previous = active;
  active = undefined;
  if (previous) {
    gates.get(previous)?.abort();
    void previous.optOut().catch(() => undefined);
  }
}

export async function startAnalytics(userId: string, _email?: string): Promise<void> {
  stopAnalytics();
  const current = generation;
  if (!analyticsEnabled || !userId) return;
  const client: PostHog = new ConsentPostHog("phc_zvQgDRM5mPmUp7Q23oTPYL7WYwsuSKGDTfNbkngQ2S7K", {
    host: "https://eu.posthog.com",
    persistence: "memory",
    disableGeoip: true,
    enableSessionReplay: false,
    captureAppLifecycleEvents: false,
    defaultOptIn: false,
    preloadFeatureFlags: false,
    disableRemoteConfig: true,
    disableSurveys: true,
    before_send: (event) => generation === current && active === client ? event : null,
  });
  try {
    await client.ready();
    if (generation !== current) { await client.optOut(); return; }
    await client.optIn();
    if (generation !== current) {
      await client.optOut();
      return;
    }
    gates.set(client, new AbortController());
    active = client;
    client.identify(userId);
    client.capture("analytics_foreground_started");
    void client.flush().catch(() => undefined);
  } catch {
    if (generation === current) stopAnalytics();
    void client.optOut().catch(() => undefined);
  }
}

export const posthog = {
  capture(...args: Parameters<PostHog["capture"]>) {
    active?.capture(...args);
  },
  async flush(): Promise<void> {
    await active?.flush().catch(() => undefined);
  },
  reset: stopAnalytics,
};
