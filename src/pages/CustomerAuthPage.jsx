import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import "./CustomerMenu.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  return data;
}

export default function CustomerAuthPage({ mode: initialMode = "login" }) {
  const { qrToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const returnToRewards = Boolean(location.state?.returnToRewards);
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  const menuPath = `/menu/${encodeURIComponent(qrToken)}`;
  const switchMode = (next) => {
    setAcceptedPolicies(false);
    setMode(next); setError(""); setMessage("");
    navigate(`${menuPath}/${next}`, { replace: true, state: returnToRewards ? { returnToRewards: true } : null });
  };

  const submit = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if ((mode === "login" || mode === "signup") && !acceptedPolicies) {
      setError("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match."); return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await api("/api/public/customers/register", {
          method: "POST",
          body: JSON.stringify({ fullName: name.trim(), mobileNumber: mobile.trim(), email: email.trim() || null, password, qrToken }),
        });
        setMessage("Your account has been created. Please sign in to continue.");
        setMode("login");
        navigate(`${menuPath}/login`, { replace: true, state: returnToRewards ? { returnToRewards: true } : null });
        setPassword(""); setConfirmPassword("");
      } else if (mode === "login") {
        const loginRes = await api("/api/public/customers/login", {
          method: "POST",
          body: JSON.stringify({ mobileNumber: mobile.trim(), password, qrToken }),
        });
        try {
          localStorage.setItem(`texos_customer_${qrToken}`, JSON.stringify({
            authenticated: true,
            customerId: loginRes?.customerId,
            customerName: loginRes?.customerName || "Customer",
            mobileNumber: loginRes?.mobileNumber || mobile.trim(),
          }));
        } catch {}
        setMessage("You are signed in. Your restaurant rewards are ready.");
        navigate(menuPath, { replace: true, state: { customerSignedIn: true, openRewards: returnToRewards } });
      } else {
        await api("/api/public/customers/forgot-password", {
          method: "POST",
          body: JSON.stringify({ mobileNumber: mobile.trim() }),
        });
        setMessage("If an account exists for this mobile number, password reset instructions will be sent.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <main className="cm-auth-page">
      <section className="cm-modal cm-auth-card">
        <button className="cm-close" onClick={() => navigate(menuPath)} aria-label="Back to menu">×</button>
        <div className="loyalty-icon">✦</div>
        <span className="cm-eyebrow">REWARDS</span>
        <h2>{mode === "signup" ? "Create your account." : mode === "forgot-password" ? "Reset your password." : "Welcome back."}</h2>
        <p className="cm-auth-intro">
          {mode === "signup" ? "Join this restaurant's rewards program and keep track of your benefits." :
           mode === "forgot-password" ? "Enter your registered mobile number to begin resetting your password." :
           "Sign in to view your points, offers and rewards at this restaurant."}
        </p>

        {mode !== "forgot-password" && (
          <div className="cm-auth-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Login</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign Up</button>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label className="cm-field">Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" autoComplete="name" required /></label>
              <label className="cm-field">Email <span>(optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            </>
          )}
          <label className="cm-field">Mobile number<input type="tel" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Enter mobile number" autoComplete="tel" required /></label>
          {mode !== "forgot-password" && (
            <label className="cm-field">Password <div className="cm-password-wrap">
    <input
      type={showPassword ? "text" : "password"}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
      autoComplete={mode === "signup" ? "new-password" : "current-password"}
      minLength={8}
      required
    />
    <button
      type="button"
      className="cm-password-toggle"
      onClick={() => setShowPassword((prev) => !prev)}
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? "👁" : "🙈"}
    </button>
  </div>
</label>
          )}
          {mode === "signup" && (
            <label className="cm-field">Confirm password <div className="cm-password-wrap">
    <input
      type={showConfirmPassword ? "text" : "password"}
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      placeholder="Re-enter your password"
      autoComplete="new-password"
      minLength={8}
      required
    />
    <button
      type="button"
      className="cm-password-toggle"
      onClick={() => setShowConfirmPassword((prev) => !prev)}
      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
    >
      {showConfirmPassword ? "👁" : "🙈"}
    </button>
  </div>
</label>
          )}
          {mode === "login" && (
            <div className="cm-auth-forgot"><button type="button" onClick={() => switchMode("forgot-password")}>Forgot password?</button></div>
          )}
          {error && <div className="cm-error">{error}</div>}
          {message && <div className="cm-auth-message">{message}</div>}
          {mode !== "forgot-password" && (
            <div className="cm-auth-policy-consent">
              <input
                type="checkbox"
                id="customer-policy-consent"
                checked={acceptedPolicies}
                onChange={(event) => setAcceptedPolicies(event.target.checked)}
                aria-label="Agree to the Terms & Conditions and Privacy Policy"
                aria-describedby="customer-policy-consent-text"
                required
              />
              <p id="customer-policy-consent-text">
                By ticking this box, I agree to the{" "}
                <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link>
                {" "}and{" "}
                <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
              </p>
            </div>
          )}
          <button className="cm-primary full cm-auth-submit" type="submit" disabled={busy || (mode !== "forgot-password" && !acceptedPolicies)}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot-password" ? "Continue" : "Sign in"}
          </button>
        </form>

        {mode === "forgot-password" ? (
          <button className="cm-text-button" type="button" onClick={() => switchMode("login")}>Back to login</button>
        ) : mode === "login" ? (
          <p className="cm-auth-switch">Don't have an account? <button type="button" onClick={() => switchMode("signup")}>Sign up</button></p>
        ) : (
          <p className="cm-auth-switch">Already have an account? <button type="button" onClick={() => switchMode("login")}>Login</button></p>
        )}
        <button className="cm-text-button" type="button" onClick={() => navigate(menuPath)}>Back to menu</button>
        <small className="cm-auth-note">You can browse the menu and place an order without signing in.</small>
      </section>
    </main>
  );
}
