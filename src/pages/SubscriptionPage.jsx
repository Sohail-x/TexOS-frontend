import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "./restaurantApi";
import { getRememberedPlanId } from "./authSession";
import "./SubscriptionPage.css";

const featureList = {
  Starter: ["QR digital menu", "Three ordering modes", "Basic order dashboard", "Digital billing", "Order history"],
  Growth: ["Everything in Starter", "Live order status", "Customer reviews", "Waiter assistance", "Basic sales analytics"],
  Premium: ["Everything in Growth", "Loyalty rewards", "Advanced analytics", "Customer management", "Offers and promotions"],
};

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${localStorage.getItem("texos-token")}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (HTTP ${response.status})`);
  return data;
}

export default function SubscriptionPage({ embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [restaurantId, setRestaurantId] = useState(params.get("restaurantId") || localStorage.getItem("texos-active-restaurant") || "");
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState({ subscriptions: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const selectedPlanId = params.get("planId") || getRememberedPlanId();
  const phonePeVerifying = Boolean(params.get("phonepePayment") && restaurantId);

  const load = useCallback(async () => {
    await Promise.resolve();
    try {
      const token = localStorage.getItem("texos-token");
      if (!token) {
        const plan = selectedPlanId ? `?planId=${encodeURIComponent(selectedPlanId)}` : "";
        navigate(`/login${plan}`, { replace: true });
        return;
      }
      // Plans are public and must remain visible even if a separate account,
      // status, or history request fails. Previously, Promise.all prevented
      // setPlans from running when any of those authenticated requests failed,
      // leaving this page with only its heading.
      const availablePlans = await fetch(`${API_BASE}/api/subscriptions/plans`, {
        headers: { Accept: "application/json" },
      }).then(async (response) => {
        if (!response.ok) throw new Error("Could not load subscription plans.");
        return response.json();
      });
      setPlans(Array.isArray(availablePlans) ? availablePlans : []);

      const account = await request("/api/auth/me");
      const restaurants = account.restaurants || [];
      const validRestaurant = restaurants.find((r) => String(r.restaurantId) === String(restaurantId))
        || restaurants[0];
      if (!validRestaurant) {
        navigate("/onboarding", { replace: true });
        return;
      }
      const resolvedId = String(validRestaurant.restaurantId);
      setRestaurantId(resolvedId);
      localStorage.setItem("texos-active-restaurant", resolvedId);
      const [current, payments] = await Promise.all([
        request(`/api/subscriptions/status?restaurantId=${encodeURIComponent(resolvedId)}`),
        request(`/api/subscriptions/history?restaurantId=${encodeURIComponent(resolvedId)}`),
      ]);
      setStatus(current);
      setHistory(payments);
    } catch (loadError) {
      setError(loadError.message || "Could not load your subscription.");
    } finally {
      setLoading(false);
    }
  }, [navigate, restaurantId, selectedPlanId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    const merchantOrderId = params.get("phonepePayment");
    if (!merchantOrderId || !restaurantId) return undefined;
    let active = true;
    let attempts = 0;
    let interval;
    const clearCallback = () => {
      const next = new URLSearchParams(location.search);
      next.delete("phonepePayment");
      navigate(`${location.pathname}${next.toString() ? `?${next}` : ""}`, { replace: true });
    };
    const verifyStatus = async () => {
      if (!active) return;
      attempts += 1;
      try {
        const payment = await request(
          `/api/subscriptions/payment-status?restaurantId=${encodeURIComponent(restaurantId)}&merchantOrderId=${encodeURIComponent(merchantOrderId)}`,
        );
        if (!active) return;
        if (payment.status === "SUCCESSFUL") {
          localStorage.removeItem("texos-pending-plan-id");
          navigate("/dashboard", { replace: true });
          return;
        }
        if (["FAILED", "CANCELLED"].includes(payment.status) || attempts >= 20) {
          setError(payment.status === "FAILED" || payment.status === "CANCELLED"
            ? "PhonePe did not confirm this subscription payment. You may retry checkout."
            : "Your payment is still being confirmed by PhonePe. Do not retry until its status is resolved.");
          setBusy("");
          window.clearInterval(interval);
          clearCallback();
        }
      } catch (verifyError) {
        if (!active) return;
        if (attempts >= 20) {
          setError(verifyError.message || "Payment status is still being confirmed by PhonePe.");
          setBusy("");
          window.clearInterval(interval);
          clearCallback();
        }
      }
    };
    verifyStatus();
    interval = window.setInterval(verifyStatus, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [location.pathname, location.search, navigate, params, restaurantId]);

  async function startTrial() {
    setBusy("trial");
    setError("");
    try {
      await request(`/api/subscriptions/trial?restaurantId=${encodeURIComponent(restaurantId)}`, { method: "POST" });
      localStorage.removeItem("texos-pending-plan-id");
      navigate("/dashboard", { replace: true });
    } catch (trialError) {
      setError(trialError.message);
    } finally {
      setBusy("");
    }
  }

  async function beginCheckout(plan) {
    setBusy(String(plan.id));
    setError("");
    try {
      const order = await request("/api/subscriptions/orders", {
        method: "POST",
        body: JSON.stringify({ restaurantId: Number(restaurantId), planId: plan.id }),
      });
      if (!order.checkoutUrl) {
        setError(order.status === "FAILED"
          ? "PhonePe could not start checkout. Please check the merchant configuration and retry."
          : "PhonePe is still confirming checkout creation. Please wait before trying again.");
        setBusy("");
        return;
      }
      window.location.assign(order.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError.message);
      setBusy("");
    }
  }

  const currentSubscription = status?.subscription;
  const formattedDate = (date) => date ? new Date(date).toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
  }) : "—";

  return (
    <div className={embedded ? "app subscription-embedded" : "app subscription-page"} data-theme={localStorage.getItem("texos-theme") || "light"}>
      {!embedded && <header className="navbar">
        <Link className="brand" to="/"><span className="brand-icon">T</span><span>Tex<span className="brand-highlight">OS</span></span></Link>
        <div className="nav-actions">{localStorage.getItem("texos-token")
          ? <Link className="theme-toggle" to="/dashboard">Dashboard</Link>
          : <Link className="theme-toggle" to="/login">Log in</Link>}</div>
      </header>}
      <main className="subscription-main">
        <div className="section-heading">
          <span className="section-kicker">TEXOS SUBSCRIPTION</span>
          <h1>{status?.entitled ? "Manage your subscription" : "Choose a plan to continue"}</h1>
          <p>Secure access to your restaurant workspace, with monthly renewal and no interruption when renewing early.</p>
        </div>
        {loading && <p className="subscription-loading">Loading your plans…</p>}
        {phonePeVerifying && <div className="subscription-notice" role="status">Confirming your payment directly with PhonePe. Please keep this page open.</div>}
        {status?.status === "PENDING" && <div className="subscription-notice" role="status">A payment is pending or being verified by PhonePe. Its server-confirmed status must resolve before another attempt can begin.</div>}
        {error && <div className="subscription-error" role="alert">{error}</div>}
        {(status?.entitled || history.payments?.length > 0) && <div className={`subscription-overview-grid ${status?.entitled ? "has-current-plan" : "history-only"}`}>
          {status?.entitled && <section className="subscription-current">
            <div><span className="section-kicker">CURRENT PLAN</span><h2>{currentSubscription?.planName}</h2><p>{currentSubscription?.status} · Valid until {formattedDate(currentSubscription?.endDate)}</p></div>
            <span className="subscription-status-pill">{currentSubscription?.status}</span>
          </section>}
          {history.payments?.length > 0 && <section className="subscription-history">
            <h2>Payment history</h2>
            <div className="subscription-history-table"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Payment reference</th></tr></thead>
              <tbody>{history.payments.map((payment) => <tr key={payment.id}><td>{formattedDate(payment.createdAt)}</td><td>₹{Number(payment.amount).toLocaleString("en-IN")} {payment.currency}</td><td>{payment.status}</td><td>{payment.paymentId || payment.orderId}</td></tr>)}</tbody>
            </table></div>
          </section>}
        </div>}
        <section className="subscription-plan-grid" aria-label="Available subscription plans">
          {plans.filter((plan) => !plan.trialPlan).map((plan) => (
            <article key={plan.id} className={`price-card ${String(plan.id) === String(selectedPlanId) ? "popular" : ""}`}>
              <h3>{plan.name}</h3>
              <p className="plan-description">{plan.description}</p>
              <div className="price"><span>₹</span>{Number(plan.price).toLocaleString("en-IN")}<small> / {plan.durationDays} days</small></div>
              <p className="billing-note">One-time monthly payment. Renew manually.</p>
              <button className="button plan-button" type="button" disabled={loading || Boolean(busy) || phonePeVerifying}
                onClick={() => beginCheckout(plan)}>{busy === String(plan.id) ? "Opening checkout…" : status?.entitled ? "Renew plan" : "Subscribe now"} <span>→</span></button>
              <div className="plan-divider" />
              <p className="included-label">WHAT'S INCLUDED</p>
              <ul>{(featureList[plan.name] || ["Full TexOS access for 30 days","Digital Menu QR","Restaurant dashboard", "Menu and order management", "Digital billing", "WhatsApp & Email Support"]).map((feature) => <li key={feature}><span>✓</span> {feature}</li>)}</ul>
            </article>
          ))}
          {!embedded && plans.filter((plan) => plan.trialPlan).map((plan) => (
            <article className="price-card trial-plan-card" key={plan.id}>
              <h3>{plan.name}</h3><p className="plan-description">{plan.description}</p>
              <div className="price"><span>₹</span>0<small> / {plan.durationDays} days</small></div>
              <p className="billing-note">One trial per restaurant.</p>
              <button className="button plan-button" type="button" disabled={loading || Boolean(busy) || phonePeVerifying || Boolean(status?.entitled) || status?.status === "PENDING"}
                onClick={startTrial}>{busy === "trial" ? "Starting trial…" : "Start free trial"} <span>→</span></button>
              <div className="plan-divider" /><p className="included-label">FULL WORKSPACE ACCESS</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
