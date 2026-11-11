import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";

import { supabase } from "../../lib/supabase";

import "./FeedbackModal.css";

type FeedbackCategory = "bug" | "feature" | "general";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

const APP_VERSION = "1.0.0";

function SmilingFace() {
  return (
    <div className="fm-feedback-face" aria-hidden="true">
      <svg viewBox="0 0 88 88" width="88" height="88" fill="none">
        <circle cx="44" cy="44" r="39" className="fm-feedback-face-outline" />

        <path d="M31 30V38" className="fm-feedback-face-eye" />

        <path d="M57 30V38" className="fm-feedback-face-eye" />

        <path d="M29 55Q44 55 59 55" className="fm-feedback-face-mouth" />
      </svg>
    </div>
  );
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    if (!success) {
      subjectRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !sendingRef.current) {
        event.preventDefault();
        onClose();
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const elements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
        ),
      );

      if (!elements.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose, success]);

  function resetForm() {
    setCategory("bug");
    setSubject("");
    setMessage("");
    setError("");
    setSuccess(false);
  }

  function closeModal() {
    if (sendingRef.current) return;

    onClose();
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sendingRef.current) return;

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (cleanSubject.length < 3 || cleanSubject.length > 120) {
      setError("Subject must contain between 3 and 120 characters.");
      return;
    }

    if (cleanMessage.length < 20 || cleanMessage.length > 5000) {
      setError("Message must contain between 20 and 5000 characters.");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { error: insertError } = await supabase
        .from("feedback_reports")
        .insert({
          user_id: user.id,
          category,
          subject: cleanSubject,
          message: cleanMessage,
          app_version: APP_VERSION,
        });

      if (insertError) {
        throw insertError;
      }

      setSuccess(true);
    } catch (cause) {
      console.error("FlowMind: feedback submission failed", cause);

      setError(
        "We couldn't send your report. Please check your connection and try again.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fm-feedback-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="fm-feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fm-feedback-title"
      >
        <div className="fm-feedback-header">
          <div>
            <p className="fm-feedback-eyebrow">FLOWMIND SUPPORT</p>

            <h2 id="fm-feedback-title">Help & Feedback</h2>

            <p className="fm-feedback-intro">Help us make FlowMind better.</p>
          </div>

          <button
            type="button"
            className="fm-feedback-close"
            onClick={closeModal}
            disabled={sending}
            aria-label="Close feedback"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="fm-feedback-success" role="status">
            <SmilingFace />

            <h3>Thank you for your feedback.</h3>

            <p>Your message has been submitted successfully.</p>

            <button
              type="button"
              className="fm-feedback-primary"
              onClick={closeModal}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            className="fm-feedback-form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="fm-feedback-field">
              <label htmlFor="fm-feedback-category">
                What can we help you with?
              </label>

              <select
                id="fm-feedback-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as FeedbackCategory);
                }}
                disabled={sending}
              >
                <option value="bug">Report a problem</option>

                <option value="feature">Suggest a feature</option>

                <option value="general">General feedback</option>
              </select>
            </div>

            <div className="fm-feedback-field">
              <label htmlFor="fm-feedback-subject">Subject</label>

              <input
                ref={subjectRef}
                id="fm-feedback-subject"
                type="text"
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setError("");
                }}
                placeholder="Briefly describe your feedback"
                maxLength={120}
                disabled={sending}
                required
              />
            </div>

            <div className="fm-feedback-field">
              <label htmlFor="fm-feedback-message">Message</label>

              <textarea
                id="fm-feedback-message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setError("");
                }}
                placeholder={
                  "Tell us what happened, what you were trying to do, or what you'd like to see improved."
                }
                rows={6}
                maxLength={5000}
                disabled={sending}
                required
              />

              <span className="fm-feedback-counter">
                {message.length} / 5000
              </span>
            </div>

            <p className="fm-feedback-privacy">
              Your report will include your account ID and FlowMind version.
              Please avoid sharing passwords or sensitive information.
            </p>

            {error && (
              <div className="fm-feedback-error" role="alert">
                {error}
              </div>
            )}

            <div className="fm-feedback-footer">
              <button
                type="button"
                className="fm-feedback-secondary"
                onClick={closeModal}
                disabled={sending}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="fm-feedback-primary"
                disabled={sending}
              >
                {sending ? "Sending..." : "Send report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
