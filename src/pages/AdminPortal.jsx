import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "./restaurantApi";
import "./AdminPortal.css";

const TOKEN_KEY = "texos-admin-token";

async function adminRequest(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
  return data;
}

export default function AdminPortal() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState("");
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [granting, setGranting] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", startsAt: "", endsAt: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const filteredRestaurants = restaurants.filter((restaurant) => {
    const query = restaurantSearch.trim().toLowerCase();
    return !query
      || String(restaurant.ownerPhone || "").toLowerCase().includes(query)
      || String(restaurant.ownerEmail || "").toLowerCase().includes(query);
  });

  const loadAnnouncements = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setAnnouncements(await adminRequest("/api/admin/announcements", token));
    } catch (requestError) {
      setError(requestError.message || "Could not load announcements.");
      if (requestError.message.includes("401") || requestError.message.includes("403")) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadSubscriptions = useCallback(async () => {
    if (!token) return;
    setSubscriptionsLoading(true);
    setSubscriptionsError("");
    try {
      const [restaurantRows, availablePlans] = await Promise.all([
        adminRequest("/api/admin/subscriptions/restaurants", token),
        fetch(`${API_BASE}/api/subscriptions/plans`, { headers: { Accept: "application/json" } })
          .then(async (response) => {
            if (!response.ok) throw new Error(`Could not load plans (HTTP ${response.status}).`);
            return response.json();
          }),
      ]);
      setRestaurants(restaurantRows);
      setPlans((availablePlans || []).filter((plan) => !plan.trialPlan));
      if (restaurantRows.length) {
        setSelectedRestaurantId((current) => current || String(restaurantRows[0].restaurantId));
      }
      if (availablePlans?.length) {
        const paidPlan = availablePlans.find((plan) => !plan.trialPlan);
        if (paidPlan) setSelectedPlanId((current) => current || String(paidPlan.id));
      }
    } catch (requestError) {
      setSubscriptionsError(requestError.message || "Could not load restaurant subscriptions.");
      if (requestError.message.includes("401") || requestError.message.includes("403")) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
      }
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        loadAnnouncements();
        loadSubscriptions();
      }
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [loadAnnouncements, loadSubscriptions]);

  async function login(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await adminRequest("/api/admin/auth/login", "", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      sessionStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setPassword("");
      navigate("/texos-admin", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Admin login failed.");
    } finally {
      setSaving(false);
    }
  }

  async function createAnnouncement(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adminRequest("/api/admin/announcements", token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
        }),
      });
      setForm({ title: "", message: "", startsAt: "", endsAt: "" });
      setNotice("Announcement published.");
      await loadAnnouncements();
    } catch (requestError) {
      setError(requestError.message || "Could not publish announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(announcement, active) {
    setError("");
    try {
      await adminRequest(`/api/admin/announcements/${announcement.id}/status?active=${active}`, token, { method: "PUT" });
      await loadAnnouncements();
    } catch (requestError) {
      setError(requestError.message || "Could not update announcement.");
    }
  }

  async function deleteAnnouncement(announcement) {
    if (!window.confirm(`Delete "${announcement.title}"?`)) return;
    setError("");
    try {
      await adminRequest(`/api/admin/announcements/${announcement.id}`, token, { method: "DELETE" });
      setAnnouncements((current) => current.filter((entry) => entry.id !== announcement.id));
      setNotice("Announcement deleted.");
    } catch (requestError) {
      setError(requestError.message || "Could not delete announcement.");
    }
  }

  async function grantSubscription(event) {
    event.preventDefault();
    if (!selectedRestaurantId || !selectedPlanId) return;
    setGranting(true);
    setSubscriptionsError("");
    setNotice("");
    try {
      await adminRequest(`/api/admin/subscriptions/restaurants/${selectedRestaurantId}/grant`, token, {
        method: "POST",
        body: JSON.stringify({ planId: Number(selectedPlanId) }),
      });
      setNotice("Subscription granted without payment.");
      await loadSubscriptions();
    } catch (requestError) {
      setSubscriptionsError(requestError.message || "Could not grant the subscription.");
    } finally {
      setGranting(false);
    }
  }

  async function cancelSubscription(restaurant) {
    if (!window.confirm(`Cancel ${restaurant.restaurantName}'s current subscription?`)) return;
    setSubscriptionsError("");
    setNotice("");
    try {
      await adminRequest(`/api/admin/subscriptions/restaurants/${restaurant.restaurantId}/cancel`, token, { method: "PUT" });
      setNotice("Subscription cancelled. Access to the restaurant workspace is blocked.");
      await loadSubscriptions();
    } catch (requestError) {
      setSubscriptionsError(requestError.message || "Could not cancel the subscription.");
    }
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAnnouncements([]);
    navigate("/texos-admin/login", { replace: true });
  }

  if (!token) {
    return <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={login}>
        <span className="admin-brand-mark">T</span>
        <p className="admin-eyebrow">TEXOS ADMINISTRATION</p>
        <h1>Admin sign in</h1>
        <p>Sign in to publish platform announcements for restaurant owners.</p>
        {error && <div className="admin-alert error" role="alert">{error}</div>}
        <label>Username<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={saving}>{saving ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>;
  }

  return <main className="admin-page">
    <header className="admin-header"><div><span className="admin-brand-mark">T</span><div><p className="admin-eyebrow">TEXOS PLATFORM</p><h1>Welcome Admin, Md Sohail (Founder of TexOS)</h1></div></div><button type="button" className="admin-secondary-button" onClick={logout}>Sign out</button></header>
    {error && <div className="admin-alert error" role="alert">{error}</div>}
    {notice && <div className="admin-alert success" role="status">{notice}</div>}
    <section className="admin-card">
      <div className="admin-list-heading"><div><h2>Restaurant subscriptions</h2><p>Subscription status and expiry for all active restaurant workspaces.</p></div><div className="admin-list-tools"><input type="search" aria-label="Search owner phone or email" placeholder="Search phone or email" value={restaurantSearch} onChange={(event) => setRestaurantSearch(event.target.value)} /><button type="button" className="admin-secondary-button" disabled={subscriptionsLoading} onClick={loadSubscriptions}>Refresh</button></div></div>
      {subscriptionsError && <div className="admin-alert error" role="alert">{subscriptionsError}</div>}
      <form className="admin-form admin-grant-form" onSubmit={grantSubscription}>
        <label>Restaurant<select required value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}><option value="">Select a restaurant</option>{restaurants.map((restaurant) => <option key={restaurant.restaurantId} value={restaurant.restaurantId}>{restaurant.restaurantName} · {restaurant.ownerName}</option>)}</select></label>
        <label>Paid plan<select required value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}><option value="">Select a plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ₹{Number(plan.price).toLocaleString("en-IN")} / {plan.durationDays} days</option>)}</select></label>
        <button type="submit" disabled={granting || subscriptionsLoading || !restaurants.length || !plans.length}>{granting ? "Granting…" : "Grant without payment"}</button>
      </form>
      {subscriptionsLoading ? <p className="admin-empty">Loading restaurant subscriptions…</p> : restaurants.length === 0 ? <p className="admin-empty">No active restaurant accounts found.</p> : filteredRestaurants.length === 0 ? <p className="admin-empty">No restaurants match that phone number or email.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>RESTAURANT</th><th>OWNER</th><th>EMAIL</th><th>MOBILE</th><th>SUBSCRIPTION</th><th>EXPIRES</th><th>ACTION</th></tr></thead><tbody>
        {filteredRestaurants.map((restaurant) => <tr key={restaurant.restaurantId}><td><button type="button" className="admin-restaurant-link" onClick={() => navigate(`/texos-admin/client-data/${restaurant.restaurantId}`)}>{restaurant.restaurantName}</button></td><td>{restaurant.ownerName}</td><td>{restaurant.ownerEmail || "—"}</td><td>{restaurant.ownerPhone || "—"}</td><td><span className={restaurant.subscriptionActive ? "admin-subscription-active" : "admin-subscription-inactive"}>{restaurant.subscriptionActive ? `${restaurant.subscriptionStatus} · ${restaurant.planName}` : restaurant.subscriptionStatus}</span></td><td>{restaurant.subscriptionActive ? `${restaurant.daysUntilExpiry} day${restaurant.daysUntilExpiry === 1 ? "" : "s"}` : "—"}</td><td>{restaurant.subscriptionActive && <button type="button" className="admin-delete-button" onClick={() => cancelSubscription(restaurant)}>Cancel</button>}</td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="admin-card">
      <h2>Publish announcement</h2>
      <p>Active announcements are shown to restaurant owners in their dashboard notifications.</p>
      <form className="admin-form" onSubmit={createAnnouncement}>
        <label>Title<input required maxLength="160" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Message<textarea required maxLength="4000" rows="4" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
        <label>Starts at (optional)<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
        <label>Ends at (optional)<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
        <button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish announcement"}</button>
      </form>
    </section>
    <section className="admin-card">
      <div className="admin-list-heading"><div><h2>All announcements</h2><p>Scheduled, active and expired platform notices.</p></div><button type="button" className="admin-secondary-button" disabled={loading} onClick={loadAnnouncements}>Refresh</button></div>
      {loading ? <p className="admin-empty">Loading announcements…</p> : announcements.length === 0 ? <p className="admin-empty">No announcements have been created.</p> : <div className="admin-announcements">
        {announcements.map((announcement) => <article key={announcement.id}>
          <div><strong>{announcement.title}</strong><p>{announcement.message}</p><small>{announcement.startsAt ? `From ${new Date(announcement.startsAt).toLocaleString()}` : "Starts immediately"}{announcement.endsAt ? ` · Until ${new Date(announcement.endsAt).toLocaleString()}` : ""}</small></div>
          <div className="admin-announcement-actions"><span className={announcement.active ? "active" : ""}>{announcement.active ? "Active" : "Inactive"}</span><button type="button" className="admin-secondary-button" onClick={() => setActive(announcement, !announcement.active)}>{announcement.active ? "Deactivate" : "Activate"}</button><button type="button" className="admin-delete-button" onClick={() => deleteAnnouncement(announcement)}>Delete</button></div>
        </article>)}
      </div>}
    </section>
  </main>;
}
