import { useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../../lib/supabase";
import "./Auth.css";

type AuthScreen = "login" | "register" | "check-email";

interface AuthProps {
  onAuthenticated: () => void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path d="M3 21 21 3" />}
    </svg>
  );
}

function Brand() {
  return (
    <div className="fm-auth-brand">
      <span className="fm-auth-logo" aria-hidden="true">
        f
      </span>

      <span className="fm-auth-brand-name">
        flowmind<span>.</span>
      </span>
    </div>
  );
}

function EditorialPanel({
  screen,
  disabled,
  onChangeScreen,
}: {
  screen: AuthScreen;
  disabled: boolean;
  onChangeScreen: (next: AuthScreen) => void;
}) {
  const isRegister = screen === "register";
  const isCheckEmail = screen === "check-email";

  return (
    <section className="fm-auth-editorial">
      <div className="fm-auth-editorial-top">
        <Brand />
      </div>

      <div className="fm-auth-editorial-center">
        <div className="fm-auth-editorial-message" key={screen}>
          <p className="fm-auth-editorial-kicker">YOUR SPACE TO THINK</p>

          <h1>
            {isCheckEmail ? (
              <>
                Almost
                <br />
                there.
              </>
            ) : isRegister ? (
              <>
                Make it
                <br />
                yours.
              </>
            ) : (
              <>
                Make room
                <br />
                for clarity.
              </>
            )}
          </h1>

          <p className="fm-auth-editorial-description">
            {isCheckEmail
              ? "Just one more step to get started."
              : isRegister
                ? "A quieter space for everything that matters."
                : "A thoughtful place for your tasks, ideas and projects."}
          </p>
        </div>
      </div>

      <div className="fm-auth-editorial-bottom">
        <span>Focus on what matters.</span>

        <button
          type="button"
          disabled={disabled}
          className="fm-auth-editorial-action"
          onClick={() =>
            onChangeScreen(isRegister || isCheckEmail ? "login" : "register")
          }
        >
          {isRegister || isCheckEmail ? "Back to sign in" : "Create an account"}

          <ArrowIcon />
        </button>
      </div>
    </section>
  );
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

  const isRegister = screen === "register";
  const isCheckEmail = screen === "check-email";

  function resetMessagesAndPasswords() {
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  function changeScreen(next: AuthScreen) {
    if (loading || screen === next) return;

    resetMessagesAndPasswords();
    setScreen(next);
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
      setError(getErrorMessage(cause));
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

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
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

      setScreen("check-email");
      setShowPassword(false);
      setError("");
      setNotice("");
    } catch (cause) {
      setError(getErrorMessage(cause));
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
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-auth-page">
      <div
        className={`fm-auth-layout ${
          isRegister ? "is-register" : "is-login"
        } ${isCheckEmail ? "is-check-email" : ""}`}
      >
        <EditorialPanel
          screen={screen}
          disabled={loading}
          onChangeScreen={changeScreen}
        />

        <section
          className="fm-auth-form-panel"
          aria-label={
            isCheckEmail
              ? "Email confirmation"
              : isRegister
                ? "Create account"
                : "Sign in"
          }
        >
          <div className="fm-auth-form-container">
            <div className="fm-auth-form-content" key={screen}>
              <div className="fm-auth-heading">
                <p className="fm-auth-eyebrow">
                  {isCheckEmail
                    ? "EMAIL VERIFICATION"
                    : isRegister
                      ? "GET STARTED"
                      : "WELCOME BACK"}
                </p>

                <h2>
                  {isCheckEmail
                    ? "Check your inbox."
                    : isRegister
                      ? "Create an account."
                      : "Sign in to FlowMind."}
                </h2>

                <p className="fm-auth-subheading">
                  {isCheckEmail
                    ? "Confirm your email address to continue."
                    : isRegister
                      ? "Create your workspace in a few steps."
                      : "Pick up right where you left off."}
                </p>
              </div>

              {isCheckEmail ? (
                <div className="fm-auth-confirmation">
                  <div className="fm-auth-email-box">
                    <span>CONFIRMATION EMAIL</span>
                    <strong>{email}</strong>

                    <p>
                      If a confirmation email arrives, open the link inside it.
                      Then return to FlowMind and sign in.
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
                    disabled={loading}
                    onClick={() => changeScreen("login")}
                  >
                    <span>Go to sign in</span>
                    <ArrowIcon />
                  </button>

                  <button
                    type="button"
                    className="fm-auth-text-action fm-auth-resend"
                    disabled={loading}
                    onClick={() => {
                      void resendConfirmation();
                    }}
                  >
                    {loading ? "Please wait..." : "Resend confirmation email"}
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="fm-auth-tabs"
                    role="group"
                    aria-label="Account access"
                  >
                    <span
                      className="fm-auth-tabs-indicator"
                      aria-hidden="true"
                    />

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
                      <div className="fm-auth-field">
                        <label htmlFor="fm-auth-name">Full name</label>

                        <input
                          id="fm-auth-name"
                          type="text"
                          autoComplete="name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Your name"
                          maxLength={100}
                          required
                          disabled={loading}
                        />
                      </div>
                    )}

                    <div className="fm-auth-field">
                      <label htmlFor="fm-auth-email">Email address</label>

                      <input
                        id="fm-auth-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        maxLength={254}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="fm-auth-field">
                      <label htmlFor="fm-auth-password">Password</label>

                      <div className="fm-auth-password">
                        <input
                          id="fm-auth-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={
                            isRegister ? "new-password" : "current-password"
                          }
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Enter your password"
                          minLength={isRegister ? 8 : undefined}
                          required
                          disabled={loading}
                        />

                        <button
                          type="button"
                          className="fm-auth-visibility"
                          disabled={loading}
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          <EyeIcon visible={showPassword} />
                        </button>
                      </div>
                    </div>

                    {isRegister && (
                      <div className="fm-auth-field">
                        <label htmlFor="fm-auth-confirm">
                          Confirm password
                        </label>

                        <input
                          id="fm-auth-confirm"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          placeholder="Repeat your password"
                          minLength={8}
                          required
                          disabled={loading}
                        />

                        <p className="fm-auth-hint">At least 8 characters.</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="fm-auth-submit"
                      disabled={loading}
                    >
                      <span>
                        {loading
                          ? "Please wait..."
                          : isRegister
                            ? "Create account"
                            : "Sign in"}
                      </span>

                      {loading ? (
                        <span className="fm-auth-spinner" aria-hidden="true" />
                      ) : (
                        <ArrowIcon />
                      )}
                    </button>
                  </form>

                  <div className="fm-auth-footer">
                    <span>
                      {isRegister
                        ? "Already have an account?"
                        : "New to FlowMind?"}
                    </span>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        changeScreen(isRegister ? "login" : "register")
                      }
                    >
                      {isRegister ? "Sign in" : "Create account"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
