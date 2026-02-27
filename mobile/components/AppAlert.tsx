import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../context/ThemeContext";

const PRIMARY = "#E8751A";

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

type AlertType = "info" | "success" | "error";

type AppAlertProps = {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onDismiss: () => void;
};

const TYPE_CONFIG: Record<AlertType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  info: { icon: "information-circle", color: "#E8751A" },
  success: { icon: "checkmark-circle", color: "#30D158" },
  error: { icon: "alert-circle", color: "#FF3B30" },
};

export function AppAlert({
  visible,
  title,
  message,
  type = "info",
  buttons = [{ text: "OK", onPress: () => {} }],
  onDismiss,
}: AppAlertProps) {
  const { isDark } = useAppTheme();
  const bg = isDark ? "#1A1A1F" : "#FFFFFF";
  const overlay = isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)";
  const textColor = isDark ? "#FFFFFF" : "#111111";
  const subColor = isDark ? "#9A9A9E" : "#6E6E73";
  const borderColor = isDark ? "#2C2C2F" : "#E5E5EA";
  const { icon, color } = TYPE_CONFIG[type];

  const handlePress = (btn: AlertButton) => {
    onDismiss();
    btn.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={[s.overlay, { backgroundColor: overlay }]} onPress={onDismiss}>
        <Pressable style={[s.card, { backgroundColor: bg, borderColor }]} onPress={(e) => e.stopPropagation()}>
          <View style={[s.iconWrap, { backgroundColor: color + "18" }]}>
            <Ionicons name={icon} size={36} color={color} />
          </View>
          <Text style={[s.title, { color: textColor }]}>{title}</Text>
          <Text style={[s.message, { color: subColor }]}>{message}</Text>
          <View style={[s.buttons, { borderTopColor: borderColor }]}>
            {buttons.map((btn, i) => {
              const isPrimary = btn.style !== "cancel" && btn.style !== "destructive";
              const isDestructive = btn.style === "destructive";
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handlePress(btn)}
                  style={[
                    s.btn,
                    i < buttons.length - 1 && s.btnBorder,
                    { borderRightColor: borderColor },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.btnText,
                      isPrimary && { color: PRIMARY, fontWeight: "700" },
                      isDestructive && { color: "#FF3B30" },
                      !isPrimary && !isDestructive && { color: subColor },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  buttons: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
