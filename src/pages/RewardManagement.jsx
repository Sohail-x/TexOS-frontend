import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiFetch } from "./restaurantApi";
import "./RewardManagement.css";

const blankReward = { rewardName: "", description: "", imageUrl: "", rewardType: "FREE_ITEM", pointsRequired: 200, menuItemId: "", discountPercentage: "", discountAmount: "", maximumDiscount: "", minimumOrderAmount: "", totalQuantity: "", remainingQuantity: "", maxRedemptions: "", startDate: "", expiryDate: "", active: true };
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

async function request(path, options = {}) {
  const res = await apiFetch(`${API_BASE}${path}`, { ...options, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export default function RewardManagement({ restaurantId }) {
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [settings, setSettings] = useState({ enabled: false, pointsPer100: 10, minimumOrderAmount: 100, minimumRedemptionPoints: 100, pointsExpiryDays: "", conversionPoints: 100, conversionInr: 10 });
  const [rewards, setRewards] = useState([]);
  const [history, setHistory] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("ALL");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [menuItems, setMenuItems] = useState([]);
  const [form, setForm] = useState(blankReward);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loadingResources, setLoadingResources] = useState({});
  const [resourceErrors, setResourceErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const root = `/api/restaurants/${restaurantId}/loyalty`;
  const loadedResourcesRef = useRef(new Set());
  const inFlightResourcesRef = useRef(new Map());
  const resourceControllersRef = useRef(new Map());
  const generationRef = useRef(0);
  const activeRestaurantRef = useRef(restaurantId);

  useEffect(() => {
    if (String(activeRestaurantRef.current) === String(restaurantId)) return;
    activeRestaurantRef.current = restaurantId;
    generationRef.current += 1;
    resourceControllersRef.current.forEach((controller) => controller.abort());
    resourceControllersRef.current.clear();
    inFlightResourcesRef.current.clear();
    loadedResourcesRef.current.clear();
    setOverview(null);
    setSettings({ enabled: false, pointsPer100: 10, minimumOrderAmount: 100, minimumRedemptionPoints: 100, pointsExpiryDays: "", conversionPoints: 100, conversionInr: 10 });
    setRewards([]);
    setHistory([]);
    setAuditLogs([]);
    setMenuItems([]);
    setLoadingResources({});
    setResourceErrors({});
    setError("");
    setSaving(false);
  }, [restaurantId]);

  const loadResource = useCallback((resource, { force = false } = {}) => {
    if (!restaurantId) return Promise.resolve(false);
    if (!force && loadedResourcesRef.current.has(resource)) return Promise.resolve(true);
    if (!force && inFlightResourcesRef.current.has(resource)) {
      return inFlightResourcesRef.current.get(resource);
    }

    if (force) {
      resourceControllersRef.current.get(resource)?.abort();
      inFlightResourcesRef.current.delete(resource);
    }

    const requestVersion = generationRef.current;
    const requestRestaurantId = restaurantId;
    const controller = new AbortController();
    resourceControllersRef.current.set(resource, controller);
    setLoadingResources((current) => ({ ...current, [resource]: true }));
    setResourceErrors((current) => ({ ...current, [resource]: "" }));

    let promise;
    promise = (async () => {
      const isCurrent = () => requestVersion === generationRef.current
        && String(activeRestaurantRef.current) === String(requestRestaurantId)
        && resourceControllersRef.current.get(resource) === controller;
      try {
        let value;
        if (resource === "overview") {
          value = await request(`${root}/overview`, { signal: controller.signal });
          if (isCurrent()) setOverview(value);
        } else if (resource === "settings") {
          value = await request(`${root}/settings`, { signal: controller.signal });
          if (isCurrent()) setSettings(value);
        } else if (resource === "rewards") {
          value = await request(`${root}/rewards`, { signal: controller.signal });
          if (isCurrent()) setRewards(Array.isArray(value) ? value : []);
        } else if (resource === "redemptions") {
          value = await request(`${root}/redemptions`, { signal: controller.signal });
          if (isCurrent()) setHistory(Array.isArray(value) ? value : []);
        } else if (resource === "auditLogs") {
          value = await request(`${root}/audit-logs`, { signal: controller.signal });
          if (isCurrent()) setAuditLogs(Array.isArray(value) ? value : []);
        } else if (resource === "menuItems") {
          value = await request(`/api/restaurants/${restaurantId}/items`, { signal: controller.signal });
          if (isCurrent()) setMenuItems(Array.isArray(value) ? value : []);
        } else {
          throw new Error(`Unknown reward resource: ${resource}`);
        }
        if (!isCurrent()) return false;
        loadedResourcesRef.current.add(resource);
        return true;
      } catch (requestError) {
        if (requestError.name !== "AbortError" && isCurrent()) {
          setResourceErrors((current) => ({
            ...current,
            [resource]: requestError.message || "Unable to load reward data.",
          }));
        }
        return false;
      } finally {
        if (resourceControllersRef.current.get(resource) === controller) {
          resourceControllersRef.current.delete(resource);
          if (inFlightResourcesRef.current.get(resource) === promise) {
            inFlightResourcesRef.current.delete(resource);
          }
          if (requestVersion === generationRef.current
              && String(activeRestaurantRef.current) === String(requestRestaurantId)) {
            setLoadingResources((current) => ({ ...current, [resource]: false }));
          }
        }
      }
    })();

    inFlightResourcesRef.current.set(resource, promise);
    return promise;
  }, [restaurantId, root]);

  useEffect(() => {
    if (!restaurantId) return;
    if (tab === "history") {
      void loadResource("redemptions");
      void loadResource("auditLogs");
    } else {
      void loadResource(tab);
    }
  }, [tab, restaurantId, loadResource]);

  const tabLoading = tab === "history"
    ? loadingResources.redemptions || loadingResources.auditLogs
    : loadingResources[tab];
  const tabError = tab === "history"
    ? resourceErrors.redemptions || resourceErrors.auditLogs
    : resourceErrors[tab] || (tab === "rewards" ? resourceErrors.menuItems : "");

  const retryCurrentTab = () => {
    if (tab === "history") {
      if (resourceErrors.redemptions) void loadResource("redemptions", { force: true });
      if (resourceErrors.auditLogs) void loadResource("auditLogs", { force: true });
    } else {
      if (resourceErrors[tab]) void loadResource(tab, { force: true });
      if (tab === "rewards" && resourceErrors.menuItems) {
        void loadResource("menuItems", { force: true });
      }
    }
  };

  const invalidateAuditLogs = () => {
    loadedResourcesRef.current.delete("auditLogs");
    resourceControllersRef.current.get("auditLogs")?.abort();
    resourceControllersRef.current.delete("auditLogs");
    inFlightResourcesRef.current.delete("auditLogs");
    setLoadingResources((current) => ({ ...current, auditLogs: false }));
    setResourceErrors((current) => ({ ...current, auditLogs: "" }));
  };

  const saveSettings = async (e) => {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const mutationRestaurantId = restaurantId;
    try {
      const saved = await request(`${root}/settings`, { method: "PUT", body: JSON.stringify({ ...settings, pointsExpiryDays: settings.pointsExpiryDays === "" ? null : Number(settings.pointsExpiryDays), pointsPer100: Number(settings.pointsPer100), minimumOrderAmount: Number(settings.minimumOrderAmount), minimumRedemptionPoints: Number(settings.minimumRedemptionPoints), conversionPoints: Number(settings.conversionPoints), conversionInr: Number(settings.conversionInr) }) });
      if (String(activeRestaurantRef.current) !== String(mutationRestaurantId)) return;
      setSettings(saved); setNotice("Loyalty settings saved.");
      invalidateAuditLogs();
    } catch (e2) {
      if (String(activeRestaurantRef.current) === String(mutationRestaurantId)) setError(e2.message);
    } finally {
      if (String(activeRestaurantRef.current) === String(mutationRestaurantId)) setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(blankReward);
    setFormOpen(true);
    void loadResource("menuItems");
  };
  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({ ...blankReward, ...r, startDate: r.startDate ? r.startDate.slice(0, 16) : "", expiryDate: r.expiryDate ? r.expiryDate.slice(0, 16) : "", menuItemId: r.menuItemId || "" });
    setFormOpen(true);
    if (r.rewardType === "FREE_ITEM") void loadResource("menuItems");
  };
  const saveReward = async (e) => {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    const mutationRestaurantId = restaurantId;
    const rewardBeforeSave = rewards.find((reward) => reward.id === editingId);
    const body = { ...form, pointsRequired: Number(form.pointsRequired), menuItemId: form.menuItemId ? Number(form.menuItemId) : null,
      discountPercentage: form.discountPercentage === "" ? null : Number(form.discountPercentage), discountAmount: form.discountAmount === "" ? null : Number(form.discountAmount), maximumDiscount: form.maximumDiscount === "" ? null : Number(form.maximumDiscount), minimumOrderAmount: form.minimumOrderAmount === "" ? null : Number(form.minimumOrderAmount), totalQuantity: form.totalQuantity === "" ? null : Number(form.totalQuantity), remainingQuantity: form.remainingQuantity === "" ? null : Number(form.remainingQuantity), maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions), startDate: form.startDate ? `${form.startDate}:00` : null, expiryDate: form.expiryDate ? `${form.expiryDate}:00` : null };
    try {
      const saved = await request(`${root}/rewards${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PUT" : "POST", body: JSON.stringify(body) });
      if (String(activeRestaurantRef.current) !== String(mutationRestaurantId)) return;
      setRewards((current) => editingId
        ? current.map((reward) => reward.id === editingId ? saved : reward)
        : [saved, ...current]);
      loadedResourcesRef.current.add("rewards");
      if (!editingId) {
        void loadResource("overview", { force: true });
      } else if (rewardBeforeSave?.rewardName !== saved.rewardName) {
        setOverview((current) => current && ({
          ...current,
          popularRewards: (current.popularRewards || []).map((reward) =>
            reward.id === saved.id ? { ...reward, rewardName: saved.rewardName } : reward),
        }));
      }
      invalidateAuditLogs();
      setFormOpen(false);
      setNotice(editingId ? "Reward updated." : "Reward created.");
    } catch (e2) {
      if (String(activeRestaurantRef.current) === String(mutationRestaurantId)) setError(e2.message);
    } finally {
      if (String(activeRestaurantRef.current) === String(mutationRestaurantId)) setSaving(false);
    }
  };
  const toggleReward = async (r) => {
    const mutationRestaurantId = restaurantId;
    try {
      const updated = await request(`${root}/rewards/${r.id}/status`, { method: "PATCH", body: JSON.stringify({ active: !r.active }) });
      if (String(activeRestaurantRef.current) !== String(mutationRestaurantId)) return;
      setRewards((current) => current.map((reward) => reward.id === r.id ? updated : reward));
      invalidateAuditLogs();
    }
    catch (e) {
      if (String(activeRestaurantRef.current) === String(mutationRestaurantId)) setError(e.message);
    }
  };
  const deleteReward = async (r) => {
    if (!window.confirm(`Deactivate and archive "${r.rewardName}"?`)) return;
    const mutationRestaurantId = restaurantId;
    try {
      await request(`${root}/rewards/${r.id}`, { method: "DELETE" });
      if (String(activeRestaurantRef.current) !== String(mutationRestaurantId)) return;
      setRewards((current) => current.filter((reward) => reward.id !== r.id));
      loadedResourcesRef.current.add("rewards");
      invalidateAuditLogs();
      void loadResource("overview", { force: true });
      setNotice("Reward archived.");
    } catch (e) {
      if (String(activeRestaurantRef.current) === String(mutationRestaurantId)) setError(e.message);
    }
  };
  const uploadImage = (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) { setError("Choose a PNG, JPEG, or WebP image under 2 MB."); return; }
    const reader = new FileReader(); reader.onload = () => setForm((f) => ({ ...f, imageUrl: String(reader.result) })); reader.readAsDataURL(file);
  };

  const filteredHistory = history.filter((item) => {
    const query = historySearch.trim().toLowerCase();
    const matchesQuery = !query || [item.customerName, item.customerMobile, item.rewardName, item.redemptionCode, item.orderId]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const statusMatches = historyStatus === "ALL" || String(item.status).toUpperCase() === historyStatus;
    const created = item.createdAt ? new Date(item.createdAt) : null;
    const from = historyFromDate ? new Date(`${historyFromDate}T00:00:00`) : null;
    const to = historyToDate ? new Date(`${historyToDate}T23:59:59.999`) : null;
    const dateMatches = (!from || (created && created >= from)) && (!to || (created && created <= to));
    return matchesQuery && statusMatches && dateMatches;
  });
  const historyPageSize = 10;
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const pagedHistory = filteredHistory.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

  if (!restaurantId) return <div className="rm-empty">Select a restaurant to manage its loyalty program.</div>;
  return <div className="rm-page">
    <header className="rm-heading"><div><span className="rm-eyebrow">CUSTOMER RETENTION</span><h1>Reward Management</h1><p>Manage points, rewards and customer redemptions for this restaurant.</p></div><button className="rm-primary" onClick={openCreate}>＋ Create Reward</button></header>
    {(error || tabError) && <div className="rm-alert rm-error">
      {error || tabError}
      {tabError && <button type="button" onClick={retryCurrentTab}>Retry</button>}
      <button onClick={() => { setError(""); setResourceErrors((current) => ({ ...current, [tab]: "", menuItems: "" })); }}>×</button>
    </div>}
    {notice && <div className="rm-alert rm-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    <nav className="rm-tabs">{["overview", "settings", "rewards", "history"].map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t === "overview" ? "Overview" : t === "settings" ? "Program Settings" : t === "rewards" ? "Manage Rewards" : "Redemption History"}</button>)}</nav>
    {tabLoading ? <div className="rm-loading">Loading loyalty data…</div> : <>
      {tab === "overview" && <><div className="rm-metrics">
        <article><span>Total Loyalty Members</span><strong>{overview?.totalLoyaltyMembers ?? 0}</strong></article>
        <article><span>Points Issued</span><strong>{overview?.totalPointsIssued ?? 0}</strong></article>
        <article><span>Points Redeemed</span><strong>{overview?.totalPointsRedeemed ?? 0}</strong></article>
        <article><span>Available Points Outstanding</span><strong>{overview?.availablePointsOutstanding ?? 0}</strong></article>
        <article><span>Rewards Created</span><strong>{overview?.totalRewardsCreated ?? 0}</strong></article>
        <article><span>Successful Redemptions</span><strong>{overview?.totalSuccessfulRedemptions ?? 0}</strong></article>
      </div><section className="rm-panel"><h2>Recent redemption activity</h2>{(overview?.recentRedemptions || []).length ? <div className="rm-table-wrap"><table><thead><tr><th>Customer</th><th>Reward</th><th>Points</th><th>Order ID</th><th>Status</th></tr></thead><tbody>{overview.recentRedemptions.map(x => <tr key={x.id}><td>{x.customerName}<small>{x.customerMobile}</small></td><td>{x.rewardName}</td><td>{x.pointsUsed}</td><td>{x.orderId || "—"}</td><td><span className="rm-status">{x.status}</span></td></tr>)}</tbody></table></div> : <p className="rm-muted">No redemption activity yet.</p>}</section>
      <section className="rm-panel"><h2>Most popular rewards</h2>{(overview?.popularRewards || []).length ? <div className="rm-popular-list">{overview.popularRewards.map((reward) => <div key={reward.id}><strong>{reward.rewardName}</strong><span>{reward.redemptions} redemptions</span></div>)}</div> : <p className="rm-muted">Reward popularity will appear after customers redeem rewards.</p>}</section>
      <section className="rm-panel"><h2>Points activity</h2><div className="rm-activity-columns"><div><h3>Points earned</h3>{(overview?.pointsEarnedOverTime || []).slice(0, 8).map((item) => <p key={item.id}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"} <b>+{item.points}</b></p>)}</div><div><h3>Points redeemed</h3>{(overview?.pointsRedeemedOverTime || []).slice(0, 8).map((item) => <p key={item.id}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"} <b>−{item.points}</b></p>)}</div></div></section></>}
      {tab === "settings" && <form className="rm-panel rm-settings" onSubmit={saveSettings}><div className="rm-panel-title"><div><h2>Reward Program Settings</h2><p>Changes are applied to future eligible orders.</p></div><label className="rm-switch"><input type="checkbox" checked={!!settings.enabled} onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}/><span>{settings.enabled ? "Enabled" : "Disabled"}</span></label></div>
        <label className="rm-field rm-wide">Points per ₹100 spent<input type="number" min="1" max="10000" value={settings.pointsPer100 ?? 10} onChange={e => setSettings(s => ({ ...s, pointsPer100: e.target.value }))}/><small>Default: 10 points per ₹100.</small></label>
        <label className="rm-field">Minimum eligible order amount (₹)<input type="number" min="0" step="0.01" value={settings.minimumOrderAmount ?? 100} onChange={e => setSettings(s => ({ ...s, minimumOrderAmount: e.target.value }))}/></label>
        <label className="rm-field">Minimum points required to redeem<input type="number" min="1" value={settings.minimumRedemptionPoints ?? 100} onChange={e => setSettings(s => ({ ...s, minimumRedemptionPoints: e.target.value }))}/></label>
        <label className="rm-field">Reward Points Value<input type="number" min="1" step="1" value={settings.conversionPoints ?? 100} onChange={e => setSettings(s => ({ ...s, conversionPoints: e.target.value }))}/><small>Points in the conversion rate.</small></label>
        <label className="rm-field">Equivalent INR Value (₹)<input type="number" min="0.01" step="0.01" value={settings.conversionInr ?? 10} onChange={e => setSettings(s => ({ ...s, conversionInr: e.target.value }))}/><small>Example: 100 points = ₹10.</small></label>
        <label className="rm-field">Points expiry<select value={settings.pointsExpiryDays ?? ""} onChange={e => setSettings(s => ({ ...s, pointsExpiryDays: e.target.value }))}><option value="">Never expire</option><option value="180">180 days</option><option value="365">365 days</option></select></label>
        <label className="rm-field">Custom expiry period<input type="number" min="1" max="3650" placeholder="Set days, or leave blank for Never Expire" value={settings.pointsExpiryDays && ![180,365].includes(Number(settings.pointsExpiryDays)) ? settings.pointsExpiryDays : ""} onChange={e => setSettings(s => ({ ...s, pointsExpiryDays: e.target.value }))}/></label>
        <button className="rm-primary" disabled={saving}>{saving ? "Saving…" : "Save Settings"}</button>
      </form>}
      {tab === "rewards" && <section className="rm-reward-grid">{rewards.length ? rewards.map(r => <article className="rm-reward-card" key={r.id}>{r.imageUrl && <img src={r.imageUrl} alt="" loading="lazy" decoding="async" /> }<div className="rm-reward-content"><span className="rm-status">{r.rewardType.replaceAll("_", " ")}</span><h3>{r.rewardName}</h3><p>{r.description || "—"}</p><strong>{r.pointsRequired} points</strong><small>Quantity: {r.remainingQuantity == null ? "Unlimited" : `${r.remainingQuantity} remaining`} · Redeemed: {r.redemptionCount}</small><small>{r.available ? "Available" : "Unavailable"} · {r.active ? "Active" : "Inactive"}</small><div className="rm-actions"><button onClick={() => openEdit(r)}>Edit</button><button onClick={() => toggleReward(r)}>{r.active ? "Deactivate" : "Activate"}</button><button className="danger" onClick={() => deleteReward(r)}>Archive</button></div></div></article>) : <div className="rm-empty">No rewards created yet. Create your first reward.</div>}</section>}
      {tab === "history" && <><section className="rm-panel"><h2>Redemption History</h2><div className="rm-history-filters"><input aria-label="Search redemptions" placeholder="Search customer, reward, code or order ID" value={historySearch} onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}/><select aria-label="Filter redemption status" value={historyStatus} onChange={e => { setHistoryStatus(e.target.value); setHistoryPage(1); }}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="REDEEMED">Redeemed</option><option value="CANCELLED">Cancelled</option><option value="EXPIRED">Expired</option></select><input aria-label="From date" type="date" value={historyFromDate} onChange={e => { setHistoryFromDate(e.target.value); setHistoryPage(1); }}/><input aria-label="To date" type="date" value={historyToDate} onChange={e => { setHistoryToDate(e.target.value); setHistoryPage(1); }}/></div>{pagedHistory.length ? <div className="rm-table-wrap"><table><thead><tr><th>Customer</th><th>Reward</th><th>Points</th><th>Redemption Code</th><th>Order ID</th><th>Status</th><th>Created</th><th>Redeemed</th></tr></thead><tbody>{pagedHistory.map(x => <tr key={x.id}><td>{x.customerName}<small>{x.customerMobile}</small></td><td>{x.rewardName}</td><td>{x.pointsUsed}</td><td>{x.redemptionCode}</td><td>{x.orderId || "—"}</td><td>{x.status}</td><td>{x.createdAt ? new Date(x.createdAt).toLocaleString() : "—"}</td><td>{x.redeemedAt ? new Date(x.redeemedAt).toLocaleString() : "—"}</td></tr>)}</tbody></table></div> : <p className="rm-muted">No matching redemptions found.</p>}{filteredHistory.length > historyPageSize && <div className="rm-pagination"><button disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>Previous</button><span>Page {historyPage} of {historyPageCount}</span><button disabled={historyPage >= historyPageCount} onClick={() => setHistoryPage(p => p + 1)}>Next</button></div>}</section>
      <section className="rm-panel"><h2>Administrative Audit Log</h2>{auditLogs.length ? <div className="rm-table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Target</th><th>Performed By</th><th>Details</th></tr></thead><tbody>{auditLogs.map(log => <tr key={log.id}><td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</td><td>{log.action}</td><td>{log.targetType} {log.targetId || ""}</td><td>{log.actor}</td><td>{log.details || "—"}</td></tr>)}</tbody></table></div> : <p className="rm-muted">Administrative changes will appear here.</p>}</section></>}
    </>}
    {formOpen && <div className="rm-modal-backdrop"><form className="rm-modal" onSubmit={saveReward}><header><div><span className="rm-eyebrow">{editingId ? "UPDATE REWARD" : "NEW REWARD"}</span><h2>{editingId ? "Edit Reward" : "Create Reward"}</h2></div><button type="button" className="rm-close" onClick={() => setFormOpen(false)}>×</button></header>
      <div className="rm-form-grid"><label className="rm-field rm-wide">Reward name<input required maxLength="120" value={form.rewardName} onChange={e => setForm(f => ({ ...f, rewardName: e.target.value }))}/></label>
      <label className="rm-field rm-wide">Description<textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}/></label>
      <label className="rm-field rm-wide">Reward image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => uploadImage(e.target.files?.[0])}/><small>PNG/JPEG/WebP, maximum 2 MB.</small>{form.imageUrl && <img className="rm-image-preview" src={form.imageUrl} alt="Reward preview"/>}</label>
      <label className="rm-field">Reward type<select value={form.rewardType} onChange={e => { if (e.target.value === "FREE_ITEM") void loadResource("menuItems"); setForm(f => ({ ...f, rewardType: e.target.value })); }}><option value="FREE_ITEM">Free item</option><option value="PERCENTAGE_DISCOUNT">Percentage discount</option><option value="FIXED_DISCOUNT">Fixed amount discount</option></select></label>
      <label className="rm-field">Points required<input type="number" min="1" required value={form.pointsRequired} onChange={e => setForm(f => ({ ...f, pointsRequired: e.target.value }))}/></label>
      {form.rewardType === "FREE_ITEM" && <label className="rm-field rm-wide">Menu item<select required disabled={loadingResources.menuItems} value={form.menuItemId} onChange={e => setForm(f => ({ ...f, menuItemId: e.target.value }))}><option value="">{loadingResources.menuItems ? "Loading menu items…" : "Select an available item"}</option>{menuItems.filter(x => x.available).map(x => <option key={x.id} value={x.id}>{x.itemName} — {money(x.price)}</option>)}</select></label>}
      {form.rewardType === "PERCENTAGE_DISCOUNT" && <><label className="rm-field">Discount percentage<input type="number" min="0.01" max="100" step="0.01" required value={form.discountPercentage ?? ""} onChange={e => setForm(f => ({ ...f, discountPercentage: e.target.value }))}/></label><label className="rm-field">Maximum discount (₹)<input type="number" min="0" step="0.01" value={form.maximumDiscount ?? ""} onChange={e => setForm(f => ({ ...f, maximumDiscount: e.target.value }))}/></label></>}
      {form.rewardType === "FIXED_DISCOUNT" && <label className="rm-field">Discount amount (₹)<input type="number" min="0.01" step="0.01" required value={form.discountAmount ?? ""} onChange={e => setForm(f => ({ ...f, discountAmount: e.target.value }))}/></label>}
      <label className="rm-field">Minimum order amount (₹)<input type="number" min="0" step="0.01" value={form.minimumOrderAmount ?? ""} onChange={e => setForm(f => ({ ...f, minimumOrderAmount: e.target.value }))}/></label>
      <label className="rm-field">Available quantity<input type="number" min="1" value={form.totalQuantity ?? ""} onChange={e => setForm(f => ({ ...f, totalQuantity: e.target.value, remainingQuantity: e.target.value }))}/><small>Leave blank for unlimited quantity.</small></label>
      <label className="rm-field">Maximum redemptions<input type="number" min="1" value={form.maxRedemptions ?? ""} onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}/></label>
      <label className="rm-field">Start date<input type="datetime-local" value={form.startDate || ""} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}/></label>
      <label className="rm-field">Expiry date<input type="datetime-local" value={form.expiryDate || ""} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}/></label>
      <label className="rm-check"><input type="checkbox" checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}/> Active</label></div>
      <footer><button type="button" className="rm-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button className="rm-primary" disabled={saving}>{saving ? "Saving…" : "Save Reward"}</button></footer>
    </form></div>}
  </div>;
}
