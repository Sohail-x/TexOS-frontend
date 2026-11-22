import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "./restaurantApi";
import { getRememberedPlanId } from "./authSession";
import "./SubscriptionPage.css";

export default function GoogleOnboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_BASE}/api/auth/onboarding`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("texos-token")}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          restaurantName: values.get("restaurantName").trim(),
          phone: values.get("phone").trim(),
          address: values.get("address").trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Restaurant setup failed.");
      const restaurant = {
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName,
        phone: data.phone,
      };
      localStorage.setItem("texos-active-restaurant", String(data.restaurantId));
      localStorage.setItem("texos-restaurants", JSON.stringify([restaurant]));
      const planId = params.get("planId") || getRememberedPlanId();
      navigate(`/plans?restaurantId=${data.restaurantId}${planId ? `&planId=${encodeURIComponent(planId)}` : ""}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" data-theme={localStorage.getItem("texos-theme") || "light"}>
      <header className="auth-header"><Link to="/" className="brand"><span className="brand-icon">T</span><span>Tex<span className="brand-highlight">OS</span></span></Link></header>
      <main className="auth-container">
        <div className="auth-card">
          <span className="section-kicker">ONE LAST STEP</span>
          <h1>Set up your restaurant</h1>
          <p className="auth-subtitle">Add the restaurant and required mobile number linked to your TexOS workspace.</p>
          <form onSubmit={submit}>
            <label htmlFor="onboarding-restaurant">Restaurant Name</label>
            <input id="onboarding-restaurant" name="restaurantName" required maxLength={150} />
            <label htmlFor="onboarding-phone">Mobile Number</label>
            <input id="onboarding-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" />
            <label htmlFor="onboarding-address">Restaurant Address</label>
            <input id="onboarding-address" name="address" maxLength={255} />
            {error && <p role="alert" className="subscription-error">{error}</p>}
            <button className="button auth-submit" disabled={loading}>{loading ? "Saving…" : "Continue to plans"}</button>
          </form>
        </div>
      </main>
    </div>
  );
}
