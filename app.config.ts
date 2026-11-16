import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const isDev = process.env.APP_VARIANT === "development";

  return {
    ...config,
    name: isDev ? "WeGig Dev" : "WeGig",
    slug: "WeGig-Mobile",
    scheme: isDev ? "wegig-dev" : "wegig",
    ios: {
      ...config.ios,
      bundleIdentifier: isDev
        ? "com.wegig.mobile.dev"
        : "com.wegig.mobile",
    },
    android: {
      ...config.android,
      package: isDev ? "com.wegig.app.dev" : "com.wegig.app",
    },
  };
};