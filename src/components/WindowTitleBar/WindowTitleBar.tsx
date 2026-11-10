import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import "./WindowTitleBar.css";

const appWindow = getCurrentWindow();

function MinimizeIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1.5 6H10.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function MaximizeIcon({ maximized }: { maximized: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      {maximized ? (
        <>
          <path d="M3.5 1.5H10.5V8.5H8.5" />
          <rect x="1.5" y="3.5" width="7" height="7" />
        </>
      ) : (
        <rect x="1.5" y="1.5" width="9" height="9" />
      )}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 2L10 10M10 2L2 10" />
    </svg>
  );
}

export default function WindowTitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkMaximized() {
      try {
        const value = await appWindow.isMaximized();

        if (active) {
          setMaximized(value);
        }
      } catch (error) {
        console.error("FlowMind: could not read window state", error);
      }
    }

    void checkMaximized();

    return () => {
      active = false;
    };
  }, []);

  async function handleMinimize() {
    try {
      await appWindow.minimize();
    } catch (error) {
      console.error("FlowMind: could not minimize window", error);
    }
  }

  async function handleMaximize() {
    try {
      await appWindow.toggleMaximize();

      const currentState = await appWindow.isMaximized();
      setMaximized(currentState);
    } catch (error) {
      console.error("FlowMind: could not resize window", error);
    }
  }

  async function handleClose() {
    try {
      await appWindow.close();
    } catch (error) {
      console.error("FlowMind: could not close window", error);
    }
  }

  return (
    <header
      className="fm-titlebar"
      data-tauri-drag-region
      aria-label="Window title bar"
    >
      <div className="fm-titlebar-drag-area" data-tauri-drag-region />

      <div className="fm-titlebar-controls">
        <button
          type="button"
          className="fm-titlebar-button"
          aria-label="Minimize"
          title="Minimize"
          onClick={() => {
            void handleMinimize();
          }}
        >
          <MinimizeIcon />
        </button>

        <button
          type="button"
          className="fm-titlebar-button"
          aria-label="Maximize or restore"
          title="Maximize or restore"
          onClick={() => {
            void handleMaximize();
          }}
        >
          <MaximizeIcon maximized={maximized} />
        </button>

        <button
          type="button"
          className="fm-titlebar-button fm-titlebar-close"
          aria-label="Close"
          title="Close"
          onClick={() => {
            void handleClose();
          }}
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}
