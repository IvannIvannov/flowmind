import WindowTitleBar from "./components/WindowTitleBar/WindowTitleBar";
import AuthGate from "./components/Auth/AuthGate";

import "./App.css";

function App() {
  return (
    <div className="fm-desktop-app">
      <WindowTitleBar />

      <main className="fm-desktop-content">
        <AuthGate />
      </main>
    </div>
  );
}

export default App;
