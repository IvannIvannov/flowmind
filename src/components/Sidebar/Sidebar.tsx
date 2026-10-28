import type { Page } from "../../types";

import "./Sidebar.css";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

interface NavigationItem {
  id: Page;
  label: string;
  icon: string;
}

const NAVIGATION: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "📊",
  },
  {
    id: "my-day",
    label: "My Day",
    icon: "☀️",
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: "📥",
  },
  {
    id: "tasks",
    label: "My Tasks",
    icon: "✅",
  },
  {
    id: "projects",
    label: "Projects",
    icon: "📁",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "📅",
  },
  {
    id: "ai",
    label: "AI Assistant",
    icon: "✨",
  },
];

function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar fm-sidebar">
      <div className="fm-sidebar-brand">
        <div className="fm-sidebar-logo">✦</div>

        <div className="fm-sidebar-brand-text">
          <span className="fm-sidebar-name">FlowMind</span>

          <span className="fm-sidebar-tagline">YOUR PERSONAL WORKSPACE</span>
        </div>
      </div>

      <div className="fm-sidebar-section-label">WORKSPACE</div>

      <nav className="fm-sidebar-nav" aria-label="Main navigation">
        {NAVIGATION.map((item) => {
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`fm-sidebar-link ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <span className="fm-sidebar-link-icon" aria-hidden="true">
                {item.icon}
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
        <div className="fm-sidebar-local-status">
          <span className="fm-sidebar-status-dot" />
          <span>Local workspace</span>
        </div>

        <p className="fm-sidebar-version">FlowMind v0.18.0</p>
      </div>
    </aside>
  );
}

export default Sidebar;
