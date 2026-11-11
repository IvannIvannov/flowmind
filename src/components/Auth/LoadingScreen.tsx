import "./LoadingScreen.css";

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({
  message = "Preparing your workspace",
}: LoadingScreenProps) {
  return (
    <div
      className="fm-loading-screen"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="fm-loading-content">
        <div className="fm-loading-logo" aria-hidden="true">
          <img
            src="/flowmind-mark.svg"
            alt=""
            width={40}
            height={40}
            draggable={false}
          />
        </div>

        <div className="fm-loading-brand">
          flowmind<span>.</span>
        </div>

        <p className="fm-loading-message">{message}</p>

        <div className="fm-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <span className="fm-loading-footer">A SPACE TO THINK CLEARLY</span>
    </div>
  );
}
