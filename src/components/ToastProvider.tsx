import React from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Easing,
} from "react-native";
import { Colours } from "../theme/colours";

type ToastOptions = {
  message: string;
  duration?: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState("");
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
      setMessage("");
    });
  }, [opacity, translateY]);

  const showToast = React.useCallback(
    ({ message, duration = 1800 }: ToastOptions) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setMessage(message);
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
            <Text style={styles.text}>{message}</Text>
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
  },
  toast: {
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colours.background.card,
    borderWidth: 1,
    borderColor: Colours.ui.border,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: {
    color: Colours.text.primary,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});