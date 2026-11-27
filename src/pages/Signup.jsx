import { useCallback, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GoogleSignInButton from "./GoogleSignInButton";
import { rememberPlanId, routeAfterAuth } from "./authSession";
import { API_BASE } from "./restaurantApi";

async function post(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (HTTP ${response.status})`);
  return data;
}

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planId = params.get("planId") || "";
  rememberPlanId(planId);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("texos-theme") || "light");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const finishSignIn = useCallback((data) => routeAfterAuth(data, navigate, planId), [navigate, planId]);
  const googleError = useCallback((message) => setError(message), []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!acceptedPolicies) {
      setError("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const password = String(formData.get("password") || "");
    try {
      await post("/api/owners/register", {
        restaurantName: String(formData.get("restaurantName")).trim(),
        fullName: String(formData.get("fullName")).trim(),
        email: email || null,
        phone,
        address: String(formData.get("address") || "").trim() || null,
        password,
      });
      const login = await post("/api/auth/login", { email: email || phone, password });
      if (!login.token || !login.ownerId) throw new Error("Account was created, but automatic sign-in failed. Please log in.");
      await finishSignIn(login);
    } catch (requestError) {
      setError(requestError.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("texos-theme", next);
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
        <div className="auth-card signup-card">
          <span className="section-kicker">GET STARTED WITH TEXOS</span>
          <h1>Create your account</h1>
          <p className="auth-subtitle">Start managing your restaurant smarter.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="signup-restaurant">Restaurant/Cafe Name <span>*</span></label>
            <input id="signup-restaurant" type="text" name="restaurantName" placeholder="Enter restaurant name" required maxLength={150} />
            <label htmlFor="signup-name">Owner Name <span>*</span></label>
            <input id="signup-name" type="text" name="fullName" placeholder="Enter owner name" required maxLength={100} />
            <label htmlFor="signup-email">Email Address <span>*</span></label>
            <input id="signup-email" type="email" name="email" placeholder="you@example.com" maxLength={150} autoComplete="email" />
            <label htmlFor="signup-phone">Mobile Number <span>*</span></label>
            <input id="signup-phone" type="tel" name="phone" placeholder="Enter mobile number" required maxLength={20} autoComplete="tel" />
            <label htmlFor="signup-address">Restaurant Address <span>*</span></label>
            <input id="signup-address" type="text" name="address" placeholder="Enter restaurant address" maxLength={255} />
            <label htmlFor="signup-password">Password <span>*</span></label>
            <div className="password-field">
              <input id="signup-password" type={showPassword ? "text" : "password"} name="password" placeholder="Create a password" minLength={8} maxLength={72} required autoComplete="new-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            {error && <p role="alert" style={{ color: "#ef6464", marginTop: 12 }}>{error}</p>}
            <div className="auth-policy-consent">
              <input
                type="checkbox"
                id="signup-policy-consent"
                checked={acceptedPolicies}
                onChange={(event) => setAcceptedPolicies(event.target.checked)}
                aria-label="Agree to the Terms & Conditions and Privacy Policy"
                aria-describedby="signup-policy-consent-text"
                required
              />
              <p id="signup-policy-consent-text">
                By ticking this box, I agree to the{" "}
                <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link>
                {" "}and{" "}
                <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
              </p>
            </div>
            <button type="submit" className="button auth-submit" disabled={loading || !acceptedPolicies}>{loading ? "Creating account…" : "Create Account"}</button>
          </form>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && <>
            <div className="auth-divider"><span>or</span></div>
            {acceptedPolicies
              ? <GoogleSignInButton onSuccess={finishSignIn} onError={googleError} />
              : <p className="auth-policy-required" role="status">Please accept the Terms &amp; Conditions and Privacy Policy to continue.</p>}
          </>}
          <p className="auth-switch">Already have an account? <Link to={`/login${planId ? `?planId=${encodeURIComponent(planId)}` : ""}`}>Login</Link></p>
        </div>
      </main>
    </div>
  );
}
