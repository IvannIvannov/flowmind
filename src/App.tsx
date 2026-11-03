/*
 * FlowMind application entry.
 *
 * AuthGate checks the current account before
 * rendering the private workspace.
 *
 * The previous localStorage-based application
 * must not be mounted for authenticated users.
 */

export { default } from "./components/Auth/AuthGate";
