import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Vérifie ton email pour confirmer !");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="stars"></div>
      <div className="floating-balls">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="fball" style={{ "--delay": i }}></div>
        ))}
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="logo-area">
            <div className="big-ball">⚽</div>
            <h1>FOOTBALL PRO</h1>
            <p className="tagline">Rejoins ton équipe</p>
          </div>

          <h2>{isSignUp ? "Créer un compte" : "Connexion"}</h2>

          <form onSubmit={handleAuth} className="login-form">
            <div className="input-group">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="input-line"></span>
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="input-line"></span>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button type="submit" disabled={loading} className="login-btn-pro">
              <span>
                {loading
                  ? "Chargement..."
                  : isSignUp
                  ? "S'inscrire"
                  : "Se connecter"}
              </span>
              <div className="btn-shine"></div>
            </button>
          </form>

          <p className="switch-mode">
            {isSignUp ? "Déjà un compte ?" : "Nouveau ici ?"}{" "}
            <span
              onClick={() => setIsSignUp(!isSignUp)}
              className="switch-link"
            >
              {isSignUp ? "Se connecter" : "Créer un compte"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
