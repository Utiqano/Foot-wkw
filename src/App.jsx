import { useState, useEffect } from "react";
import Login from "./Login";
import Chat from "./Chat";
import MatchDay from "./MatchDay";
import { supabase } from "./supabaseClient";
import "./index.css";

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("chat");

  useEffect(() => {
    // Check session on load
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user);
    });

    // Listen to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>⚽ Football Pro</h2>
        </div>

        {/* Match Day Widget */}
        <MatchDay user={user} />

        {/* Navigation */}
        <nav className="sidebar-nav">
          <button
            onClick={() => setCurrentPage("chat")}
            className={currentPage === "chat" ? "active" : ""}
          >
            💬 Chat en direct
          </button>
          {/* You can add more pages here later */}
        </nav>

        <div className="sidebar-footer">
          <p>{user.email}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="logout-btn"
          >
            Déconnexion
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        {currentPage === "chat" && <Chat user={user} />}
      </div>
    </div>
  );
}

export default App;
