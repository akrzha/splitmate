
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface Profile {
  id: string;
  full_name: string | null;
  default_currency: string;
  theme: "light" | "dark" | "system";
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  async function refreshProfile() {
    const { data: { user: currentUser } } =
      await supabase.auth.getUser();

    if (!currentUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error.message);
      return;
    }

    setProfile(data as Profile);
  }

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;

      const nextUser = newSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const userChanged = userIdRef.current !== nextUserId;
      userIdRef.current = nextUserId;

      setSession(newSession);
      setUser((currentUser) =>
        currentUser?.id === nextUser?.id && event !== "USER_UPDATED"
          ? currentUser
          : nextUser
      );

      if (!newSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (
        !userChanged &&
        (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")
      ) {
        return;
      }

      if (userChanged) {
        setProfile(null);
        setLoading(true);
      }

      // Run database operations outside the auth callback.
      window.setTimeout(async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", newSession.user.id)
          .single();

        if (!active) return;

        if (error) {
          console.error("Profile fetch error:", error.message);
        } else {
          setProfile(data as Profile);
        }

        setLoading(false);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
