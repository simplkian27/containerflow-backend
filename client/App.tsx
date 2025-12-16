import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { Feather } from "@expo/vector-icons";

import { QueryClientProvider } from "@tanstack/react-query";
import { getApiDiagnostics, queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { ThemeProvider, useThemeContext } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/Toast";
import { ApiConfigNotice } from "@/components/ApiConfigNotice";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { isDark } = useThemeContext();

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <NavigationContainer>
          <RootStackNavigator />
        </NavigationContainer>
        <StatusBar style={isDark ? "light" : "dark"} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [domainValue, setDomainValue] = useState<string | undefined>(
    process.env.EXPO_PUBLIC_DOMAIN,
  );

  const validateApiConfig = useCallback(() => {
    try {
      const diagnostics = getApiDiagnostics();
      setDomainValue(diagnostics.raw);
      setConfigError(null);
    } catch (error) {
      setConfigError(
        error instanceof Error
          ? error.message
          : "API configuration missing. Set EXPO_PUBLIC_DOMAIN.",
      );
    }
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          ...Feather.font,
        });
      } catch (e) {
        console.warn("Error loading fonts:", e);
      } finally {
        validateApiConfig();
        setAppIsReady(true);
      }
    }

    prepare();
  }, [validateApiConfig]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  if (configError) {
    return (
      <View style={styles.root} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <ApiConfigNotice
            message={configError}
            domainValue={domainValue}
            onRetry={validateApiConfig}
          />
        </SafeAreaProvider>
      </View>
    );
  }

  return (
    <View style={styles.root} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <AuthProvider>
                  <NetworkProvider>
                    <AppContent />
                  </NetworkProvider>
                </AuthProvider>
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
