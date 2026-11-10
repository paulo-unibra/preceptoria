import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, session } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | undefined;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [authenticated, setAuthenticated] = useState(() =>
    Boolean(session.get()),
  );
  const me = useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => api<{ user: User }>("/auth/me", { signal }),
    enabled: authenticated,
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    function expire() {
      setAuthenticated(false);
      client.clear();
    }
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, [client]);

  async function signIn(email: string, password: string) {
    const result = await api<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });
    session.set(result.token);
    client.setQueryData(["me"], { user: result.user });
    setAuthenticated(true);
  }

  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* Encerra também sem rede. */
    } finally {
      session.clear();
      setAuthenticated(false);
      client.clear();
    }
  }

  return (
    <AuthContext
      value={{
        user: authenticated ? me.data?.user : undefined,
        loading: authenticated && me.isPending,
        error: authenticated ? me.error : null,
        retry: () => {
          void me.refetch();
        },
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) throw new Error("AuthProvider não encontrado.");
  return context;
}
