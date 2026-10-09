import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getUsers } from "@/lib/api";
import type { User } from "@/types";
import { roleCan, type Permission } from "@/auth/permissions";

const STORAGE_KEY = "opsdash.userId";

interface AuthContextValue {
  users: User[];
  currentUser: User | null;
  loading: boolean;
  login: (id: number) => void;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const n = stored ? Number(stored) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const currentUser = useMemo(
    () => users.find((u) => u.id === userId) ?? null,
    [users, userId],
  );

  const login = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    setUserId(id);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUserId(null);
  }, []);

  const can = useCallback(
    (permission: Permission) => roleCan(currentUser?.role, permission),
    [currentUser],
  );

  const value = useMemo(
    () => ({ users, currentUser, loading, login, logout, can }),
    [users, currentUser, loading, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
