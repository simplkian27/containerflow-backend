import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

type Props = {
  message: string;
  domainValue?: string;
  onRetry?: () => void;
};

export function ApiConfigNotice({ message, domainValue, onRetry }: Props) {
  const theme = Colors.light;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.cardSurface, borderColor: theme.cardBorder },
        ]}
      >
        <Text style={[styles.title, { color: theme.text }]}>API configuration required</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>{message}</Text>

        <View
          style={[
            styles.codeBox,
            { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>EXPO_PUBLIC_DOMAIN</Text>
          <Text style={[styles.codeValue, { color: theme.text }]}>
            {domainValue || "(not set)"}
          </Text>
        </View>

        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Use localhost:5000 for local dev or your deployed domain (https://your-domain/api). Restart
          Expo after changing .env.
        </Text>

        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.textOnPrimary }]}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    borderWidth: 1,
    gap: Spacing.lg,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    ...Typography.h3,
  },
  body: {
    ...Typography.body,
  },
  codeBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  codeLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  codeValue: {
    ...Typography.bodyBold,
  },
  hint: {
    ...Typography.small,
    lineHeight: 22,
  },
  button: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  buttonText: {
    ...Typography.bodyBold,
    letterSpacing: 0.3,
  },
});
