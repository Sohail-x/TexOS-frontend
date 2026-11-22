import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE } from "./restaurantApi";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [theme] = useState(() => localStorage.getItem("texos-theme") || "light");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This password reset link is invalid or has expired. Request a new link.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Password reset failed.");
      setComplete(true);
    } catch (requestError) {
      setError(requestError.message || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" data-theme={theme}>
      <header className="auth-header">
        <Link to="/" className="brand">
          <span className="brand-icon">T</span>
          <span>Tex<span className="brand-highlight">OS</span></span>
        </Link>
        <div className="auth-header-actions">
          <Link to="/" className="auth-home-btn">← Home</Link>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-card">
          <span className="section-kicker">ACCOUNT RECOVERY</span>
          <h1>Set a new password</h1>
          {complete ? (
            <>
              <p className="auth-subtitle">Your password has been reset. You can now sign in with your new password.</p>
              <Link to="/login" className="button auth-submit">Back to Login</Link>
            </>
          ) : (
            <>
              <p className="auth-subtitle">Choose a new password for your TexOS account.</p>
              <form onSubmit={handleSubmit}>
                <label htmlFor="reset-password">New Password</label>
                <input
                  id="reset-password"
                  name="newPassword"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
                <label htmlFor="reset-password-confirm">Confirm New Password</label>
                <input
                  id="reset-password-confirm"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
                {error && <p role="alert" className="subscription-error">{error}</p>}
                <button type="submit" className="button auth-submit" disabled={loading}>
                  {loading ? "Saving…" : "Reset Password"}
                </button>
              </form>
            </>
          )}
          <p className="auth-switch">
            Remember your password? <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
