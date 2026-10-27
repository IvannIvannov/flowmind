import "./Sidebar.css";

export type Page = "dashboard" | "tasks" | "projects" | "calendar";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const menuItems: {
  page: Page;
  icon: string;
  label: string;
}[] = [
  { page: "dashboard", icon: "🏠", label: "Dashboard" },
  { page: "tasks", icon: "✅", label: "My Tasks" },
  { page: "projects", icon: "📁", label: "Projects" },
  { page: "calendar", icon: "📅", label: "Calendar" },
];

function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="fm-sidebar">
      <div className="fm-sidebar-brand">
        <span className="fm-sidebar-symbol">✦</span>
        <h2>FlowMind</h2>
      </div>

      <nav className="fm-sidebar-navigation" aria-label="Main navigation">
        {menuItems.map((item) => (
          <button
            type="button"
            key={item.page}
            className={`fm-sidebar-item ${
              currentPage === item.page ? "active" : ""
            }`}
            aria-current={currentPage === item.page ? "page" : undefined}
            onClick={() => onNavigate(item.page)}
          >
            <span className="fm-sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="fm-sidebar-divider" />

        <button type="button" className="fm-sidebar-item" disabled>
          <span className="fm-sidebar-icon">🧠</span>
          <span>AI Assistant</span>
          <span className="fm-sidebar-soon">Soon</span>
        </button>

        <button type="button" className="fm-sidebar-item" disabled>
          <span className="fm-sidebar-icon">⚙️</span>
          <span>Settings</span>
          <span className="fm-sidebar-soon">Soon</span>
        </button>
      </nav>

      <div className="fm-sidebar-footer">
        <span className="fm-sidebar-status-dot" />
        <span>FlowMind v0.6.0</span>
      </div>
    </aside>
  );
}

export default Sidebar;
