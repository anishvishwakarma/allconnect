import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useAppInsets } from "../hooks/useAppInsets";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Apply left/right safe padding (landscape notches, tablets). Default true. */
  padHorizontal?: boolean;
  /** Apply top safe padding. Default false — many screens pad headers themselves. */
  padTop?: boolean;
  /** Apply bottom safe padding. Default false — tab bar / scroll padding usually handles this. */
  padBottom?: boolean;
};

/**
 * Flex root that respects OS safe areas on any device size.
 * Use on full-screen routes when content is not already inset-aware.
 */
export function ScreenBounds({
  children,
  style,
  padHorizontal = true,
  padTop = false,
  padBottom = false,
}: Props) {
  const { top, bottom, left, right, contentColumnStyle } = useAppInsets();
  return (
    <View
      style={[
        styles.root,
        padTop && { paddingTop: top },
        padBottom && { paddingBottom: bottom },
        padHorizontal && { paddingLeft: left, paddingRight: right },
        style,
      ]}
    >
      <View style={[styles.inner, contentColumnStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, width: "100%" },
});
