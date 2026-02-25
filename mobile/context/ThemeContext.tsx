import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { useThemeStore } from "../store/theme";

type ThemeContextValue = { isDark: boolean };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = useThemeStore((s) => s.theme);
  const isDark =
    theme === "system" ? scheme === "dark" : theme === "dark";
  return (
    <ThemeContext.Provider value={{ isDark }}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  const scheme = useColorScheme();
  if (ctx) return ctx;
  return { isDark: scheme === "dark" };
}
