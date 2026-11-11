import { useCallback, useEffect, useRef, useState } from "react";

import { flushSync } from "react-dom";

import type { Page } from "../../types";
import { supabase } from "../../lib/supabase";

import FeedbackModal from "../Feedback/FeedbackModal";

import "./Sidebar.css";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onReviewLocalData?: () => void;
  onSignOut?: () => void;
  signingOut?: boolean;
  signOutDisabled?: boolean;
  saving?: boolean;
}

type Theme = "light" | "dark";

type WorkspaceStatus = "checking" | "connected" | "issue";

type IconName =
  | "dashboard"
  | "day"
  | "inbox"
  | "tasks"
  | "projects"
  | "calendar"
  | "ai"
  | "help"
  | "sun"
  | "moon";

interface NavigationItem {
  id: Page;
  label: string;
  icon: IconName;
}

const STORAGE_KEY = "flowmind-theme";
const STATUS_CHECK_INTERVAL = 60_000;

const NAVIGATION: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Overview",
    icon: "dashboard",
  },
  {
    id: "my-day",
    label: "My Day",
    icon: "day",
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: "inbox",
  },
  {
    id: "tasks",
    label: "My Tasks",
    icon: "tasks",
  },
  {
    id: "projects",
    label: "Projects",
    icon: "projects",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "calendar",
  },
  {
    id: "ai",
    label: "AI Assistant",
    icon: "ai",
  },
];

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function NavIcon({ name }: { name: IconName }) {
  let shape: React.ReactNode;

  switch (name) {
    case "dashboard":
      shape = (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      );
      break;

    case "day":
      shape = (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      );
      break;

    case "inbox":
      shape = (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 14h5l2 3h4l2-3h5" />
        </>
      );
      break;

    case "tasks":
      shape = (
        <>
          <path d="m4 7 2 2 4-4M13 7h7M4 17l2 2 4-4M13 17h7" />
        </>
      );
      break;

    case "projects":
      shape = (
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      );
      break;

    case "calendar":
      shape = (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18" />
        </>
      );
      break;

    case "ai":
      shape = (
        <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2ZM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z" />
      );
      break;

    case "help":
      shape = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 4" />
          <path d="M12 17h.01" />
        </>
      );
      break;

    case "sun":
      shape = (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      );
      break;

    case "moon":
      shape = <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />;
      break;
  }

  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
}

function Sidebar({
  currentPage,
  onNavigate,
  onReviewLocalData,
  onSignOut,
  signingOut = false,
  signOutDisabled = false,
  saving = false,
}: SidebarProps) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  const [workspaceStatus, setWorkspaceStatus] =
    useState<WorkspaceStatus>("checking");

  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const checkingRef = useRef(false);

  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    document.documentElement.style.colorScheme = theme;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn("FlowMind: could not save theme", error);
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    async function checkConnection() {
      if (!active || checkingRef.current) {
        return;
      }

      if (!navigator.onLine) {
        requestId += 1;
        setWorkspaceStatus("issue");
        return;
      }

      checkingRef.current = true;
      const currentRequest = ++requestId;

      setWorkspaceStatus("checking");

      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active || currentRequest !== requestId) {
          return;
        }

        setWorkspaceStatus(!error && user ? "connected" : "issue");
      } catch (error) {
        if (active && currentRequest === requestId) {
          console.warn("FlowMind: connection check failed", error);

          setWorkspaceStatus("issue");
        }
      } finally {
        checkingRef.current = false;
      }
    }

    function handleOnline() {
      void checkConnection();
    }

    function handleOffline() {
      requestId += 1;
      setWorkspaceStatus("issue");
    }

    function handleFocus() {
      if (!document.hidden) {
        void checkConnection();
      }
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void checkConnection();
      }
    }, STATUS_CHECK_INTERVAL);

    void checkConnection();

    return () => {
      active = false;
      requestId += 1;
      checkingRef.current = false;

      window.clearInterval(intervalId);

      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  function changeTheme(nextTheme: Theme) {
    if (nextTheme === theme) {
      return;
    }

    const root = document.documentElement;

    function updateTheme() {
      root.setAttribute("data-theme", nextTheme);
      root.style.colorScheme = nextTheme;

      flushSync(() => {
        setTheme(nextTheme);
      });
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || typeof document.startViewTransition !== "function") {
      updateTheme();
      return;
    }

    root.classList.add("fm-theme-snapshot");

    try {
      const transition = document.startViewTransition(updateTheme);

      const cleanup = () => {
        root.classList.remove("fm-theme-snapshot");
      };

      void transition.finished.then(cleanup, cleanup);
    } catch (error) {
      root.classList.remove("fm-theme-snapshot");

      console.error("FlowMind: theme transition failed", error);

      updateTheme();
    }
  }

  const statusLabel =
    workspaceStatus === "connected"
      ? "Connected"
      : workspaceStatus === "checking"
        ? "Checking connection..."
        : "Connection issue";

  const statusDescription =
    workspaceStatus === "connected"
      ? "Supabase connection verified"
      : workspaceStatus === "checking"
        ? "Checking your Supabase connection"
        : "Unable to verify your Supabase connection";

  return (
    <>
      <aside className="fm-sidebar">
        <div className="fm-sidebar-brand">
          <div className="fm-sidebar-logo" aria-hidden="true">
            <img
              src="/flowmind-mark.svg"
              alt=""
              width={27}
              height={27}
              style={{
                display: "block",
                objectFit: "contain",
              }}
            />
          </div>

          <div className="fm-sidebar-brand-text">
            <span className="fm-sidebar-name">
              flowmind<span>.</span>
            </span>

            <span className="fm-sidebar-tagline">A SPACE TO THINK CLEARLY</span>
          </div>
        </div>

        <p className="fm-sidebar-section-label">WORKSPACE</p>

        <nav className="fm-sidebar-nav" aria-label="Main navigation">
          {NAVIGATION.map((item) => {
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`fm-sidebar-link ${isActive ? "active" : ""}`}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
              >
                <span className="fm-sidebar-link-icon">
                  <NavIcon name={item.icon} />
                </span>

                <span className="fm-sidebar-link-label">{item.label}</span>

                {isActive && (
                  <span className="fm-sidebar-active-dot" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="fm-sidebar-bottom">
          <div
            className="fm-sidebar-support"
            style={{
              padding: "0 6px 12px",
            }}
          >
            <button
              type="button"
              className="fm-sidebar-link"
              onClick={() => setFeedbackOpen(true)}
              title="Help & Feedback"
            >
              <span className="fm-sidebar-link-icon">
                <NavIcon name="help" />
              </span>

              <span className="fm-sidebar-link-label">Help & Feedback</span>
            </button>
          </div>

          <div className="fm-sidebar-appearance">
            <p>APPEARANCE</p>

            <div
              className="fm-sidebar-theme-switch"
              role="group"
              aria-label="Appearance"
            >
              <button
                type="button"
                className={theme === "light" ? "active" : ""}
                aria-pressed={theme === "light"}
                onClick={() => changeTheme("light")}
                title="Light mode"
              >
                <NavIcon name="sun" />
                <span>Light</span>
              </button>

              <button
                type="button"
                className={theme === "dark" ? "active" : ""}
                aria-pressed={theme === "dark"}
                onClick={() => changeTheme("dark")}
                title="Dark mode"
              >
                <NavIcon name="moon" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          {(onReviewLocalData || onSignOut) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "0 6px 17px",
              }}
            >
              {onReviewLocalData && (
                <button
                  type="button"
                  className="fm-sidebar-link"
                  onClick={onReviewLocalData}
                >
                  <span className="fm-sidebar-link-label">
                    Review local data
                  </span>
                </button>
              )}

              {onSignOut && (
                <button
                  type="button"
                  className="fm-sidebar-link"
                  onClick={onSignOut}
                  disabled={signingOut || signOutDisabled || saving}
                >
                  <span className="fm-sidebar-link-label">
                    {signingOut ? "Signing out..." : "Sign out"}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="fm-sidebar-footer">
            <div
              className="fm-sidebar-local-status"
              title={statusDescription}
              role="status"
              aria-live="polite"
            >
              <span
                className={`fm-sidebar-status-dot ${workspaceStatus}`}
                aria-hidden="true"
              />

              <span>{statusLabel}</span>
            </div>

            <span className="fm-sidebar-version">Version 1.0.0</span>
          </div>
        </div>
      </aside>

      <FeedbackModal open={feedbackOpen} onClose={closeFeedback} />
    </>
  );
}

export default Sidebar;
