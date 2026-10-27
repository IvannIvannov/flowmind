import "./App.css";

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="logo">✦ FlowMind</h2>

        <nav className="navigation">
          <button className="nav-item active">🏠 Dashboard</button>

          <button className="nav-item">✅ My Tasks</button>

          <button className="nav-item">📁 Projects</button>

          <button className="nav-item">📅 Calendar</button>

          <button className="nav-item">🧠 AI Assistant</button>

          <button className="nav-item">⚙️ Settings</button>
        </nav>

        <div className="sidebar-footer">
          <p>FlowMind v0.1.0</p>
        </div>
      </aside>

      <main className="content">
        <header className="page-header">
          <div>
            <p className="subtitle">YOUR PERSONAL WORKSPACE</p>

            <h1>Welcome to FlowMind 👋</h1>

            <p className="description">
              Organize your tasks, projects and ideas in one place.
            </p>
          </div>
        </header>

        <section className="welcome-card">
          <div className="card-icon">✨</div>

          <h2>Your workspace is ready!</h2>

          <p>
            This is the beginning of your personal AI-powered productivity
            assistant.
          </p>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <p>Total Tasks</p>
            <h2>0</h2>
            <span>No tasks created yet</span>
          </div>

          <div className="stat-card">
            <p>In Progress</p>
            <h2>0</h2>
            <span>Nothing in progress</span>
          </div>

          <div className="stat-card">
            <p>Completed</p>
            <h2>0</h2>
            <span>Let's get productive!</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
