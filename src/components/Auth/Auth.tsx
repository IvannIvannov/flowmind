import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import "./Auth.css";

type AuthScreen = "login" | "register" | "check-email";

type AuthProps = {
  onAuthenticated: () => void;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export default function Auth({ onAuthenticated }: AuthProps) {
  const [screen, setScreen] = useState<AuthScreen>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function changeScreen(next: AuthScreen) {
    setScreen(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email.trim().toLowerCase(),
          password,
        },
      );

      if (authError) throw authError;

      if (!data.session) {
        throw new Error("Sign in was unsuccessful. Please try again.");
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError ?? new Error("Could not verify your account.");
      }

      setPassword("");
      onAuthenticated();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setNotice("");

    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }

    if (password.length < 12) {
      setError("Your password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (authError) throw authError;

      setPassword("");
      setConfirmPassword("");

      if (data.session) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw userError ?? new Error("Could not verify your account.");
        }

        onAuthenticated();
        return;
      }

      changeScreen("check-email");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (loading) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const { error: authError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });

      if (authError) throw authError;

      setNotice(
        "If the address is eligible, another confirmation email has been sent.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  const isRegister = screen === "register";

  return (
    <div className="fm-auth-page">
      <div className="fm-auth-brand">
        <span className="fm-auth-logo">F.</span>
        <span>FlowMind</span>
      </div>

      <main className="fm-auth-card">
        {screen === "check-email" ? (
          <>
            <div className="fm-auth-heading">
              <span className="fm-auth-eyebrow">ONE MORE STEP</span>

              <h1>Check your inbox.</h1>

              <p>We've started the verification process for your account.</p>
            </div>

            <div className="fm-auth-email-box">
              <strong>{email}</strong>

              <p>
                If a confirmation email arrives, open the link inside it. Then
                return to FlowMind and sign in.
              </p>
            </div>

            {notice && (
              <div className="fm-auth-notice" role="status">
                {notice}
              </div>
            )}

            {error && (
              <div className="fm-auth-notice fm-auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              className="fm-auth-submit"
              onClick={() => changeScreen("login")}
            >
              Go to sign in
            </button>

            <button
              type="button"
              className="fm-auth-link fm-auth-resend"
              onClick={resendConfirmation}
              disabled={loading}
            >
              {loading ? "Please wait..." : "Resend confirmation email"}
            </button>
          </>
        ) : (
          <>
            <div className="fm-auth-heading">
              <span className="fm-auth-eyebrow">YOUR PERSONAL WORKSPACE</span>

              <h1>{isRegister ? "Create your account." : "Welcome back."}</h1>

              <p>
                {isRegister
                  ? "A more organized way to work starts here."
                  : "Sign in to your FlowMind account."}
              </p>
            </div>

            <div className="fm-auth-tabs">
              <button
                type="button"
                className={!isRegister ? "active" : ""}
                aria-pressed={!isRegister}
                disabled={loading}
                onClick={() => changeScreen("login")}
              >
                Sign in
              </button>

              <button
                type="button"
                className={isRegister ? "active" : ""}
                aria-pressed={isRegister}
                disabled={loading}
                onClick={() => changeScreen("register")}
              >
                Create account
              </button>
            </div>

            {error && (
              <div className="fm-auth-notice fm-auth-error" role="alert">
                {error}
              </div>
            )}

            <form
              className="fm-auth-form"
              onSubmit={isRegister ? handleRegister : handleLogin}
            >
              {isRegister && (
                <label className="fm-auth-field">
                  <span>Full name</span>

                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                    required
                    disabled={loading}
                  />
                </label>
              )}

              <label className="fm-auth-field">
                <span>Email address</span>

                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  maxLength={254}
                  required
                  disabled={loading}
                />
              </label>

              <label className="fm-auth-field">
                <span>Password</span>

                <div className="fm-auth-password">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    minLength={isRegister ? 12 : undefined}
                    required
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {isRegister && (
                <>
                  <label className="fm-auth-field">
                    <span>Confirm password</span>

                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Repeat your password"
                      minLength={12}
                      required
                      disabled={loading}
                    />
                  </label>

                  <p className="fm-auth-hint">
                    Use at least 12 characters. Keep your password private.
                  </p>
                </>
              )}

              <button
                className="fm-auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isRegister
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <p className="fm-auth-footer">
              {isRegister ? "Already have an account?" : "New to FlowMind?"}

              <button
                type="button"
                disabled={loading}
                onClick={() => changeScreen(isRegister ? "login" : "register")}
              >
                {isRegister ? "Sign in" : "Create account"}
              </button>
            </p>
          </>
        )}
      </main>

      <p className="fm-auth-bottom">FlowMind · Focus on what matters.</p>
    </div>
  );
}
