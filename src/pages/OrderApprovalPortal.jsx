import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE, shortOrderId } from "./restaurantApi";
import { useLiveUpdates } from "./useLiveUpdates";
import "./OrderApprovalPortal.css";

const SESSION_KEY = "texos-order-approval-session";
const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number(value || 0));
const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const decodeVapidKey = (key) => {
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
};

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.detail || `Request failed (HTTP ${response.status}).`);
  return data;
}

export default function OrderApprovalPortal() {
  const { accessToken } = useParams();
  const navigate = useNavigate();
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || "");
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [actionOrderId, setActionOrderId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const initialOrdersLoaded = useRef(false);
  const initialOrdersRequestInFlight = useRef(false);
  const notifiedOrderIds = useRef(new Set());

  const registerPushSubscription = useCallback(async (token) => {
    const config = await request("/api/public/order-approval/push-config");
    if (!config?.enabled || !config.publicKey) {
      throw new Error("Phone notifications are not configured by the TexOS administrator.");
    }
    const registration = await navigator.serviceWorker.register("/order-approval-sw.js");
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(config.publicKey),
      });
    }
    await request("/api/order-approval/staff/push-subscriptions", token, {
      method: "POST",
      body: JSON.stringify(subscription.toJSON()),
    });
  }, []);

  const loadOrders = useCallback(async (token, initial = false) => {
    const data = await request("/api/order-approval/staff/orders", token);
    const pending = Array.isArray(data) ? data : [];
    if (initial && !initialOrdersLoaded.current) {
      pending.forEach((order) => notifiedOrderIds.current.add(String(order.id)));
      initialOrdersLoaded.current = true;
    } else {
      pending.forEach((order) => {
        const key = String(order.id);
        if (!notifiedOrderIds.current.has(key)) {
          notifiedOrderIds.current.add(key);
          if (notificationsEnabled && "serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then((registration) =>
              registration.showNotification("New order needs approval", {
                body: `${order.tableNumber || "Table"} · ${money(order.totalAmount)}`,
                tag: `order-approval-${key}`,
                data: { url: "/order-approval" },
              }),
            ).catch(() => setNotice("An order is waiting for approval."));
          } else {
            setNotice("A new customer order is waiting for approval.");
          }
        }
      });
    }
    setOrders(pending);
  }, [notificationsEnabled]);

  const refreshOrders = useCallback(async (initial = false) => {
    const isInitialLoad = initial || !initialOrdersLoaded.current;
    if (isInitialLoad && initialOrdersRequestInFlight.current) return;
    if (isInitialLoad) initialOrdersRequestInFlight.current = true;
    try {
      await loadOrders(sessionToken, isInitialLoad);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not refresh pending orders.");
    } finally {
      if (isInitialLoad) initialOrdersRequestInFlight.current = false;
    }
  }, [loadOrders, sessionToken]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try {
        if (accessToken) {
          navigate("/order-approval", { replace: true });
          return;
        }
        const token = sessionStorage.getItem(SESSION_KEY);
        if (!token) {
          return;
        }
        const account = await request("/api/order-approval/staff/me", token);
        if (!active) return;
        if (!account?.restaurantId) throw new Error("Your staff access is no longer active.");
        setSessionToken(token);
        setRestaurant(account);
      } catch (requestError) {
        if (active) {
          sessionStorage.removeItem(SESSION_KEY);
          setSessionToken("");
          setRestaurant(null);
          setError(requestError.message || "This link or staff session is invalid or has been revoked.");
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [accessToken, navigate]);

  async function verifyCode(event) {
    event.preventDefault();
    setVerifyingCode(true);
    setError("");
    try {
      const session = await request("/api/public/order-approval/verify", "", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      sessionStorage.setItem(SESSION_KEY, session.token);
      setSessionToken(session.token);
      setRestaurant(session);
      setCode("");
    } catch (requestError) {
      setError(requestError.message || "That code is invalid, expired, or already used.");
    } finally {
      setVerifyingCode(false);
    }
  }

  useLiveUpdates({
    enabled: Boolean(sessionToken && restaurant?.restaurantId),
    token: sessionToken,
    subscriptions: [{
      destination: `/topic/restaurants/${restaurant?.restaurantId}/order-approval`,
      onMessage: () => refreshOrders(),
    }],
    onConnected: () => refreshOrders(),
    fallbacks: [{ intervalMs: 5000, callback: () => refreshOrders() }],
  });

  useEffect(() => {
    if (!sessionToken || !restaurant?.restaurantId) return;
    refreshOrders(true);
  }, [refreshOrders, restaurant?.restaurantId, sessionToken]);

  useEffect(() => {
    if (!sessionToken || typeof Notification === "undefined"
      || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    registerPushSubscription(sessionToken)
      .then(() => setNotificationsEnabled(true))
      .catch((requestError) => {
        setNotificationsEnabled(false);
        setError(requestError.message || "Could not register phone notifications.");
      });
  }, [registerPushSubscription, sessionToken]);

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setError("This browser does not support phone notifications. Keep this page open to see new requests.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted. Keep this page open to see new requests.");
        return;
      }
      await registerPushSubscription(sessionToken);
      setNotificationsEnabled(true);
      setNotice("Notifications enabled on this device while staff access remains active.");
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not enable notifications on this device.");
    }
  }

  async function decide(order, decision) {
    setActionOrderId(order.id);
    setError("");
    setNotice("");
    try {
      await request(`/api/order-approval/staff/orders/${order.id}/${decision}`, sessionToken, { method: "POST" });
      setOrders((current) => current.filter((item) => item.id !== order.id));
      notifiedOrderIds.current.delete(String(order.id));
      setNotice(decision === "approve" ? "Order approved and sent to the restaurant kitchen." : "Order rejected; it will not be sent to the kitchen.");
    } catch (requestError) {
      setError(requestError.message || "Could not update this order.");
      if (sessionToken) {
        try { await loadOrders(sessionToken); } catch { /* The original action error is more useful here. */ }
      }
    } finally {
      setActionOrderId(null);
    }
  }

  async function logout() {
    try {
      const registration = await navigator.serviceWorker.getRegistration("/order-approval-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await request(`/api/order-approval/staff/push-subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`, sessionToken, { method: "DELETE" });
        await subscription.unsubscribe();
      }
    } catch (requestError) {
      setError(requestError.message || "Could not remove phone notifications from this device.");
    }
    try {
      await request("/api/order-approval/staff/logout", sessionToken, { method: "POST" });
    } catch (requestError) {
      setError(requestError.message || "Could not end the staff session.");
    } finally {
      sessionStorage.removeItem(SESSION_KEY);
      setSessionToken("");
      setRestaurant(null);
      setOrders([]);
      setNotice("Staff session ended.");
    }
  }

  if (loading) {
    return <main className="approval-portal"><div className="approval-state">Checking staff access…</div></main>;
  }

  return (
    <main className="approval-portal">
      <header className="approval-header">
        <div>
          <span className="approval-brand">TEXOS · ORDER APPROVAL</span>
          <h1>{restaurant?.restaurantName || "Restaurant orders"}</h1>
          <p>Review incoming customer orders before they reach the kitchen.</p>
        </div>
        {restaurant && <div className="approval-header-actions">
          <span className="approval-active"><i /> Access active</span>
          <button type="button" className="approval-notification-button" onClick={enableNotifications}>
            {notificationsEnabled ? "Notifications enabled" : "Enable phone notifications"}
          </button>
          <button type="button" className="approval-logout" onClick={logout}>Sign out</button>
        </div>}
      </header>

      {restaurant && error && <div className="approval-alert error" role="alert">{error}</div>}
      {notice && <div className="approval-alert success" role="status">{notice}</div>}

      {restaurant ? <>
        <div className="approval-queue-heading">
          <div><h2>Pending orders</h2><p>Approve or reject each request. Orders refresh automatically.</p></div>
          <span>{orders.length} awaiting approval</span>
        </div>
        {orders.length === 0
          ? <div className="approval-state"><strong>No pending requests</strong><span>New customer orders will appear here automatically.</span></div>
          : <section className="approval-order-grid" aria-label="Pending customer orders">
            {orders.map((order) => <article className="approval-order-card" key={order.id}>
              <div className="approval-order-top">
                <div><span className="approval-table-label">Table</span><strong>{order.tableNumber || "—"}</strong></div>
                <span className="approval-order-active">Needs review</span>
              </div>
              <div className="approval-order-subtitle">Waiting for restaurant review</div>
              <div className="approval-order-content">
                <div className="approval-order-title-row">
                  <div><h3>{order.customerName || "New Customer Order"}</h3><span>{shortOrderId(order.orderNumber, order.id)} · {dateTime(order.createdAt)}</span></div>
                  <span className="approval-pending-badge">Pending Approval</span>
                </div>
                {order.items?.length > 0 && <div className="approval-items">
                  {order.items.map((item, index) => <div className="approval-item" key={`${item.itemId || item.itemName}-${index}`}>
                    <span><b>{item.quantity}×</b> {item.itemName}{item.customization && <small className="approval-item-customization">Request: {item.customization}</small>}</span><strong>{money(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0))}</strong>
                  </div>)}
                </div>}
                <p className="approval-order-context">{order.customerName ? `Customer: ${order.customerName}` : "Guest customer"} · Table {order.tableNumber || "—"} · {dateTime(order.createdAt)}</p>
                <div className="approval-actions">
                  <button type="button" className="approval-approve" disabled={actionOrderId === order.id} onClick={() => decide(order, "approve")}>
                    {actionOrderId === order.id ? "Please wait…" : "Approve"}
                  </button>
                  <button type="button" className="approval-reject" disabled={actionOrderId === order.id} onClick={() => decide(order, "reject")}>Reject</button>
                </div>
              </div>
            </article>)}
          </section>}
      </> : <form className="approval-code-form" onSubmit={verifyCode}>
        <span className="approval-brand">TEXOS · STAFF ACCESS</span>
        <h2>Order Approval Access</h2>
        <p>Enter the six-digit one-time code provided by the restaurant owner.</p>
        {error && <div className="approval-alert error" role="alert">{error}</div>}
        <label htmlFor="order-approval-code">Access code</label>
        <input
          id="order-approval-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
        />
        <button type="submit" disabled={verifyingCode || code.length !== 6}>
          {verifyingCode ? "Verifying…" : "Verify & continue"}
        </button>
        <small>Codes expire after five minutes and can be used once. Ask the owner for a new code if yours expires.</small>
      </form>}
      <footer className="approval-footer">Staff access is restaurant-specific and can be revoked by the owner at any time.</footer>
    </main>
  );
}
