import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import Auth from "./Auth";
import "./Auth.css";

type AuthState =
  | { status: "checking" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User };

export default function AuthGate() {
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });

  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    async function verifySession() {
      const currentRequest = ++requestId;

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active || currentRequest !== requestId) {
          return;
        }

        if (authError || !user) {
          setAuthState({ status: "signed-out" });
          return;
        }

        setAuthState({
          status: "signed-in",
          user,
        });
      } catch {
        if (active && currentRequest === requestId) {
          setAuthState({ status: "signed-out" });
          setError(
            "Could not verify your session. Check your internet connection.",
          );
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        requestId += 1;
        setAuthState({ status: "signed-out" });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Avoid awaiting Supabase calls inside
        // the authentication event callback.
        void Promise.resolve().then(() => {
          if (active) {
            void verifySession();
          }
        });
      }
    });

    void verifySession();

    return () => {
      active = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, []);

  async function handleAuthenticated() {
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw authError ?? new Error("Could not verify your account.");
      }

      setAuthState({
        status: "signed-in",
        user,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not verify your account.",
      );

      setAuthState({ status: "signed-out" });
    }
  }

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signOut();

      if (authError) throw authError;

      setAuthState({ status: "signed-out" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  }

  if (authState.status === "checking") {
    return (
      <div className="fm-auth-page">
        <div className="fm-auth-brand">
          <span className="fm-auth-logo">F.</span>
          <span>FlowMind</span>
        </div>

        <p className="fm-auth-bottom">Checking your account...</p>
      </div>
    );
  }

  if (authState.status === "signed-out") {
    return (
      <>
        {error && (
          <div className="fm-auth-notice fm-auth-error" role="alert">
            {error}
          </div>
        )}

        <Auth
          onAuthenticated={() => {
            void handleAuthenticated();
          }}
        />
      </>
    );
  }

  return (
    <div className="fm-auth-page">
      <div className="fm-auth-brand">
        <span className="fm-auth-logo">F.</span>
        <span>FlowMind</span>
      </div>

      <main className="fm-auth-card fm-auth-account">
        <div className="fm-auth-heading">
          <span className="fm-auth-eyebrow">ACCOUNT CONNECTED</span>

          <h1>You're signed in.</h1>

          <p>{authState.user.email ?? "Your FlowMind account"}</p>
        </div>

        <div className="fm-auth-account-message">
          Your account is connected to Supabase.
          <p>
            We're preparing your private workspace. Your existing local tasks,
            projects and notes have not been modified.
          </p>
        </div>

        {error && (
          <div className="fm-auth-notice fm-auth-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          className="fm-auth-submit"
          disabled={signingOut}
          onClick={handleSignOut}
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </main>

      <p className="fm-auth-bottom">FlowMind · Your account is ready.</p>
    </div>
  );
}
