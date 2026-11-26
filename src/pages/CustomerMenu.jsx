import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./CustomerMenu.css";
import { Client } from "@stomp/stompjs";
import { shortOrderId } from "./restaurantApi";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const localDateParam = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const pick = (...values) => values.find((v) => v !== undefined && v !== null);

const getCategoryItems = (category) =>
  pick(category.items, category.menuItems, category.menuItemResponses, category.foodItems, []) || [];

function normalizeMenu(data) {
  const categories = pick(data?.categories, data?.menuCategories, data?.categoryList, []) || [];

  return {
    restaurantName: pick(data?.restaurantName, data?.name, "Sunset Bistro"),
    address: pick(data?.address, data?.restaurantAddress, "123 Sunset Ave, Downtown"),
    phone: pick(data?.phone, data?.restaurantPhone, ""),
    openingHours: pick(data?.openingHours, "Open 11am-10pm"),
    googleMapsUrl: pick(data?.googleMapsUrl, ""),
    rewardsEnabled: pick(data?.rewardsEnabled, data?.rewardEnabled, false) === true,
    tableNumber: pick(data?.tableNumber, data?.table?.tableNumber, "Table"),
    categories: categories.map((category, index) => ({
      id: pick(category.id, category.categoryId, `category-${index}`),
      name: pick(category.categoryName, category.name, "Menu"),
      description: category.description || "",
      items: getCategoryItems(category).map((item, itemIndex) => ({
        id: pick(item.id, item.itemId, item.menuItemId, `${index}-${itemIndex}`),
        name: pick(item.itemName, item.name, "Menu item"),
        description: item.description || "",
        price: Number(pick(item.price, item.unitPrice, 0)),
        imageUrl: pick(item.imageUrl, item.image, item.photoUrl, ""),
        available: pick(item.available, item.isAvailable, true) !== false,
      })),
    })),
  };
}

function WaiterRecallButton({ waiterRequest, waiterBusy, onRecall, onCooldownError }) {
  const [now, setNow] = useState(() => Date.now());
  const cooldownEnd = Date.parse(waiterRequest?.cooldownUntil || "");
  const hasCooldown = Number.isFinite(cooldownEnd) && cooldownEnd > now;

  useEffect(() => {
    if (!Number.isFinite(cooldownEnd) || cooldownEnd <= Date.now()) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cooldownEnd]);

  const remaining = hasCooldown ? Math.max(0, Math.ceil((cooldownEnd - now) / 1000)) : 0;
  const label = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <button
      type="button"
      className={`cm-quick-action-btn cm-review-map-btn${remaining > 0 ? " cm-waiter-recall-waiting" : ""}`}
      onClick={() => {
        if (remaining > 0) {
          onCooldownError();
          return;
        }
        onRecall();
      }}
      disabled={waiterBusy}
      aria-disabled={remaining > 0}
      aria-label={remaining > 0 ? `Re-call waiter in ${label}` : "Re-call waiter"}
    >
      {waiterBusy ? "Re-calling…" : `Re-call Waiter${remaining > 0 ? ` (${label})` : ""}`}
    </button>
  );
}

function FoodImage({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="food-image food-image-fallback" aria-label={name}>
        <span>🍽️</span>
      </div>
    );
  }

  return (
    <img
      className="food-image"
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function HeartIcon({ filled }) {
  if (filled) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#ea580c" stroke="#ea580c" strokeWidth="1.5">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2b231d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function getCategoryIcon(name) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("popular") || lower.includes("special") || lower.includes("feature")) {
    return null;
  }
  if (lower.includes("start") || lower.includes("appetiz") || lower.includes("salad") || lower.includes("soup")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </svg>
    );
  }
  if (lower.includes("main") || lower.includes("curry") || lower.includes("entree") || lower.includes("dish") || lower.includes("rice") || lower.includes("bread") || lower.includes("pasta") || lower.includes("pizza") || lower.includes("bowl")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    );
  }
  if (lower.includes("dessert") || lower.includes("sweet") || lower.includes("cake") || lower.includes("ice") || lower.includes("pastry") || lower.includes("bake")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
        <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
        <path d="M2 21h20" />
        <path d="M7 8v2" /><path d="M12 8v2" /><path d="M17 8v2" />
      </svg>
    );
  }
  if (lower.includes("drink") || lower.includes("beverag") || lower.includes("juice") || lower.includes("cocktail") || lower.includes("tea") || lower.includes("coffee") || lower.includes("shake") || lower.includes("soda")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 5-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 5" />
        <path d="M3 5h18" />
        <path d="M10 5V2" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 4.24 4.24" />
      <path d="m14.83 9.17 4.24-4.24" />
      <path d="m14.83 14.83 4.24 4.24" />
      <path d="m9.17 14.83-4.24 4.24" />
    </svg>
  );
}

function QuantityControl({ quantity, onChange, compact = false }) {
  return (
    <div className={`quantity-control ${compact ? "compact" : ""}`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={(e) => {
          e.stopPropagation();
          onChange(Math.max(0, quantity - 1));
        }}
      >
        −
      </button>
      <span>{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={(e) => {
          e.stopPropagation();
          onChange(quantity + 1);
        }}
      >
        +
      </button>
    </div>
  );
}

// LoyaltyPrompt now renders as an inline card inside the Reward page (not a floating overlay).
// Auto-polling has been removed – data is loaded once when the tab opens.
// A manual "↻ Refresh reward data" button lets customers refresh on demand.
function LoyaltyPrompt({ qrToken, rewardStatus, loading, error, onManualRefresh, onLoadMore, onUseReward }) {
  const navigate = useNavigate();
  const [historyPeriod, setHistoryPeriod] = useState("lastWeek");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const returnToRewards = { returnToRewards: true };
  const authenticated = Boolean(rewardStatus?.authenticated);
  const rewards = Array.isArray(rewardStatus?.rewards) ? rewardStatus.rewards : [];
  const transactions = Array.isArray(rewardStatus?.transactions) ? rewardStatus.transactions : [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const historyStart = historyPeriod === "today"
    ? startOfToday
    : historyPeriod === "lastWeek"
      ? new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)
      : historyPeriod === "lastMonth"
        ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
        : historyFrom ? new Date(`${historyFrom}T00:00:00`) : null;
  const historyEnd = historyPeriod === "lastMonth"
    ? new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    : historyPeriod === "custom"
      ? historyTo ? new Date(`${historyTo}T23:59:59.999`) : null
      : now;
  const refreshHistory = (period = historyPeriod, customFrom = historyFrom, customTo = historyTo) => {
    if (period === "custom") {
      if (customFrom && customTo && customFrom <= customTo) onManualRefresh({ from: customFrom, to: customTo });
      return;
    }
    const end = new Date();
    const start = period === "today"
      ? new Date(end.getFullYear(), end.getMonth(), end.getDate())
      : period === "lastMonth"
        ? new Date(end.getFullYear(), end.getMonth() - 1, 1)
        : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
    const rangeEnd = period === "lastMonth"
      ? new Date(end.getFullYear(), end.getMonth(), 0)
      : end;
    onManualRefresh({ from: localDateParam(start), to: localDateParam(rangeEnd) });
  };
  const filteredTransactions = transactions.filter((item) => {
    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    return createdAt && (!historyStart || createdAt >= historyStart) && (!historyEnd || createdAt <= historyEnd);
  });

  return (
    <div className="cm-reward-inline-card">
      <div className="cm-reward-inline-header">
        <div className="loyalty-icon-inline"><span>🎁</span></div>
        <span className="cm-eyebrow">TEXOS LOYALTY PROGRAM</span>
        <button type="button" className="cm-reward-manual-refresh-btn" onClick={() => refreshHistory()} disabled={loading}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>
      {loading ? <p className="cm-modal-muted">Loading your loyalty account…</p> :
        error ? <p className="cm-error" role="alert">{error}</p> :
        !rewardStatus?.enabled ? <><h2 className="cm-reward-inline-title">Rewards are currently unavailable</h2><p className="cm-reward-inline-desc">This restaurant has not enabled its points-based loyalty program.</p></> :
        <>
          <h2 className="cm-reward-inline-title">Earn points. Enjoy rewards.</h2>
          {authenticated ? <>
            <p className="cm-reward-inline-desc">Welcome, {rewardStatus.customerName || "Customer"}.</p>
            <div className="cm-reward-progress">
              <p><span>Available points</span><strong>{Number(rewardStatus.availablePoints || 0).toLocaleString("en-IN")}</strong></p>
              <p><span>Total points earned</span><strong>{Number(rewardStatus.lifetimeEarnedPoints || 0).toLocaleString("en-IN")}</strong></p>
              <p><span>Total points redeemed</span><strong>{Number(rewardStatus.lifetimeRedeemedPoints || 0).toLocaleString("en-IN")}</strong></p>
              {Number(rewardStatus.pointsDebt || 0) > 0 && <p><span>Refund adjustment debt</span><strong>{Number(rewardStatus.pointsDebt).toLocaleString("en-IN")}</strong></p>}
            </div>
          </> : <>
            <p className="cm-reward-inline-desc">Sign in or create an account to view your personal points balance and redeem rewards at this restaurant.</p>
            <button className="cm-primary full" onClick={() => navigate(`/menu/${encodeURIComponent(qrToken)}/login`, { state: returnToRewards })}>Sign in</button>
            <button className="cm-text-button" onClick={() => navigate(`/menu/${encodeURIComponent(qrToken)}/signup`, { state: returnToRewards })}>Create an account</button>
          </>}
          <div className="cm-loyalty-rewards-list">
            <h3>Available rewards</h3>
            {rewards.length ? rewards.map((reward) => {
              const enough = authenticated && Number(rewardStatus.availablePoints || 0) >= Number(reward.pointsRequired || 0);
              return <article className="cm-loyalty-reward-card" key={reward.id}>
                {reward.imageUrl && <img src={reward.imageUrl} alt={reward.rewardName} loading="lazy" decoding="async" />}
                <div><strong>{reward.rewardName}</strong><p>{reward.description || reward.menuItemName || reward.rewardType?.replaceAll("_", " ")}</p><b>{reward.pointsRequired} points</b></div>
                {authenticated && enough
                  ? <button type="button" className="cm-loyalty-use-button" onClick={() => onUseReward(reward.id)}>Use at Checkout</button>
                  : <span>{!authenticated ? "Sign in to redeem" : "Not enough points"}</span>}
              </article>;
            }) : <p className="cm-modal-muted">No active rewards are available right now.</p>}
          </div>
          {authenticated && <div className="cm-loyalty-history">
            <div className="cm-loyalty-history-heading">
              <h3>Points history</h3>
              <div className="cm-loyalty-history-filters">
                <select aria-label="Filter points history" value={historyPeriod} onChange={(event) => { setHistoryPeriod(event.target.value); refreshHistory(event.target.value); }}>
                  <option value="lastWeek">Last week</option>
                  <option value="today">Today</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="custom">Customized Date</option>
                </select>
                {historyPeriod === "custom" && <>
                  <input aria-label="Points history start date" type="date" value={historyFrom} max={historyTo || undefined} onChange={(event) => { setHistoryFrom(event.target.value); refreshHistory("custom", event.target.value, historyTo); }} />
                  <input aria-label="Points history end date" type="date" value={historyTo} min={historyFrom || undefined} onChange={(event) => { setHistoryTo(event.target.value); refreshHistory("custom", historyFrom, event.target.value); }} />
                </>}
              </div>
            </div>
            {filteredTransactions.length ? filteredTransactions.map((item) => (
              <div className="cm-loyalty-history-row" key={item.id}>
                <span><strong>{item.description || item.type}</strong><small>{item.orderId ? `Order ${item.orderId}` : item.type} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : ""}</small></span>
                <b className={Number(item.points) >= 0 ? "positive" : "negative"}>{Number(item.points) > 0 ? "+" : ""}{item.points}</b>
              </div>
            )) : <p className="cm-modal-muted">No points history found for the selected date range.</p>}
            {rewardStatus.transactionsHasMore && <button
              type="button"
              className="cm-text-button"
              disabled={loading}
              onClick={onLoadMore}
            >
              {loading ? "Loading…" : "Load more history"}
            </button>}
          </div>}
          <div className="cm-loyalty-how"><h3>How it works</h3><ol><li>Place an eligible order.</li><li>Earn points after payment is confirmed and the order is served.</li><li>Collect points with every eligible visit.</li><li>Redeem a reward during checkout.</li></ol></div>
        </>}
    </div>
  );
}

function CheckoutModal({ cart, subtotal, tableNumber, onClose, onPlaceOrder, placing, error, rewardStatus, selectedRewardId, onSelectReward, selectedRewardPoints, onSelectRewardPoints, onLogin }) {
  const valid = cart.length > 0;
  const totalItemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="cm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="cm-modal checkout-modal">
        <div className="cm-modal-head">
          <div>
            <span className="cm-eyebrow">ORDER SUMMARY</span>
            <h2>Review your order</h2>
          </div>
          <button className="cm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="checkout-table">
          <span>Serving at</span>
          <strong>Table {tableNumber}</strong>
        </div>

        {/* Display all items added by customer */}
        <div className="cm-checkout-items-section">
          <div className="cm-checkout-items-header">
            <span className="cm-eyebrow">ITEMS IN YOUR ORDER ({totalItemCount})</span>
          </div>
          <div className="cm-checkout-items-list">
            {cart.map((item) => {
              const qty = item.quantity || 1;
              const lineTotal = (item.price || 0) * qty;
              return (
                <div className="cm-checkout-item-row" key={item.id}>
                  <div className="cm-checkout-item-left">
                    <span className="cm-checkout-item-qty">{qty}×</span>
                    <div className="cm-checkout-item-meta">
                      <strong className="cm-checkout-item-name">{item.name}</strong>
                      <span className="cm-checkout-item-unit-price">{money(item.price)} each</span>
                      {item.customization && <small className="cm-cart-customization">Request: {item.customization}</small>}
                    </div>
                  </div>
                  <strong className="cm-checkout-item-total">{money(lineTotal)}</strong>
                </div>
              );
            })}
          </div>
        </div>

        {rewardStatus?.enabled && <section className="cm-checkout-rewards">
          <h3>Use Your Reward Points</h3>
          {rewardStatus.authenticated ? <>
            <p>Available balance: <strong>{Number(rewardStatus.availablePoints || 0).toLocaleString("en-IN")} points</strong></p>
            <label htmlFor="cm-checkout-reward">Choose one reward</label>
            <select id="cm-checkout-reward" value={selectedRewardId} onChange={(event) => onSelectReward(event.target.value)}>
              <option value="">Continue without a reward</option>
              {(rewardStatus.rewards || []).filter((reward) => reward.available).map((reward) => {
                const enough = Number(rewardStatus.availablePoints || 0) >= Number(reward.pointsRequired || 0);
                const minimumMet = reward.minimumOrderAmount == null || subtotal >= Number(reward.minimumOrderAmount);
                return <option key={reward.id} value={reward.id} disabled={!enough || !minimumMet}>
                  {reward.rewardName} — {reward.pointsRequired} points{!enough ? " (Not enough points)" : !minimumMet ? " (Minimum order not met)" : ""}
                </option>;
              })}
            </select>
            <label htmlFor="cm-checkout-points">Or redeem points</label>
            <input id="cm-checkout-points" type="number" min={Number(rewardStatus.minimumRedemptionPoints || 1)} max={Number(rewardStatus.availablePoints || 0)} step="1" value={selectedRewardPoints} onChange={(event) => onSelectRewardPoints(event.target.value)} placeholder={`Up to ${Number(rewardStatus.availablePoints || 0)} points`} />
            {Number(selectedRewardPoints || 0) > 0 && <>
              <p>Conversion: <strong>{Number(rewardStatus.conversionPoints || 100)} points = ₹{Number(rewardStatus.conversionInr || 10).toLocaleString("en-IN", {maximumFractionDigits:2})}</strong></p>
              <p>Estimated discount: <strong>{money(Number(rewardStatus.conversionInr || 10) * Number(selectedRewardPoints || 0) / Number(rewardStatus.conversionPoints || 100))}</strong></p>
            </>}
            {selectedRewardId && <p className="cm-checkout-reward-note">The selected reward will be validated and applied by TexOS before the order is created.</p>}
          </> : <><p>Sign in to your restaurant loyalty account to redeem points.</p><button type="button" className="cm-text-button" onClick={onLogin}>Sign in to use points</button></>}
        </section>}
        <div className="checkout-total">
          <span>Total ({totalItemCount} {totalItemCount === 1 ? "item" : "items"})</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <p className="checkout-tax-note">Taxes and service charges, if applicable, will be calculated on your bill.</p>
        {error && <div className="cm-error">{error}</div>}

        <button
          className="cm-primary full"
          disabled={!valid || placing}
          onClick={() => onPlaceOrder({ payment: "PAY_LATER" })}
        >
          {placing ? "Placing order…" : `Confirm & Place Order • ${money(subtotal)}`}
        </button>
        <p className="secure-note">No payment is collected at this step.</p>
      </section>
    </div>
  );
}

function OrderTracker({ order, onBackToMenu, qrToken }) {
  const [liveOrder, setLiveOrder] = useState(order);
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const refreshOrder = async () => {
    if (!liveOrder?.orderNumber || !qrToken) return;
    setManualRefreshing(true);
    setRefreshError("");
    try {
      const rows = await api(`/api/public/orders?qrToken=${encodeURIComponent(qrToken)}`);
      const latest = Array.isArray(rows)
        ? rows.find((entry) => String(entry.orderNumber) === String(liveOrder.orderNumber))
        : null;
      if (latest) setLiveOrder((current) => ({ ...current, ...latest }));
      else setRefreshError("This order could not be refreshed. Please try again.");
    } catch (error) {
      setRefreshError(error.message || "Could not refresh order status.");
    } finally {
      setManualRefreshing(false);
    }
  };

  const status = liveOrder?.orderStatus || "NEW";
  const trackingComplete = status === "SERVED";
  const approvalStatus = liveOrder?.approvalStatus || "NOT_REQUIRED";
  const awaitingApproval = approvalStatus === "PENDING";
  const approvalRejected = approvalStatus === "REJECTED";

  const steps = [
    { key: "NEW", label: "Order received" },
    { key: "ACCEPTED", label: "Order accepted" },
    { key: "PREPARING", label: "Preparing your food" },
    { key: "READY", label: "Food is ready" },
    { key: "SERVED", label: "Order served" },
  ];

  useEffect(() => {
    if (!liveOrder?.orderNumber) return;
    const wsUrl = `${API_BASE.replace(/^http/, "ws")}/ws`;
    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      onConnect: () => {
        setConnectionStatus("CONNECTED");
        client.subscribe(`/topic/orders/${liveOrder.orderNumber}`, (message) => {
          try {
            const updatedOrder = JSON.parse(message.body);
            setLiveOrder((current) => ({ ...current, ...updatedOrder }));
          } catch (error) {
            console.error("Invalid order update:", error);
          }
        });
      },
      onDisconnect: () => setConnectionStatus("DISCONNECTED"),
      onWebSocketClose: () => setConnectionStatus("DISCONNECTED"),
      onStompError: (frame) => {
        console.error("WebSocket error:", frame.headers.message);
        setConnectionStatus("DISCONNECTED");
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [liveOrder?.orderNumber]);

  const cancelled = status === "CANCELLED" || approvalRejected;

  return (
    <section className="cm-order-tracker-panel">
      <div className="cm-order-tracker-card">
        <div className="success-check">{cancelled ? "!" : "✓"}</div>
        <span className="cm-eyebrow">
          {awaitingApproval ? "AWAITING STAFF APPROVAL" : cancelled ? "ORDER CANCELLED" : "LIVE ORDER TRACKING"}
        </span>
        <h2>
          {awaitingApproval
            ? "Your order is waiting for restaurant staff approval."
            : cancelled
            ? "Your order has been cancelled."
            : status === "SERVED"
            ? "Enjoy your meal!"
            : "Your order is on its way to the kitchen."}
        </h2>
        <p className="success-sub">
          {awaitingApproval
            ? "The kitchen will receive your order once staff approves it."
            : cancelled
            ? "Please contact the restaurant staff if you need assistance."
            : "This order status updates automatically in real-time."}
        </p>

        <div className="cm-tracker-refresh-row">
          <button type="button" className="cm-tracker-refresh-button" onClick={refreshOrder} disabled={manualRefreshing}>
            {manualRefreshing ? "Refreshing…" : "↻ Refresh status"}
          </button>
          {refreshError && <span role="alert">{refreshError}</span>}
        </div>

        <div className="success-order-number">
          <span>ORDER NUMBER</span>
          <strong>{shortOrderId(liveOrder.orderNumber, liveOrder.id)}</strong>
          <small>{liveOrder.tableNumber || "Your table"} · {status}</small>
        </div>

        {!cancelled && !awaitingApproval && (
          <div className="order-tracker">
            <div className="tracker-top">
              <div>
                <span className="tracker-label">ORDER STATUS (Click Refresh button to see the latest order status)</span>
                <h3>{status.replaceAll("_", " ")}</h3>
              </div>
              <span className={`tracker-live ${trackingComplete ? "complete" : connectionStatus === "CONNECTED" ? "online" : "offline"}`}>
                {!trackingComplete && <span className="tracker-dot"></span>}
                {trackingComplete ? "COMPLETE" : connectionStatus === "CONNECTED" ? "LIVE" : "RECONNECTING"}
              </span>
            </div>

            <div className="tracker-progress">
              {steps.map((step, index) => {
                const currentIndex = steps.findIndex((s) => s.key === status);
                const completed = currentIndex >= index;
                const active = currentIndex === index;

                return (
                  <div
                    className={`tracker-step ${completed ? "completed" : ""} ${active ? "active" : ""}`}
                    key={step.key}
                  >
                    <div className="tracker-line">
                      <span className="tracker-circle">{completed ? "✓" : index + 1}</span>
                    </div>
                    <span className="tracker-step-label">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {onBackToMenu && (
          <button type="button" className="cm-primary full" style={{ marginTop: "14px" }} onClick={onBackToMenu}>
            Browse More Items
          </button>
        )}
      </div>
    </section>
  );
}

function CustomerBillModal({
  bill, loading, error, onClose, onExpired, onPayNow, paymentBusy,
  paymentState, paymentError,
}) {
  useEffect(() => {
    if (!bill?.expiresAt) return undefined;
    const delay = Math.max(0, new Date(bill.expiresAt).getTime() - Date.now());
    const timeout = window.setTimeout(onExpired, delay);
    return () => window.clearTimeout(timeout);
  }, [bill?.expiresAt, onExpired]);

  return (
    <div className="cm-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cm-modal cm-customer-bill">
        <button className="cm-close" onClick={onClose} aria-label="Close bill">×</button>
        <span className="cm-eyebrow">CUSTOMER BILL</span>
        <h2>{bill?.restaurantName || "Your bill"}</h2>
        {loading ? (
          <p className="cm-modal-muted">Loading your latest bill…</p>
        ) : error ? (
          <p className="cm-error" role="alert">{error}</p>
        ) : bill ? (
          <>
            <div className="cm-bill-meta">
              <span>{bill.tableNumber} · Bill no. : {bill.billNumber}</span>
              <span>{bill.paymentStatus}</span>
            </div>
            <div className="cm-customer-bill-items">
              {(bill.items || []).map((item, index) => (
                <div className="receipt-row" key={`${item.itemId || item.itemName}-${index}`}>
                  <span>{item.quantity} × {item.itemName}{item.customization && <small className="cm-bill-customization">Request: {item.customization}</small>}</span>
                  <strong>{money(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0))}</strong>
                </div>
              ))}
            </div>
            <div className="receipt-row">
              <span>Subtotal</span>
              <strong>{money(bill.subtotal)}</strong>
            </div>
            {Number(bill.taxAmount) > 0 && (
              <div className="receipt-row">
                <span>Tax</span>
                <strong>{money(bill.taxAmount)}</strong>
              </div>
            )}
            {Number(bill.serviceChargeAmount) > 0 && (
              <div className="receipt-row">
                <span>Service charge</span>
                <strong>{money(bill.serviceChargeAmount)}</strong>
              </div>
            )}
            {Number(bill.rewardDiscountAmount) > 0 && (
              <div className="receipt-row">
                <span>Cashback applied</span>
                <strong>−{money(bill.rewardDiscountAmount)}</strong>
              </div>
            )}
            <div className="receipt-total">
              <span>Total</span>
              <strong>{money(bill.totalAmount)}</strong>
            </div>
            <p className="cm-bill-expiry-notice">
              {bill.paymentStatus === "PAID"
                ? "This paid bill remains available for 2 hours after your latest order."
                : "This bill stays open for additional orders until payment is completed."}
            </p>
            {paymentState?.status === "SUCCESSFUL" && bill.paymentStatus === "PAID" && (
              <p className="cm-payment-state successful" role="status">
                Payment successful. Your restaurant has confirmed the payment.
              </p>
            )}
            {bill.paymentStatus === "PENDING" && bill.eligibleForOnlinePayment
              && bill.onlinePaymentAvailable && (
                <section className="cm-payment-panel" aria-label="Online bill payment">
                  <span className="cm-eyebrow">SECURE ONLINE PAYMENT</span>
                  <p>Continue to PhonePe to choose any payment method enabled for this restaurant, such as UPI, cards or net banking.</p>
                  {paymentState?.status && (
                    <p className={`cm-payment-state ${String(paymentState.status).toLowerCase()}`} role="status">
                      Payment status: {String(paymentState.status).toLowerCase().replaceAll("_", " ")}
                    </p>
                  )}
                  {paymentError && <p className="cm-error" role="alert">{paymentError}</p>}
                  <button
                    type="button"
                    className="cm-primary full"
                    onClick={onPayNow}
                    disabled={paymentBusy || ["PENDING", "PROCESSING"].includes(paymentState?.status)}
                  >
                    {paymentBusy ? "Preparing secure checkout…" : "Pay online with PhonePe"}
                  </button>
                </section>
              )}
          </>
        ) : null}
      </section>
    </div>
  );
}

function CustomerProfileView({
  session,
  tableNumber,
  googleMapsUrl,
  rewardsEnabled,
  onOpenRewards,
  onOpenBill,
  onLogout,
  logoutBusy,
  logoutError,
  paymentHistory,
  paymentHistoryError,
  qrToken,
}) {
  const navigate = useNavigate();
  const menuPath = `/menu/${encodeURIComponent(qrToken)}`;

  return (
    <section className="cm-profile-page-view">
      <div className="cm-profile-page-head">
        <span className="cm-eyebrow">CUSTOMER ACCOUNT</span>
        <h2>{session?.authenticated ? "Your Profile" : "Guest Account"}</h2>
      </div>

      <div className="cm-profile-content">
        <div className="cm-profile-avatar-row">
          <div className="cm-profile-avatar">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            {/* Show name • mobile when authenticated: Md Faiyaz • 1234567895 */}
            <h3>
              {session?.authenticated
                ? (session.mobileNumber
                    ? `${session.customerName} • ${session.mobileNumber}`
                    : session.customerName)
                : "Dine-in Guest"}
            </h3>
            <p>Serving at Table {tableNumber}</p>
          </div>
        </div>

        {!session?.authenticated ? (
          <div className="cm-profile-guest-card">
            <p className="cm-profile-guest-sub">
              No need to Login/SignUp to place an order.
            </p>
            <p className="cm-profile-guest-info">
              Sign in or register to track your visit rewards, unlock cashback, and personalize your experience.
            </p>
            <div className="cm-profile-auth-actions">
              <button
                type="button"
                className="cm-primary full"
                onClick={() => navigate(`${menuPath}/login`)}
              >
                Log in
              </button>
              <button
                type="button"
                className="cm-secondary full"
                onClick={() => navigate(`${menuPath}/signup`)}
              >
                Create an account
              </button>
            </div>
          </div>
        ) : (
          <div className="cm-profile-member-card">
            <span className="cm-eyebrow">SIGNED IN CUSTOMER</span>
            <p>Welcome back, <strong>{session.customerName}</strong>{session.mobileNumber ? ` • ${session.mobileNumber}` : ""}! Your visits and orders count toward exclusive cashback rewards.</p>
          </div>
        )}

        <div className="cm-profile-links-list">
          {/* "Track Active Order" button removed – use Track Order tab in bottom navigation instead */}

          <button
            type="button"
            className="cm-profile-link-item"
            onClick={onOpenBill}
          >
            <span>🧾 View Latest Bill</span>
            <i>→</i>
          </button>

          {rewardsEnabled && (
            <button
              type="button"
              className="cm-profile-link-item"
              onClick={onOpenRewards}
            >
              <span>🎁 Loyalty & Rewards</span>
              <i>→</i>
            </button>
          )}

          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cm-profile-link-item"
            >
              <span>⭐ Share Restaurant Review</span>
              <i>↗</i>
            </a>
          )}
        </div>

        {(paymentHistory.length > 0 || paymentHistoryError) && <section className="cm-profile-payment-history">
          <span className="cm-eyebrow">PAYMENT HISTORY</span>
          {paymentHistoryError && <p className="cm-error">{paymentHistoryError}</p>}
          {paymentHistory.map((payment) => (
            <div className="cm-profile-payment-row" key={payment.transactionId}>
              <span>{(payment.orderNumbers || []).join(", ") || "Restaurant bill"}<small>
                {[payment.paymentMethod, payment.paymentStatus, payment.paidAt && new Date(payment.paidAt).toLocaleString("en-IN")]
                  .filter(Boolean).join(" • ")}
                {payment.paymentReference && <><br />Ref: {payment.paymentReference}</>}
              </small></span>
              <strong>{money(payment.amount)}</strong>
            </div>
          ))}
        </section>}

        {session?.authenticated && (
          <div className="cm-profile-logout-wrap">
            {logoutError && <p className="cm-error">{logoutError}</p>}
            <button
              type="button"
              className="cm-profile-logout-btn"
              onClick={onLogout}
              disabled={logoutBusy}
            >
              {logoutBusy ? "Signing out…" : "Sign out from this restaurant"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function CustomizationModal({ cartItems, customizations, onChange, onClose, tableNumber }) {
  return (
    <div className="cm-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cm-modal cm-customization-modal" role="dialog" aria-modal="true" aria-labelledby="cm-customization-title">
        <div className="cm-modal-head">
          <div>
            <span className="cm-eyebrow">PERSONALIZE YOUR ORDER</span>
            <h2 id="cm-customization-title">Item customization</h2>
          </div>
          <button type="button" className="cm-close" onClick={onClose} aria-label="Close customization">×</button>
        </div>
        <div className="checkout-table">
          <span>Serving at</span>
          <strong>Table {tableNumber}</strong>
        </div>
        <p className="cm-customization-intro">Tell the restaurant how you would like each item prepared. Requests are subject to availability.</p>
        <div className="cm-customization-list">
          {cartItems.map((item) => (
            <label className="cm-customization-item" key={item.id}>
              <span><strong>{item.name}</strong><small>Quantity: {item.quantity}</small></span>
              <textarea
                maxLength={500}
                value={customizations[item.id] || ""}
                onChange={(event) => onChange(item.id, event.target.value)}
                placeholder={`Customization for ${item.name} (e.g. less spicy)`}
                rows={3}
              />
            </label>
          ))}
        </div>
        <button type="button" className="cm-primary full" onClick={onClose}>Save customizations</button>
      </section>
    </div>
  );
}

export default function CustomerMenu() {
  const { qrToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const menuPath = `/menu/${encodeURIComponent(qrToken)}`;

  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});
  const [customizations, setCustomizations] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customizationOpen, setCustomizationOpen] = useState(false);

  // Bottom navigation state: 'menu' | 'reward' | 'track' | 'fav' | 'profile'
  const [activeNavTab, setActiveNavTab] = useState("menu");

  // Favorites state (persisted per QR/restaurant)
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(`texos_fav_${qrToken}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (itemId) => {
    setFavorites((prev) => {
      const isFav = prev.includes(itemId);
      const next = isFav ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      try {
        localStorage.setItem(`texos_fav_${qrToken}`, JSON.stringify(next));
      } catch (err) {
        console.warn("Could not save favorites:", err);
      }
      return next;
    });
  };

  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [rewardStatus, setRewardStatus] = useState(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardError, setRewardError] = useState("");
  const [selectedRewardId, setSelectedRewardId] = useState("");
  const [selectedRewardPoints, setSelectedRewardPoints] = useState("");
  const rewardHistoryPageRef = useRef(0);
  const rewardHistoryRangeRef = useRef(null);
  const rewardStatusRequestIdRef = useRef(0);
  const rewardStatusAbortRef = useRef(null);

  const [customerSession, setCustomerSession] = useState(() => {
    try {
      const cached = localStorage.getItem(`texos_customer_${qrToken}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [customerSessionLoading, setCustomerSessionLoading] = useState(true);
  const [customerSessionError, setCustomerSessionError] = useState("");

  // Resolves customer session with mobile number from session, reward status, or cached login
  const activeCustomerSession = useMemo(() => {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(`texos_customer_${qrToken}`) || "null");
    } catch {}

    const isAuthed = Boolean(customerSession?.authenticated || rewardStatus?.authenticated);
    if (!isAuthed) return null;

    const name = customerSession?.customerName || rewardStatus?.customerName || cached?.customerName || "Customer";
    const phone = customerSession?.mobileNumber || rewardStatus?.mobileNumber || cached?.mobileNumber || "";

    return {
      authenticated: true,
      customerId: customerSession?.customerId || rewardStatus?.customerId || cached?.customerId,
      customerName: name,
      mobileNumber: phone,
    };
  }, [customerSession, rewardStatus, qrToken]);

  const [customerLogoutBusy, setCustomerLogoutBusy] = useState(false);
  const [customerLogoutError, setCustomerLogoutError] = useState("");

  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [completedOrder, setCompletedOrder] = useState(null);
  const [orderTrackingError, setOrderTrackingError] = useState("");

  const [billOpen, setBillOpen] = useState(false);
  const [customerBill, setCustomerBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentState, setPaymentState] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [merchantOrderId, setMerchantOrderId] = useState("");
  const [waiterRequest, setWaiterRequest] = useState(null);
  const [waiterBusy, setWaiterBusy] = useState(false);
  const [waiterError, setWaiterError] = useState("");
  const [customerPaymentHistory, setCustomerPaymentHistory] = useState([]);
  const [customerPaymentHistoryError, setCustomerPaymentHistoryError] = useState("");

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api(`/api/public/menu/${encodeURIComponent(qrToken)}`);
      setMenu(normalizeMenu(data));
    } catch (err) {
      setLoadError(err.message || "Unable to load this menu.");
    } finally {
      setLoading(false);
    }
  }, [qrToken]);

  const loadRewardStatus = useCallback(async (historyRange, { append = false } = {}) => {
    const requestId = ++rewardStatusRequestIdRef.current;
    rewardStatusAbortRef.current?.abort();
    const controller = new AbortController();
    rewardStatusAbortRef.current = controller;
    const page = append ? rewardHistoryPageRef.current + 1 : 0;
    if (!append) rewardHistoryPageRef.current = 0;
    setRewardLoading(true);
    setRewardError("");
    try {
      const end = new Date();
      const defaultStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
      const activeRange = append && rewardHistoryRangeRef.current
        ? rewardHistoryRangeRef.current
        : {
          from: historyRange?.from || localDateParam(defaultStart),
          to: historyRange?.to || localDateParam(end),
        };
      if (!append || !rewardHistoryRangeRef.current) rewardHistoryRangeRef.current = activeRange;
      const { from, to } = activeRange;
      const status = await api(`/api/loyalty/status?qrToken=${encodeURIComponent(qrToken)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&historyPage=${page}&historySize=20`, { signal: controller.signal });
      if (requestId !== rewardStatusRequestIdRef.current) return;
      if (append) {
        setRewardStatus((current) => {
          const currentTransactions = current?.transactions || [];
          const currentIds = new Set(currentTransactions.map((transaction) => transaction.id));
          const nextTransactions = (status.transactions || [])
            .filter((transaction) => !currentIds.has(transaction.id));
          return {
            ...status,
            transactions: [...currentTransactions, ...nextTransactions],
          };
        });
      } else {
        setRewardStatus(status);
      }
      rewardHistoryPageRef.current = page;
    } catch (err) {
      if (requestId === rewardStatusRequestIdRef.current && err.name !== "AbortError") {
        if (err.status === 401) setRewardStatus((current) => ({ ...(current || {}), authenticated: false }));
        setRewardError(err.message || "Could not load reward status.");
      }
    } finally {
      if (requestId === rewardStatusRequestIdRef.current) {
        setRewardLoading(false);
        if (rewardStatusAbortRef.current === controller) rewardStatusAbortRef.current = null;
      }
    }
  }, [qrToken]);

  useEffect(() => {
    rewardStatusRequestIdRef.current += 1;
    rewardStatusAbortRef.current?.abort();
    rewardStatusAbortRef.current = null;
    rewardHistoryPageRef.current = 0;
    rewardHistoryRangeRef.current = null;
    setRewardStatus(null);
    setRewardError("");
    setRewardLoading(false);
  }, [qrToken]);

  const openRewards = useCallback(() => {
    setActiveNavTab("reward");
    loadRewardStatus();
  }, [loadRewardStatus]);

  useEffect(() => {
    if (checkoutOpen && menu?.rewardsEnabled && !rewardStatus && !rewardLoading) {
      loadRewardStatus();
    }
  }, [checkoutOpen, loadRewardStatus, menu?.rewardsEnabled, rewardLoading, rewardStatus]);

  const restoreActiveOrder = useCallback(async () => {
    try {
      const orders = await api(`/api/public/orders?qrToken=${encodeURIComponent(qrToken)}`);
      const tableOrders = Array.isArray(orders)
        ? orders.filter((order) => String(order.tableNumber) === String(menu?.tableNumber))
        : [];
      const latestOrder = tableOrders.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.orderDate || 0).getTime();
        const bTime = new Date(b.createdAt || b.orderDate || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return Number(b.id || 0) - Number(a.id || 0);
      })[0] || null;
      if (latestOrder) setCompletedOrder(latestOrder);
    } catch (error) {
      setOrderTrackingError(error.message || "Unable to restore your active order.");
    }
  }, [menu?.tableNumber, qrToken]);

  const loadCurrentBill = useCallback(async () => {
    try {
      const bill = await api(`/api/public/orders/bill?qrToken=${encodeURIComponent(qrToken)}`);
      setCustomerBill(bill);
      return bill;
    } catch (error) {
      setCustomerBill(null);
      throw error;
    }
  }, [qrToken]);

  const openBill = async () => {
    setBillOpen(true);
    setBillLoading(true);
    setBillError("");
    try {
      await loadCurrentBill();
    } catch (error) {
      setBillError(error.message || "Could not load your bill.");
    } finally {
      setBillLoading(false);
    }
  };

  const beginBillPayment = async () => {
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const bill = await loadCurrentBill();
      if (!bill.eligibleForOnlinePayment || !bill.onlinePaymentAvailable
        || bill.paymentStatus !== "PENDING") {
        throw new Error("Online payment is not available for this bill right now.");
      }
      const payment = await api(
        `/api/public/orders/payment?qrToken=${encodeURIComponent(qrToken)}`,
        { method: "POST" },
      );
      setPaymentState(payment);
      if (payment.checkoutUrl) {
        sessionStorage.setItem(`texos-phonepe-${qrToken}`, payment.merchantOrderId);
        window.location.assign(payment.checkoutUrl);
      } else if (payment.status === "PENDING" || payment.status === "PROCESSING") {
        setMerchantOrderId(payment.merchantOrderId);
      }
    } catch (error) {
      setPaymentError(error.message || "Could not start secure checkout.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const requestWaiter = async () => {
    setWaiterBusy(true);
    setWaiterError("");
    try {
      const result = await api(
        `/api/public/orders/waiter-request?qrToken=${encodeURIComponent(qrToken)}`,
        { method: "POST" },
      );
      setWaiterRequest(result);
    } catch (error) {
      setWaiterError(error.message || "Could not contact the restaurant.");
    } finally {
      setWaiterBusy(false);
    }
  };

  const recallWaiter = async () => {
    if (!waiterRequest?.requestId || waiterRequest.status !== "PENDING" || waiterBusy) return;
    const cooldownEnd = Date.parse(waiterRequest?.cooldownUntil || "");
    if (Number.isFinite(cooldownEnd) && cooldownEnd > Date.now()) {
      setWaiterError("Please wait 2 minutes before trying again.");
      return;
    }

    setWaiterBusy(true);
    setWaiterError("");
    try {
      const result = await api(
        `/api/public/orders/waiter-request/${waiterRequest.requestId}/recall?qrToken=${encodeURIComponent(qrToken)}`,
        { method: "POST" },
      );
      setWaiterRequest(result);
    } catch (error) {
      setWaiterError(error.message || "Could not re-call the waiter.");
    } finally {
      setWaiterBusy(false);
    }
  };

  const loadCustomerPaymentHistory = useCallback(async () => {
    try {
      const history = await api(
        `/api/public/orders/payment-history?qrToken=${encodeURIComponent(qrToken)}`,
      );
      setCustomerPaymentHistory(Array.isArray(history) ? history : []);
      setCustomerPaymentHistoryError("");
    } catch (error) {
      setCustomerPaymentHistoryError(error.message || "Payment history could not be loaded.");
    }
  }, [qrToken]);

  useEffect(() => {
    if (activeNavTab === "profile") loadCustomerPaymentHistory();
  }, [activeNavTab, loadCustomerPaymentHistory]);

  useEffect(() => {
    if (!completedOrder || !menu) return;
    loadCurrentBill().catch(() => setCustomerBill(null));
  }, [completedOrder?.orderNumber, loadCurrentBill, menu]);

  useEffect(() => {
    const queryOrderId = new URLSearchParams(location.search).get("phonepePayment")
      || sessionStorage.getItem(`texos-phonepe-${qrToken}`);
    if (queryOrderId) {
      setMerchantOrderId(queryOrderId);
      setBillOpen(true);
      sessionStorage.removeItem(`texos-phonepe-${qrToken}`);
    }
  }, [location.search, qrToken]);

  useEffect(() => {
    if (!merchantOrderId) return undefined;
    let active = true;
    let attempts = 0;
    let interval;
    const checkStatus = async () => {
      if (!active) return;
      attempts += 1;
      try {
        const status = await api(
          `/api/public/orders/payment/${encodeURIComponent(merchantOrderId)}?qrToken=${encodeURIComponent(qrToken)}`,
        );
        if (!active) return;
        setPaymentState(status);
        if (status.status === "SUCCESSFUL") {
          await loadCurrentBill();
          setPaymentError("");
        } else if (status.status === "FAILED") {
          setPaymentError("PhonePe did not confirm this payment. You can try again or call a waiter.");
        }
        if (["SUCCESSFUL", "FAILED"].includes(status.status) || attempts >= 20) {
          window.clearInterval(interval);
          setMerchantOrderId("");
          const query = new URLSearchParams(location.search);
          query.delete("phonepePayment");
          const suffix = query.toString();
          navigate(`${location.pathname}${suffix ? `?${suffix}` : ""}`, { replace: true });
        }
      } catch (error) {
        if (active) setPaymentError(error.message || "Payment status is still being verified.");
        if (attempts >= 20) {
          window.clearInterval(interval);
          setMerchantOrderId("");
        }
      }
    };
    checkStatus();
    interval = window.setInterval(checkStatus, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadCurrentBill, location.pathname, location.search, merchantOrderId, navigate, qrToken]);

  useEffect(() => {
    if (!waiterRequest?.requestId || waiterRequest.status !== "PENDING") return undefined;
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const status = await api(
          `/api/public/orders/waiter-request/${waiterRequest.requestId}?qrToken=${encodeURIComponent(qrToken)}`,
        );
        if (active) {
          setWaiterRequest(status);
          if (status.status === "ASSIGNED") setWaiterError("");
        }
      } catch (error) {
        if (active) setWaiterError(error.message || "Could not refresh waiter request.");
      }
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [qrToken, waiterRequest?.requestId, waiterRequest?.status]);

  const logoutCustomer = async () => {
    setCustomerLogoutBusy(true);
    setCustomerLogoutError("");
    try {
      await api(`/api/public/customers/logout?qrToken=${encodeURIComponent(qrToken)}`, {
        method: "POST",
      });
      setCustomerSession(null);
      try {
        localStorage.removeItem(`texos_customer_${qrToken}`);
      } catch {}
    } catch (error) {
      setCustomerLogoutError(error.message || "Could not sign out. Please try again.");
    } finally {
      setCustomerLogoutBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) return loadMenu();
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [loadMenu]);

  useEffect(() => {
    let active = true;
    const checkCustomerSession = async () => {
      setCustomerSessionLoading(true);
      setCustomerSessionError("");
      try {
        const session = await api(`/api/public/customers/session?qrToken=${encodeURIComponent(qrToken)}`);
        let cached = null;
        try {
          cached = JSON.parse(localStorage.getItem(`texos_customer_${qrToken}`) || "null");
        } catch {}

        if (active) {
          if (session?.authenticated) {
            const merged = {
              ...cached,
              ...session,
              customerName: session.customerName || cached?.customerName || "Customer",
              mobileNumber: session.mobileNumber || cached?.mobileNumber || "",
            };
            setCustomerSession(merged);
            try {
              localStorage.setItem(`texos_customer_${qrToken}`, JSON.stringify(merged));
            } catch {}
          } else {
            setCustomerSession(null);
            try {
              localStorage.removeItem(`texos_customer_${qrToken}`);
            } catch {}
          }
        }
      } catch (error) {
        if (!active) return;
        setCustomerSession(null);
        if (error.status !== 401) {
          setCustomerSessionError(error.message || "Could not check your sign-in status.");
        }
      } finally {
        if (active) setCustomerSessionLoading(false);
      }
    };
    checkCustomerSession();
    return () => {
      active = false;
    };
  }, [qrToken]);

  useEffect(() => {
    if (!menu) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (active) return restoreActiveOrder();
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [menu, restoreActiveOrder]);

  useEffect(() => {
    if (!location.state?.openRewards || !menu) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (menu.rewardsEnabled) openRewards();
      const nextState = { ...location.state };
      delete nextState.openRewards;
      navigate(`${location.pathname}${location.search}${location.hash}`, {
        replace: true,
        state: Object.keys(nextState).length ? nextState : null,
      });
    });
    return () => {
      active = false;
    };
  }, [location.hash, location.pathname, location.search, location.state, menu, navigate, openRewards]);

  const allItems = useMemo(
    () =>
      menu?.categories.flatMap((c) =>
        c.items.map((item) => ({ ...item, categoryName: c.name }))
      ) || [],
    [menu]
  );

  const visibleItems = useMemo(() => {
    return allItems.filter((item) => {
      if (!item.available) return false;
      if (activeNavTab === "fav" && !favorites.includes(item.id)) return false;
      const matchesCategory =
        activeCategory === "all" || String(item.categoryName) === String(activeCategory);
      if (!matchesCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        `${item.name} ${item.description} ${item.categoryName}`.toLowerCase().includes(q)
      );
    });
  }, [allItems, activeCategory, search, activeNavTab, favorites]);

  const cartItems = useMemo(
    () =>
      allItems
        .filter((item) => cart[item.id] > 0)
        .map((item) => ({ ...item, quantity: cart[item.id], customization: customizations[item.id] || "" })),
    [allItems, cart, customizations]
  );

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const changeQuantity = (id, quantity) =>
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[id];
      else next[id] = Math.min(99, quantity);
      return next;
    });

  const placeOrder = async () => {
    setPlacing(true);
    setOrderError("");
    try {
      const payload = {
        qrToken,
        rewardId: selectedRewardId ? Number(selectedRewardId) : null,
        rewardPoints: !selectedRewardId && selectedRewardPoints ? Number(selectedRewardPoints) : null,
        items: cartItems.map((item) => ({
          itemId: Number(item.id),
          quantity: item.quantity,
          customization: customizations[item.id]?.trim() || null,
        })),
      };

      const order = await api("/api/public/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCompletedOrder(order);
      setCheckoutOpen(false);
      setCartOpen(false);
      setCart({});
      setCustomizations({});
      setSelectedRewardId("");
      setActiveNavTab("track"); // Automatically show the Track Order Page!
    } catch (err) {
      setOrderError(err.message || "Could not place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="cm-loading">
        <div className="cm-loader"></div>
        <strong>Preparing your menu</strong>
        <span>Just a moment…</span>
      </div>
    );
  }

  if (loadError || !menu) {
    return (
      <main className="cm-error-page">
        <div className="cm-error-icon">!</div>
        <h1>Menu unavailable</h1>
        <p>{loadError || "This QR code may be invalid or inactive."}</p>
        <button className="cm-primary" onClick={loadMenu}>Try again</button>
        <small>If the issue continues, please ask the restaurant staff for help.</small>
      </main>
    );
  }

  return (
    <div className="customer-menu">
      <div className="cm-phone-shell">
        {/* Top Restaurant Header */}
        <div className="cm-restaurant-header">
          <div className="cm-header-left">
            <span className="cm-restaurant-kicker">RESTAURANT</span>
            <h1 className="cm-restaurant-title">{menu.restaurantName}</h1>
            <div className="cm-header-address-row">
              <svg className="cm-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{menu.address || "123 Sunset Ave, Downtown"} • {menu.openingHours || "Open 11am-10pm"}</span>
            </div>
          </div>

          <div className="cm-header-right">
            <button
              type="button"
              className="cm-auth-pill-btn"
              onClick={() => {
                if (activeCustomerSession?.authenticated) {
                  setActiveNavTab("profile");
                } else {
                  navigate(`${menuPath}/login`);
                }
              }}
              aria-label={activeCustomerSession?.authenticated ? "Customer profile" : "Log in or Sign up"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{activeCustomerSession?.authenticated ? (activeCustomerSession.customerName || "Profile") : "Log in / Sign up"}</span>
            </button>
            <span className="cm-no-login-note">
              No need to Login/SignUp to place an order
            </span>
          </div>
        </div>

        {/* Dynamic Action Strip: "Share Review on Map" & "See Bill" (Requirement 2 & 3) */}
        <div className="cm-header-action-strip">
          {menu.googleMapsUrl ? (
            <a
              href={menu.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cm-quick-action-btn cm-review-map-btn"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Share Review on Map</span>
            </a>
          ) : (
            <button
              type="button"
              className="cm-quick-action-btn cm-review-map-btn disabled"
              disabled
              title="Google Review link not configured"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Share Review on Map</span>
            </button>
          )}

          {Boolean(completedOrder) && (
            <button
              type="button"
              className="cm-quick-action-btn cm-see-bill-btn"
              onClick={openBill}
              disabled={billLoading}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>{billLoading ? "Loading…" : "See Bill"}</span>
            </button>
          )}
          {Boolean(completedOrder && customerBill?.paymentStatus === "PENDING"
            && customerBill?.eligibleForOnlinePayment && customerBill?.onlinePaymentAvailable) && (
            <button
              type="button"
              className="cm-quick-action-btn cm-pay-bill-btn"
              onClick={() => {
                setBillOpen(true);
                beginBillPayment();
              }}
            >
              <span>Pay Bill Now</span>
            </button>
          )}
        </div>

        {/* View Routing: Profile Page | Reward Page | Track Order Page | Menu/Favorites Pages */}
        {activeNavTab === "profile" ? (
          <CustomerProfileView
            session={activeCustomerSession}
            tableNumber={menu.tableNumber}
            googleMapsUrl={menu.googleMapsUrl}
            rewardsEnabled={menu.rewardsEnabled}
            onOpenRewards={openRewards}
            onOpenBill={openBill}
            onLogout={logoutCustomer}
            logoutBusy={customerLogoutBusy}
            logoutError={customerLogoutError}
            paymentHistory={customerPaymentHistory}
            paymentHistoryError={customerPaymentHistoryError}
            qrToken={qrToken}
          />
        ) : activeNavTab === "reward" ? (
          /* ── INLINE REWARD PAGE (no auto-refresh, manual refresh only) ── */
          <section className="cm-reward-page">
            <div className="cm-section-title-row">
              <h2>🎁 Loyalty Rewards</h2>
              <button
                type="button"
                className="cm-see-all-link"
                onClick={() => setActiveNavTab("menu")}
              >
                Back to Menu &gt;
              </button>
            </div>
            <LoyaltyPrompt
              qrToken={qrToken}
              rewardStatus={rewardStatus}
              loading={rewardLoading}
              error={rewardError}
              onManualRefresh={loadRewardStatus}
              onLoadMore={() => loadRewardStatus(undefined, { append: true })}
              onUseReward={(rewardId) => {
                setSelectedRewardId(String(rewardId));
                setActiveNavTab("menu");
                if (cartCount > 0) setCheckoutOpen(true);
              }}
            />
          </section>
        ) : activeNavTab === "track" ? (
          <section className="cm-track-order-page">
            <div className="cm-section-title-row">
              <h2>Track Your Order</h2>
              <button
                type="button"
                className="cm-see-all-link"
                onClick={() => setActiveNavTab("menu")}
              >
                Back to Menu &gt;
              </button>
            </div>

            {completedOrder ? (
              <OrderTracker
                key={completedOrder.orderNumber}
                order={completedOrder}
                onBackToMenu={() => setActiveNavTab("menu")}
                qrToken={qrToken}
              />
            ) : (
              <div className="cm-track-empty-state">
                <div className="cm-track-empty-icon" aria-hidden="true">
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3>No Active Orders</h3>
                <p>
                  You haven't placed an order yet. Browse our delicious menu and place an order to track its real-time preparation and status right here!
                </p>
                <button
                  type="button"
                  className="cm-primary"
                  onClick={() => setActiveNavTab("menu")}
                >
                  Explore Menu
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* =========================================================================
                RESERVED SPACE FOR TWO FUTURE SECTIONS
                Requirement C: Compact dedicated space between the restaurant header/address
                and the search bar. Do not remove or implement dummy text/images.
                ========================================================================= */}
            <div className="cm-reserved-future-container" aria-label="Reserved for future sections">
              <section className="cm-waiter-call-action" aria-label="Call a waiter">
                <p>Need help or prefer to pay in person? Call a waiter.</p>
                <div className="cm-waiter-buttons">
                  <button
                    type="button"
                    className="cm-quick-action-btn cm-review-map-btn"
                    onClick={requestWaiter}
                    disabled={waiterBusy || waiterRequest?.status === "PENDING"}
                  >
                    {waiterBusy && waiterRequest?.status !== "PENDING"
                      ? "Calling…"
                      : waiterRequest?.status === "PENDING"
                        ? "Waiter requested"
                        : "Call Waiter"}
                  </button>
                  {waiterRequest?.status === "PENDING" && (
                    <WaiterRecallButton
                      waiterRequest={waiterRequest}
                      waiterBusy={waiterBusy}
                      onRecall={recallWaiter}
                      onCooldownError={() => setWaiterError("Please wait 2 minutes before trying again.")}
                    />
                  )}
                </div>
                {waiterRequest?.status === "ASSIGNED" && (
                  <p className="cm-waiter-message" role="status">A waiter will be with you shortly. Please wait.</p>
                )}
                {waiterError && <p className="cm-error" role="alert">{waiterError}</p>}
              </section>
              {/* FUTURE SECTION 1: Placeholder container for Future Section 1 (e.g. promo banners) */}
              <div className="cm-future-slot cm-future-slot-1" id="future-section-1" />

              {/* FUTURE SECTION 2: Placeholder container for Future Section 2 (e.g. quick filters / dietary toggles) */}
              <div className="cm-future-slot cm-future-slot-2" id="future-section-2" />
            </div>

            {/* Search Bar */}
            <div className="cm-search-container">
              <div className="cm-search-pill">
                <svg className="cm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search dishes, cuisines, drinks..."
                  aria-label="Search dishes, cuisines, drinks"
                />
                {search && (
                  <button
                    type="button"
                    className="cm-search-clear"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Horizontally Scrollable Categories */}
            <div className="cm-category-capsule-container">
              <div className="cm-category-capsule-bar" role="tablist" aria-label="Menu categories">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === "all"}
                  className={`cm-category-pill ${activeCategory === "all" ? "active" : ""}`}
                  onClick={() => {
                    setActiveCategory("all");
                    if (activeNavTab !== "menu" && activeNavTab !== "fav") {
                      setActiveNavTab("menu");
                    }
                  }}
                >
                  Popular
                </button>

                {menu.categories.map((category) => {
                  const icon = getCategoryIcon(category.name);
                  const isActive = activeCategory === category.name;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`cm-category-pill ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveCategory(category.name);
                        if (activeNavTab !== "menu" && activeNavTab !== "fav") {
                          setActiveNavTab("menu");
                        }
                      }}
                    >
                      {icon && <span className="cm-cat-icon">{icon}</span>}
                      <span>{category.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="cm-customization-trigger"
              disabled={cartCount === 0}
              onClick={() => setCustomizationOpen(true)}
            >
              <span><strong>Customize your items</strong><small>Add a preparation request for each item in your order.</small></span>
              <b>{cartCount > 0 ? `${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Add items first"} →</b>
            </button>

            {/* Menu Items Section */}
            <section className="cm-food-section">
              <div className="cm-section-title-row">
                <h2>
                  {activeNavTab === "fav"
                    ? "Your Favorites"
                    : activeCategory === "all"
                    ? "Popular Now"
                    : activeCategory}
                </h2>
                <button
                  type="button"
                  className="cm-see-all-link"
                  onClick={() => {
                    setActiveCategory("all");
                    setSearch("");
                    if (activeNavTab === "fav") setActiveNavTab("menu");
                  }}
                >
                  See all &gt;
                </button>
              </div>

              {visibleItems.length === 0 ? (
                <div className="cm-empty-state">
                  <span>🥣</span>
                  <h3>
                    {activeNavTab === "fav"
                      ? "No favorite dishes yet"
                      : "No dishes found"}
                  </h3>
                  <p>
                    {activeNavTab === "fav"
                      ? "Tap the heart icon on any dish to save it here for quick re-ordering."
                      : "Try another search term or select a different category."}
                  </p>
                  {activeNavTab === "fav" ? (
                    <button
                      type="button"
                      className="cm-primary"
                      onClick={() => setActiveNavTab("menu")}
                    >
                      Browse Menu
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="cm-secondary"
                      onClick={() => {
                        setSearch("");
                        setActiveCategory("all");
                      }}
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="cm-cream-card-container">
                  {visibleItems.map((item) => {
                    const isFavorite = favorites.includes(item.id);
                    const quantityInCart = cart[item.id] || 0;

                    return (
                      <article className="cm-food-item-row" key={item.id}>
                        <div className="cm-food-image-wrapper">
                          <FoodImage src={item.imageUrl} name={item.name} />
                          <button
                            type="button"
                            className={`cm-fav-heart-btn ${isFavorite ? "favorited" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(item.id);
                            }}
                            aria-label={isFavorite ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
                            title={isFavorite ? "Favorited" : "Save as favorite"}
                          >
                            <HeartIcon filled={isFavorite} />
                          </button>
                        </div>

                        <div className="cm-food-details">
                          <div className="cm-food-head">
                            <h3 className="cm-food-name">{item.name}</h3>
                            <p className="cm-food-desc">
                              {item.description || "Fresh ingredients, prepared to order."}
                            </p>
                          </div>

                          <div className="cm-food-action-row">
                            <span className="cm-food-price">{money(item.price)}</span>
                            {quantityInCart > 0 ? (
                              <QuantityControl
                                compact
                                quantity={quantityInCart}
                                onChange={(q) => changeQuantity(item.id, q)}
                              />
                            ) : (
                              <button
                                type="button"
                                className="cm-add-pill-btn"
                                onClick={() => changeQuantity(item.id, 1)}
                                aria-label={`Add ${item.name} to order`}
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Allergy and service notice */}
            <section className="cm-safe-notice">
              <span>✦</span>
              <p>
                Serving at Table <strong>{menu.tableNumber}</strong>. Have an allergy or special dietary request? Please inform the restaurant staff before ordering.
              </p>
            </section>
          </>
        )}

        {/* Sticky Place Order Button */}
        {cartCount > 0 && (
          <div className="cm-sticky-order-bar-container">
            <button
              type="button"
              className="cm-sticky-order-button"
              onClick={() => setCheckoutOpen(true)}
              aria-label={`Place order: ${money(subtotal)}, ${cartCount} items`}
            >
              Place Order • {money(subtotal)} • {cartCount} {cartCount === 1 ? "item" : "items"}
            </button>
          </div>
        )}

        {/* Fixed Bottom Navigation (Requirement 1 & 4) */}
        <nav className="cm-bottom-nav" aria-label="Main menu navigation">
          <button
            type="button"
            className={`cm-nav-item ${activeNavTab === "menu" ? "active" : ""}`}
            onClick={() => {
              setActiveNavTab("menu");
              setCartOpen(false);
              setLoyaltyOpen(false);
            }}
          >
            <div className="cm-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="16" y2="12" />
                <line x1="4" y1="18" x2="18" y2="17" />
              </svg>
            </div>
            <span>{activeNavTab === "menu" ? "• Menu •" : "Menu"}</span>
          </button>

          <button
            type="button"
            className={`cm-nav-item ${activeNavTab === "reward" ? "active" : ""}`}
            onClick={() => {
              setActiveNavTab("reward");
              setCartOpen(false);
              setLoyaltyOpen(false);
              loadRewardStatus();
            }}
          >
            <div className="cm-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect width="20" height="5" x="2" y="7" />
                <line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <span>Reward</span>
          </button>

          <button
            type="button"
            className={`cm-nav-item ${activeNavTab === "track" ? "active" : ""}`}
            onClick={() => {
              setActiveNavTab("track");
              setCartOpen(false);
              setLoyaltyOpen(false);
            }}
          >
            <div className="cm-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {completedOrder && !["SERVED", "CANCELLED"].includes(String(completedOrder.orderStatus || "").toUpperCase()) && (
                <span className="cm-live-pulse-dot" title="Active order in progress" />
              )}
            </div>
            <span>{activeNavTab === "track" ? "• Track Order •" : "Track Order"}</span>
          </button>

          <button
            type="button"
            className={`cm-nav-item ${activeNavTab === "fav" ? "active" : ""}`}
            onClick={() => {
              setActiveNavTab("fav");
              setCartOpen(false);
              setLoyaltyOpen(false);
            }}
          >
            <div className="cm-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <span>Fav</span>
          </button>

          <button
            type="button"
            className={`cm-nav-item ${activeNavTab === "profile" ? "active" : ""}`}
            onClick={() => {
              setActiveNavTab("profile");
              setCartOpen(false);
              setLoyaltyOpen(false);
            }}
          >
            <div className="cm-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span>{activeNavTab === "profile" ? "• Profile •" : "Profile"}</span>
          </button>
        </nav>
      </div>

      {/* Cart Drawer */}
      {cartOpen && (
        <div
          className="cm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCartOpen(false);
            }
          }}
        >
          <aside className="cm-cart-drawer">
            <div className="cm-modal-head">
              <div>
                <span className="cm-eyebrow">YOUR SELECTION</span>
                <h2>Your order</h2>
              </div>
              <button
                className="cm-close"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                ×
              </button>
            </div>

            <div className="cart-table-label">
              <span>Serving at</span>
              <strong>{menu.tableNumber}</strong>
            </div>

            <div className="cm-cart-list">
              {cartItems.length === 0 ? (
                <div className="cm-empty-cart">
                  <span>🛒</span>
                  <p>Your cart is empty</p>
                  <small>Add delicious items from the menu to place your order.</small>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div className="cm-cart-item" key={item.id}>
                    <FoodImage src={item.imageUrl} name={item.name} />
                    <div className="cm-cart-item-info">
                      <strong>{item.name}</strong>
                      <span>{money(item.price)} each</span>
                      {customizations[item.id]?.trim() && <small className="cm-cart-customization">Request: {customizations[item.id]}</small>}
                      <QuantityControl
                        compact
                        quantity={item.quantity}
                        onChange={(q) => changeQuantity(item.id, q)}
                      />
                    </div>
                    <b>{money(item.price * item.quantity)}</b>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="cm-cart-summary">
                <div>
                  <span>Subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </div>
                <small>Final taxes and service charges will be calculated on your bill.</small>
                <button
                  className="cm-primary full"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                >
                  Continue to checkout <span>→</span>
                </button>
                <button
                  className="cm-text-button"
                  onClick={() => setCartOpen(false)}
                >
                  Continue browsing
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {customizationOpen && (
        <CustomizationModal
          cartItems={cartItems}
          customizations={customizations}
          onChange={(itemId, value) => setCustomizations((current) => ({ ...current, [itemId]: value }))}
          onClose={() => setCustomizationOpen(false)}
          tableNumber={menu.tableNumber}
        />
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cartItems}
          subtotal={subtotal}
          tableNumber={menu.tableNumber}
          onClose={() => {
            setCheckoutOpen(false);
            setOrderError("");
          }}
          onPlaceOrder={placeOrder}
          placing={placing}
          error={orderError}
          rewardStatus={rewardStatus}
          selectedRewardId={selectedRewardId}
          selectedRewardPoints={selectedRewardPoints}
          onSelectReward={setSelectedRewardId}
          onSelectRewardPoints={setSelectedRewardPoints}
          onLogin={() => navigate(`/menu/${encodeURIComponent(qrToken)}/login`, { state: { returnToRewards: true } })}
        />
      )}

      {/* Customer Bill Modal */}
      {billOpen && (
        <CustomerBillModal
          bill={customerBill}
          loading={billLoading}
          error={billError}
          onClose={() => setBillOpen(false)}
          onPayNow={beginBillPayment}
          paymentBusy={paymentBusy}
          paymentState={paymentState}
          paymentError={paymentError}
          onExpired={() => {
            setBillOpen(false);
            setCustomerBill(null);
          }}
        />
      )}

      {/* Loyalty modal removed – rewards now render inline in the "reward" tab */}
    </div>
  );
}
