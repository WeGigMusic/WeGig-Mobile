import React from "react";
import { Alert, AppState, Modal, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AnalyticsConsent from "./AnalyticsConsent";
import { readAnalyticsConsent, saveAnalyticsConsent } from "../lib/analyticsConsent";
import { startAnalytics, stopAnalytics } from "../lib/analytics";
import { supabase } from "../lib/supabase";

type Preference = { accepted: boolean | null; busy: boolean; choose: (value: boolean) => Promise<void> };
const Context = React.createContext<Preference>({ accepted: null, busy: true, choose: async () => {} });
export const useAnalyticsPreference = () => React.useContext(Context);

export function AnalyticsPreference({userId, email, children}: React.PropsWithChildren<{userId: string; email?: string}>) {
  const [accepted, setAccepted] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(true);
  const [prompt, setPrompt] = React.useState(false);
  const epoch = React.useRef(0);
  const alive = React.useRef(false);
  const saving = React.useRef(false);
  const refreshQueue = React.useRef(Promise.resolve());
  const pendingKey = `wegig.analytics.withdrawal.${userId}`;
  const current = (n: number) => alive.current && epoch.current === n;
  const verify = async () => (await supabase.auth.getSession()).data.session?.user.id === userId;
  React.useEffect(() => {
    alive.current = true;
    const refresh = async () => {
      if (saving.current) return;
      const n = ++epoch.current;
      stopAnalytics();
      setBusy(true);
      refreshQueue.current = refreshQueue.current.then(async () => {
        try {
          if (!current(n) || !(await verify()) || !current(n)) return;
          const pendingWithdrawal = await AsyncStorage.getItem(pendingKey);
          if (!current(n)) return;
          if (pendingWithdrawal) {
            await saveAnalyticsConsent(userId, false);
            if (!current(n)) return;
            await AsyncStorage.removeItem(pendingKey);
          }
          const value = await readAnalyticsConsent(userId);
          if (!current(n) || !(await verify()) || !current(n)) return;
          setAccepted(value);
          setPrompt(value === null);
          if (value === true && AppState.currentState === "active") await startAnalytics(userId, email);
        } catch {
          if (current(n)) {
            setAccepted(false);
            setPrompt(false);
          }
        } finally {
          if (current(n)) setBusy(false);
        }
      });
    };
    void refresh();
    const sub = AppState.addEventListener("change", state => {
      if (state === "active") void refresh();
      else { stopAnalytics(); if (!saving.current) ++epoch.current; }
    });
    return () => { alive.current = false; ++epoch.current; stopAnalytics(); sub.remove(); };
  }, [userId, email]);
  const choose = async (value: boolean) => {
    if (saving.current || busy) return;
    saving.current = true;
    const n = ++epoch.current;
    stopAnalytics();
    setBusy(true);
    if (!value) { setAccepted(false); setPrompt(false); }
    let withdrawalQueued = false;
    try {
      if (!value) {
        await AsyncStorage.setItem(pendingKey, "1");
        withdrawalQueued = true;
      }
      if (!(await verify()) || !current(n)) return;
      await saveAnalyticsConsent(userId, value);
      await AsyncStorage.removeItem(pendingKey);
      if (!current(n) || !(await verify()) || !current(n)) return;
      setAccepted(value); setPrompt(false);
      if (value && AppState.currentState === "active") await startAnalytics(userId, email);
    } catch {
      if (current(n)) {
        setAccepted(false);
        setPrompt(false);
        if (withdrawalQueued) {
          Alert.alert("Analytics turned off", "We’ll sync this choice when you next open WeGig with a connection.");
        } else {
          Alert.alert("Unable to save preference", "Analytics is off for now. Please try saving your preference again.");
        }
      }
    } finally { saving.current = false; if (current(n)) setBusy(false); }
  };
  return <Context.Provider value={{accepted, busy, choose}}>
    {children}
    <Modal visible={prompt} transparent animationType="fade" onRequestClose={() => void choose(false)}>
      <View style={{flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.55)"}}>
        <AnalyticsConsent saving={busy} onChoice={choose} />
      </View>
    </Modal>
  </Context.Provider>;
}
