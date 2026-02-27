import React, { createContext, useContext, useState, useCallback } from "react";
import { AppAlert, type AlertButton } from "../components/AppAlert";

type AlertState = {
  visible: boolean;
  title: string;
  message: string;
  type: "info" | "success" | "error";
  buttons: AlertButton[];
};

type AlertContextValue = {
  show: (title: string, message: string, buttons?: AlertButton[], type?: "info" | "success" | "error") => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: "",
    message: "",
    type: "info",
    buttons: [{ text: "OK" }],
  });

  const show = useCallback(
    (title: string, message: string, buttons?: AlertButton[], type: "info" | "success" | "error" = "info") => {
      setState({
        visible: true,
        title,
        message,
        type,
        buttons: buttons ?? [{ text: "OK" }],
      });
    },
    []
  );

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  return (
    <AlertContext.Provider value={{ show }}>
      {children}
      <AppAlert
        visible={state.visible}
        title={state.title}
        message={state.message}
        type={state.type}
        buttons={state.buttons}
        onDismiss={dismiss}
      />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider");
  return ctx;
}
