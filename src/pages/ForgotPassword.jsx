import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "./restaurantApi";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [theme] = useState(
    () => localStorage.getItem("texos-theme") || "light"
  );
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not send a password reset email.");
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Could not send a password reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" data-theme={theme}>
      <header className="auth-header">
        <Link to="/" className="brand">
          <span className="brand-icon">T</span>
          <span>
            Tex<span className="brand-highlight">OS</span>
          </span>
        </Link>
        <div className="auth-header-actions">
          <Link to="/" className="auth-home-btn">
            ← Home
          </Link>
        </div>
      </header>

      <main className="auth-container">
        <div className="auth-card">
          <span className="section-kicker">ACCOUNT RECOVERY</span>
          <h1>Forgot Password?</h1>
          <p className="auth-subtitle">
            Enter your registered email address. We'll help you reset your password.
          </p>

          {submitted ? (
            <div className="reset-message">
              <h3>Check your email</h3>
              <p>
                If an account exists for {email.trim()}, a password reset link has been sent.
                Didn't receive the email? Please check your Spam or Junk folder.
              </p>
              <button
                className="button auth-submit"
                onClick={() => setSubmitted(false)}
              >
                Try Again
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="forgot-password-email">Email Address</label>
              <input
                id="forgot-password-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              {error && <p role="alert" className="subscription-error">{error}</p>}
              <button type="submit" className="button auth-submit" disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="auth-switch">
            Remember your password? <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </main>
    </div>
  );
}