import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { apiRequest, getApiOrigin } from "@/lib/query-client";

export type UserRole = "driver" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

// Normalize role from backend (ADMIN/DRIVER) to lowercase (admin/driver)
function normalizeRole(role: string): UserRole {
  const normalized = role?.toLowerCase();
  return normalized === "admin" ? "admin" : "driver";
}

// Normalize user object to ensure consistent role format
function normalizeUser(user: any): AuthUser {
  return {
    ...user,
    role: normalizeRole(user.role),
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithReplit: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "@containerflow_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        
        try {
          const response = await apiRequest("GET", `/api/users/${parsedUser.id}`);
          if (response.ok) {
            const serverUser = await response.json();
            if (serverUser.isActive) {
              const updatedUser = normalizeUser({ ...parsedUser, ...serverUser });
              await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
              setUser(updatedUser);
            } else {
              await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
            }
          } else {
            await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          }
        } catch {
          setUser(parsedUser);
        }
      }
    } catch (error) {
      console.error("Failed to load stored user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    const authUser = normalizeUser(data.user);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  };

  const loginWithReplit = async () => {
    if (Platform.OS === "web") {
      const response = await apiRequest("POST", "/api/auth/replit/login", {});
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Replit login failed. Make sure you're logged into Replit.");
      }

      const authUser = normalizeUser(data.user);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);
    } else {
      const baseUrl = getApiOrigin();
      const authUrl = `${baseUrl}/__replauthLoginPage`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, "containerflow://auth");
      
      if (result.type === "success") {
        const response = await apiRequest("POST", "/api/auth/replit/login", {});
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Replit login failed");
        }

        const authUser = normalizeUser(data.user);
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        setUser(authUser);
      } else if (result.type === "cancel") {
        throw new Error("Login cancelled");
      }
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    login,
    loginWithReplit,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
