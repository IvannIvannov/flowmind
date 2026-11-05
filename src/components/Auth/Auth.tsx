import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import "./Auth.css";

type AuthScreen = "login" | "register" | "check-email";

interface AuthProps {
  onAuthenticated: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function ArrowIcon() {
  return (
    <svg
      width="19"
      height="19"
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
      width="19"
      height="19"
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
        f.
      </span>
      <span className="fm-auth-brand-name">
        flowmind<span>.</span>
      </span>
    </div>
  );
}

function EditorialPanel({
  screen,
  onChangeScreen,
  disabled,
}: {
  screen: AuthScreen;
  onChangeScreen: (screen: AuthScreen) => void;
  disabled: boolean;
}) {
  const isRegister = screen === "register";
  const isCheckEmail = screen === "check-email";

  return (
    <section className="fm-auth-editorial" aria-label="FlowMind introduction">
      <div className="fm-auth-editorial-top">
        <span className="fm-auth-editorial-label">
          THE ART OF THINKING CLEARLY
        </span>
        <span className="fm-auth-editorial-number">001 — 026</span>
      </div>

      <div className="fm-auth-editorial-center">
        <div className="fm-auth-editorial-message" key={screen}>
          <div className="fm-auth-editorial-overline">
            <span className="fm-auth-small-line" />
            YOUR PERSONAL WORKSPACE
          </div>
          <h1>
            {isRegister ? "Start" : isCheckEmail ? "Almost" : "Think"}
            <span className="fm-auth-editorial-outline">
              {isRegister ? " fresh." : isCheckEmail ? " there." : " clearly."}
            </span>
          </h1>
          <p className="fm-auth-editorial-description">
            {isRegister
              ? "Every great idea deserves a little space."
              : isCheckEmail
                ? "One last step before your workspace is ready."
                : "A little less noise. A lot more room for what matters."}
          </p>
        </div>
      </div>

      <div className="fm-auth-editorial-bottom">
        <span>LESS NOISE. MORE FOCUS.</span>
        <button
          type="button"
          className="fm-auth-editorial-switch"
          disabled={disabled}
          onClick={() =>
            onChangeScreen(isRegister || isCheckEmail ? "login" : "register")
          }
        >
          {isRegister || isCheckEmail ? "Back to sign in" : "Create your space"}
          <ArrowIcon />
        </button>
      </div>

      <span className="fm-auth-editorial-decor" aria-hidden="true">
        F.
      </span>
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
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);

  const isRegister = screen === "register";
  const isCheckEmail = screen === "check-email";

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
      }
    };
  }, []);

  function navigateTo(next: AuthScreen) {
    setScreen(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setTransitioning(true);

    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
    }

    transitionTimer.current = window.setTimeout(() => {
      setTransitioning(false);
      transitionTimer.current = null;
    }, 850);
  }

  function changeScreen(next: AuthScreen) {
    if (loading || transitioning || screen === next) return;
    navigateTo(next);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || transitioning) return;

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
    if (loading || transitioning) return;

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
          data: { full_name: name.trim() },
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

      navigateTo("check-email");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (loading || transitioning) return;

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

  const disabled = loading || transitioning;

  return (
    <div className="fm-auth-page">
      <div
        className={[
          "fm-auth-layout",
          isRegister ? "is-register" : "is-login",
          isCheckEmail ? "is-check-email" : "",
          transitioning ? "is-transitioning" : "",
        ].join(" ")}
      >
        <header className="fm-auth-global-header">
          <Brand />
          <span className="fm-auth-global-caption">
            MAKE SPACE FOR WHAT MATTERS
          </span>
        </header>

        <div className="fm-auth-stage">
          <EditorialPanel
            screen={screen}
            onChangeScreen={changeScreen}
            disabled={disabled}
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
            <div className="fm-auth-form-panel-inner">
              <div className="fm-auth-form-top">
                <span className="fm-auth-form-index">
                  {isCheckEmail
                    ? "03 / VERIFY"
                    : isRegister
                      ? "02 / CREATE"
                      : "01 / SIGN IN"}
                </span>
                <span className="fm-auth-form-index-line" />
              </div>

              <div className="fm-auth-content" key={screen}>
                <div className="fm-auth-heading">
                  <span className="fm-auth-eyebrow">
                    {isCheckEmail
                      ? "ONE MORE STEP"
                      : isRegister
                        ? "YOUR NEXT CHAPTER"
                        : "GOOD TO SEE YOU AGAIN"}
                  </span>
                  <h2>
                    {isCheckEmail ? (
                      <>
                        Check your
                        <br />
                        inbox
                      </>
                    ) : isRegister ? (
                      <>
                        Create your
                        <br />
                        account
                      </>
                    ) : (
                      <>
                        Welcome
                        <br />
                        back
                      </>
                    )}
                    <span className="fm-auth-period">.</span>
                  </h2>
                  <p>
                    {isCheckEmail
                      ? "Confirm your email to continue to FlowMind."
                      : isRegister
                        ? "Everything you need to focus, in one place."
                        : "Sign in and get back into your flow."}
                  </p>
                </div>

                {isCheckEmail ? (
                  <>
                    <div className="fm-auth-email-box">
                      <span className="fm-auth-email-label">
                        CONFIRMATION ADDRESS
                      </span>
                      <strong>{email}</strong>
                      <p>
                        If a confirmation email arrives, open the link inside
                        it. Then return to FlowMind and sign in.
                      </p>
                    </div>

                    {notice && (
                      <div className="fm-auth-notice" role="status">
                        {notice}
                      </div>
                    )}

                    {error && (
                      <div
                        className="fm-auth-notice fm-auth-error"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      className="fm-auth-submit"
                      disabled={disabled}
                      onClick={() => changeScreen("login")}
                    >
                      <span>Go to sign in</span>
                      <ArrowIcon />
                    </button>

                    <button
                      type="button"
                      className="fm-auth-link fm-auth-resend"
                      disabled={disabled}
                      onClick={() => {
                        void resendConfirmation();
                      }}
                    >
                      {loading ? "Please wait..." : "Resend confirmation email"}
                    </button>
                  </>
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
                        disabled={disabled}
                        onClick={() => changeScreen("login")}
                      >
                        Sign in
                      </button>

                      <button
                        type="button"
                        className={isRegister ? "active" : ""}
                        aria-pressed={isRegister}
                        disabled={disabled}
                        onClick={() => changeScreen("register")}
                      >
                        Create account
                      </button>
                    </div>

                    {error && (
                      <div
                        className="fm-auth-notice fm-auth-error"
                        role="alert"
                      >
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
                            disabled={disabled}
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
                          disabled={disabled}
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
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                            placeholder="Enter your password"
                            minLength={isRegister ? 8 : undefined}
                            required
                            disabled={disabled}
                          />
                          <button
                            type="button"
                            className="fm-auth-visibility"
                            disabled={disabled}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword((value) => !value)}
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
                            disabled={disabled}
                          />
                          <p className="fm-auth-hint">Minimum 8 characters.</p>
                        </div>
                      )}

                      <button
                        className="fm-auth-submit"
                        type="submit"
                        disabled={disabled}
                      >
                        <span>
                          {loading
                            ? "Please wait..."
                            : isRegister
                              ? "Create account"
                              : "Sign in"}
                        </span>
                        {loading ? (
                          <span
                            className="fm-auth-spinner"
                            aria-hidden="true"
                          />
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
                        disabled={disabled}
                        onClick={() =>
                          changeScreen(isRegister ? "login" : "register")
                        }
                      >
                        {isRegister ? "Sign in" : "Create account"}
                        <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="fm-auth-form-bottom">
                <span>PRIVATE BY DESIGN</span>
                <span>FLOWMIND © 2026</span>
              </div>
            </div>
          </section>

          <span className="fm-auth-transition-line" aria-hidden="true" />
        </div>

        <footer className="fm-auth-global-footer">
          <span>FLOWMIND — PERSONAL PRODUCTIVITY</span>
          <span>LESS NOISE / MORE FOCUS</span>
        </footer>
      </div>
    </div>
  );
}
