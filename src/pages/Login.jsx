import { useCallback, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GoogleSignInButton from "./GoogleSignInButton";
import { rememberPlanId, routeAfterAuth } from "./authSession";
import { API_BASE } from "./restaurantApi";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planId = params.get("planId") || "";
  rememberPlanId(planId);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("texos-theme") || "light");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("texos-theme", next);
  };

  const finishSignIn = useCallback((data) => routeAfterAuth(data, navigate, planId), [navigate, planId]);

  const googleError = useCallback((message) => setError(message), []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: identity.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Login failed");
      if (!data.token || !data.ownerId) throw new Error("Invalid login response from server");
      await finishSignIn(data);
    } catch (requestError) {
      setError(requestError.message === "Failed to fetch"
        ? "Cannot connect to server. Check whether backend is running."
        : requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" data-theme={theme}>
      <header className="auth-header">
        <Link to="/" className="brand"><span className="brand-icon">T</span><span>Tex<span className="brand-highlight">OS</span></span></Link>
        <div className="auth-header-actions">
          <Link to="/" className="auth-home-btn">← Home</Link>
          <button className="theme-toggle theme-icon-button" type="button" onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>
      <main className="auth-container">
        <div className="auth-card">
          <span className="section-kicker">WELCOME BACK</span>
          <h1>Login to TexOS</h1>
          <p className="auth-subtitle">Manage your restaurant operations from one place.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="login-identity">Email or Mobile Number</label>
            <input id="login-identity" type="text" placeholder="you@example.com or mobile number" value={identity} onChange={(event) => setIdentity(event.target.value)} autoComplete="username" required />
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input id="login-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            <div className="forgot-password"><Link to="/forgot-password">Forgot password?</Link></div>
            {error && <p role="alert" style={{ color: "#ef6464", marginTop: 12 }}>{error}</p>}
            <p className="auth-policy-notice">
              By logging in, you agree to our{" "}
              <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link>
              {" "}and{" "}
              <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
            </p>
            <button type="submit" className="button auth-submit" disabled={loading}>{loading ? "Signing in..." : "Login to Account"}</button>
          </form>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && <>
            <div className="auth-divider"><span>or</span></div>
            <GoogleSignInButton onSuccess={finishSignIn} onError={googleError} />
          </>}
          <p className="auth-switch">Don't have an account? <Link to={`/signup${planId ? `?planId=${encodeURIComponent(planId)}` : ""}`}>Create account</Link></p>
        </div>
      </main>
    </div>
  );
}
