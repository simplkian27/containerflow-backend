import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  getPendingActions,
  removePendingAction,
  setLastSyncTime,
  getLastSyncTime,
  formatLastSync,
  PendingAction,
} from "@/lib/offline-storage";
import { apiRequest, buildApiUrl } from "@/lib/query-client";

interface NetworkContextType {
  isOnline: boolean;
  pendingActionsCount: number;
  lastSyncText: string;
  syncPendingActions: () => Promise<void>;
  isSyncing: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [lastSyncText, setLastSyncText] = useState("Never");
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const checkConnectivity = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(buildApiUrl("/health"), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      setIsOnline(response.ok);
      return response.ok;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  const updatePendingCount = useCallback(async () => {
    const actions = await getPendingActions();
    setPendingActionsCount(actions.length);
  }, []);

  const updateLastSyncText = useCallback(async () => {
    const timestamp = await getLastSyncTime();
    setLastSyncText(formatLastSync(timestamp));
  }, []);

  const syncPendingActions = useCallback(async () => {
    if (isSyncing) return;
    
    const online = await checkConnectivity();
    if (!online) return;

    setIsSyncing(true);
    try {
      const actions = await getPendingActions();
      
      for (const action of actions) {
        try {
          await apiRequest(action.method, action.endpoint, action.body);
          await removePendingAction(action.id);
        } catch (error) {
          console.error("Failed to sync action:", action.id, error);
        }
      }

      await setLastSyncTime();
      await updateLastSyncText();
      await updatePendingCount();
      
      queryClient.invalidateQueries();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, checkConnectivity, queryClient, updateLastSyncText, updatePendingCount]);

  useEffect(() => {
    checkConnectivity();
    updatePendingCount();
    updateLastSyncText();

    const interval = setInterval(() => {
      checkConnectivity();
      updateLastSyncText();
    }, 30000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkConnectivity();
        syncPendingActions();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [checkConnectivity, updatePendingCount, updateLastSyncText, syncPendingActions]);

  useEffect(() => {
    if (isOnline && pendingActionsCount > 0) {
      syncPendingActions();
    }
  }, [isOnline, pendingActionsCount, syncPendingActions]);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        pendingActionsCount,
        lastSyncText,
        syncPendingActions,
        isSyncing,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
