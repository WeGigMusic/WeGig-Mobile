import React from "react";
import { Animated, StyleSheet, Text, View, Easing } from "react-native";
import { Colours } from "../theme/colours";

type ToastOptions = {
  message?: string;
  title?: string;
  eyebrow?: string;
  icon?: string;
  duration?: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined,
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastOptions | null>(null);
  const [visible, setVisible] = React.useState(false);

  const translateY = React.useRef(new Animated.Value(24)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 24,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setToast(null);
    });
  }, [opacity, translateY]);

  const showToast = React.useCallback(
    ({
      message,
      title,
      eyebrow,
      icon,
      duration = 2200,
    }: ToastOptions) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setToast({
        message,
        title,
        eyebrow,
        icon,
        duration,
      });
      setVisible(true);

      opacity.setValue(0);
      translateY.setValue(24);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [hideToast, opacity, translateY],
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {visible ? (
        <View pointerEvents="none" style={styles.portal}>
          <Animated.View
            style={[
              styles.toast,
              {
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.toastContent}>
              {toast?.eyebrow ? (
                <Text style={styles.eyebrow}>{toast.eyebrow}</Text>
              ) : null}

              <View style={styles.titleRow}>
                {toast?.icon ? <Text style={styles.icon}>{toast.icon}</Text> : null}

                <Text style={styles.title}>
                  {toast?.title ?? toast?.message}
                </Text>
              </View>

              {toast?.message && toast?.title ? (
                <Text style={styles.text}>{toast.message}</Text>
              ) : null}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);

  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return ctx;
}

const styles = StyleSheet.create({
  portal: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    alignItems: "center",
    zIndex: 999,
    elevation: 999,
  },

  toast: {
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "rgba(23,25,28,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  toastContent: {
    alignItems: "center",
  },

  eyebrow: {
    color: Colours.text.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },

  icon: {
    fontSize: 20,
    lineHeight: 24,
  },

  title: {
    color: Colours.text.primary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    textAlign: "center",
  },

  text: {
    marginTop: 6,
    color: Colours.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});