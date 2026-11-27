import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE, apiFetch, requireRestaurantId, shortOrderId, useActiveRestaurantId } from "./restaurantApi";
import "./BillingManagement.css";


function listFrom(data) {
  if (Array.isArray(data)) return data;
  return data?.content || data?.orders || data?.data || [];
}
function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount) : "—";
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfLocalDay(value) {
  const date = startOfLocalDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(year, month - 1, day) : null;
}
function formatLocalDateTimeParam(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function getBillingDateBounds(dateFilter, customStartDate, customEndDate) {
  if (dateFilter === "ALL") return { start: null, end: null };
  const today = startOfLocalDay(new Date());
  if (dateFilter === "CUSTOM") {
    const start = parseDateInput(customStartDate);
    const end = parseDateInput(customEndDate);
    if (end) end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (dateFilter === "LAST_MONTH") {
    return {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 1),
    };
  }

  const start = new Date(today);
  if (dateFilter === "LAST_7_DAYS") start.setDate(start.getDate() - 6);
  if (dateFilter === "LAST_15_DAYS") start.setDate(start.getDate() - 14);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default function BillingManagement() {
  const restaurantId = useActiveRestaurantId();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("TODAY");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activeView, setActiveView] = useState("orders");
  const [activeEditor, setActiveEditor] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState("");
  const [paymentSavingOrder, setPaymentSavingOrder] = useState(null);
  const [settings, setSettings] = useState({ menuPriceTaxMode: "EXCLUSIVE", taxRate: "0", serviceChargeEnabled: false, serviceChargeRate: "0" });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [phonePeSettings, setPhonePeSettings] = useState({
    configured: false,
    merchantId: "",
    clientId: "",
    clientVersion: 1,
    environment: "SANDBOX",
    webhookKeyId: "",
    clientSecret: "",
    webhookSecret: "",
    onlinePaymentsEnabled: false,
    partnerIntegrationEnabled: false,
  });
  const [phonePeLoading, setPhonePeLoading] = useState(true);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const paymentHistoryLoadedRef = useRef(false);
  const paymentHistoryRequestRef = useRef(null);
  const paymentHistoryRestaurantIdRef = useRef("");
  const ordersRequestRef = useRef(null);
  const ordersLoadedRef = useRef(false);
  const loadedRestaurantIdRef = useRef("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptPaperSize, setReceiptPaperSize] = useState("80mm");
  const [billPaperSize, setBillPaperSize] = useState("80mm");
  const [billPaperSizes, setBillPaperSizes] = useState({});

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (!restaurantId) return;
    ordersRequestRef.current?.abort();
    const controller = new AbortController();
    ordersRequestRef.current = controller;
    if (!quiet) setLoading(true);
    setError("");
    try {
      const { start, end } = getBillingDateBounds(dateFilter, customStartDate, customEndDate);
      const query = new URLSearchParams({ page: "0", size: "100" });
      if (start) query.set("from", formatLocalDateTimeParam(start));
      if (end) query.set("to", formatLocalDateTimeParam(end));
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/orders?${query}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Could not load orders (HTTP ${response.status}).`);
      const orderList = listFrom(await response.json());
      if (controller.signal.aborted) return;
      setOrders(orderList);
      ordersLoadedRef.current = true;
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "Could not load billing records.");
      }
    } finally {
      if (ordersRequestRef.current === controller) {
        ordersRequestRef.current = null;
        if (!controller.signal.aborted && !quiet) setLoading(false);
      }
    }
  }, [customEndDate, customStartDate, dateFilter, restaurantId]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/billing-settings`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Could not load billing settings (HTTP ${response.status}).`);
      const data = await response.json();
      setSettings({
        menuPriceTaxMode: data.menuPriceTaxMode || "EXCLUSIVE",
        taxRate: String(data.taxRate ?? 0),
        serviceChargeEnabled: Boolean(data.serviceChargeEnabled),
        serviceChargeRate: String(data.serviceChargeRate ?? 0),
      });
    } catch (err) {
      setError(err.message || "Could not load billing settings.");
    } finally {
      setSettingsLoading(false);
    }
  }, [restaurantId]);

  const loadPhonePeSettings = useCallback(async () => {
    if (!restaurantId) return;
    setPhonePeLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/phonepe-settings`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Could not load PhonePe settings (HTTP ${response.status}).`);
      const data = await response.json();
      setPhonePeSettings((current) => ({
        ...current,
        ...data,
        clientSecret: "",
        webhookSecret: "",
      }));
    } catch (err) {
      setError(err.message || "Could not load PhonePe settings.");
    } finally {
      setPhonePeLoading(false);
    }
  }, [restaurantId]);

  const loadPaymentHistory = useCallback(async () => {
    if (!restaurantId || paymentHistoryRequestRef.current) return;
    const controller = new AbortController();
    paymentHistoryRequestRef.current = controller;
    setPaymentHistoryLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/payments`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Could not load payment history (HTTP ${response.status}).`);
      const history = listFrom(await response.json());
      if (controller.signal.aborted) return;
      setPaymentHistory(history);
      paymentHistoryLoadedRef.current = true;
    } catch (err) {
      if (!controller.signal.aborted) {
        paymentHistoryLoadedRef.current = false;
        setError(err.message || "Could not load payment history.");
      }
    } finally {
      if (paymentHistoryRequestRef.current === controller) {
        paymentHistoryRequestRef.current = null;
        if (!controller.signal.aborted) setPaymentHistoryLoading(false);
      }
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setOrders([]);
      setLoading(false);
      ordersLoadedRef.current = false;
      loadedRestaurantIdRef.current = "";
      return;
    }
    const quiet = ordersLoadedRef.current && loadedRestaurantIdRef.current === restaurantId;
    loadedRestaurantIdRef.current = restaurantId;
    loadOrders({ quiet });
    return () => {
      ordersRequestRef.current?.abort();
      ordersRequestRef.current = null;
    };
  }, [loadOrders, restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setSettingsLoading(false);
      setPhonePeLoading(false);
      return;
    }
    loadSettings();
    loadPhonePeSettings();
  }, [loadPhonePeSettings, loadSettings, restaurantId]);

  useEffect(() => {
    if (paymentHistoryRestaurantIdRef.current !== restaurantId) {
      paymentHistoryRequestRef.current?.abort();
      paymentHistoryRequestRef.current = null;
      paymentHistoryRestaurantIdRef.current = restaurantId;
      paymentHistoryLoadedRef.current = false;
      setPaymentHistory([]);
      setPaymentHistoryLoading(false);
    }
    if (!restaurantId) {
      return;
    }
    if (activeView === "payments" && !paymentHistoryLoadedRef.current) {
      loadPaymentHistory();
    }
  }, [activeView, loadPaymentHistory, restaurantId]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [order.orderNumber, order.id, order.tableNumber, order.table?.tableNumber, order.paymentStatus, order.status, order.orderStatus]
      .some((value) => String(value ?? "").toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (dateFilter === "ALL") return true;
    const orderDate = new Date(order.createdAt);
    if (Number.isNaN(orderDate.getTime())) return false;
    const today = startOfLocalDay(new Date());
    if (dateFilter === "TODAY") return orderDate >= today && orderDate <= endOfLocalDay(today);
    if (dateFilter === "LAST_7_DAYS" || dateFilter === "LAST_15_DAYS") {
      const days = dateFilter === "LAST_7_DAYS" ? 7 : 15;
      const start = new Date(today);
      start.setDate(start.getDate() - (days - 1));
      return orderDate >= start && orderDate <= endOfLocalDay(today);
    }
    if (dateFilter === "LAST_MONTH") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return orderDate >= start && orderDate <= end;
    }
    const start = parseDateInput(customStartDate);
    const end = parseDateInput(customEndDate);
    return (!start || orderDate >= startOfLocalDay(start)) && (!end || orderDate <= endOfLocalDay(end));
  }), [orders, search, dateFilter, customStartDate, customEndDate]);

  const openBill = async (order) => {
    setBillPaperSize(billPaperSizes[order.id] || "80mm");
    setSelectedBill(null);
    setSelectedReceipt(null);
    setBillError("");
    setBillLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/orders/${order.id}/bill`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Could not load bill (HTTP ${response.status}).`);
      setSelectedBill(await response.json());
    } catch (err) {
      setBillError(err.message || "Could not load this bill.");
    } finally {
      setBillLoading(false);
    }
  };

  const recordOfflinePayment = async (order, method) => {
    setPaymentSavingOrder(order.id);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/payments/offline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ orderId: order.id, method }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Could not record offline collection (HTTP ${response.status}).`);
      }
      setNotice(`${method === "CASH" ? "Cash" : "Offline UPI"} payment recorded for the complete sitting bill.`);
      paymentHistoryLoadedRef.current = false;
      await Promise.all([loadOrders(), activeView === "payments" ? loadPaymentHistory() : Promise.resolve()]);
    } catch (err) {
      setError(err.message || "Could not record offline collection.");
    } finally {
      setPaymentSavingOrder(null);
    }
  };

  const savePhonePeSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/phonepe-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          merchantId: phonePeSettings.merchantId,
          clientId: phonePeSettings.clientId,
          clientVersion: Number(phonePeSettings.clientVersion),
          environment: phonePeSettings.environment,
          webhookKeyId: phonePeSettings.webhookKeyId,
          clientSecret: phonePeSettings.clientSecret,
          webhookSecret: phonePeSettings.webhookSecret,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || `Could not save PhonePe settings (HTTP ${response.status}).`);
      setPhonePeSettings((current) => ({
        ...current, ...result, clientSecret: "", webhookSecret: "",
      }));
      setNotice(result.onlinePaymentsEnabled
        ? "PhonePe merchant settings saved."
        : "Credentials saved securely. Customer online payments remain disabled until the TexOS provider feature gate is approved.");
      setActiveEditor("");
    } catch (err) {
      setError(err.message || "Could not save PhonePe settings.");
    } finally {
      setSaving(false);
    }
  };

  const openReceipt = useCallback(async (payment) => {
    setSelectedBill(null);
    setSelectedReceipt(null);
    setBillError("");
    setBillLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/payments/${payment.id}/receipt`, {
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Could not load receipt (HTTP ${response.status}).`);
      setSelectedReceipt(data);
    } catch (err) {
      setBillError(err.message || "Could not load payment receipt.");
    } finally {
      setBillLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    const receiptId = new URLSearchParams(location.search).get("receiptId");
    if (!receiptId || !restaurantId) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) openReceipt({ id: receiptId });
    });
    navigate(location.pathname, { replace: true });
    return () => { active = false; };
  }, [location.pathname, location.search, navigate, openReceipt, restaurantId]);

  const recordOrderRefund = async (order) => {
    if (!window.confirm("Record this order as fully refunded? This updates TexOS payment records and reverses loyalty points. It does not initiate a bank or gateway refund.")) return;
    setPaymentSavingOrder(order.id);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/orders/${order.id}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ paymentStatus: "REFUNDED" }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Could not record refund (HTTP ${response.status}).`);
      }
      setNotice("Full refund recorded in TexOS. Earned loyalty points were reversed; spent points are carried as points debt.");
      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not record refund.");
    } finally {
      setPaymentSavingOrder(null);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    const payload = {
      menuPriceTaxMode: settings.menuPriceTaxMode,
      taxRate: Number(settings.taxRate),
      serviceChargeEnabled: settings.serviceChargeEnabled,
      serviceChargeRate: Number(settings.serviceChargeRate),
    };
    if (!Number.isFinite(payload.taxRate) || payload.taxRate < 0 || payload.taxRate > 100 || !Number.isFinite(payload.serviceChargeRate) || payload.serviceChargeRate < 0 || payload.serviceChargeRate > 100) {
      setError("Tax and service charge rates must be between 0 and 100.");
      setSaving(false);
      return;
    }
    try {
      const response = await apiFetch(`${API_BASE}/api/restaurants/${requireRestaurantId(restaurantId)}/billing-settings`, {
        method: "PUT", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Could not save billing settings (HTTP ${response.status}).`);
      }
      setNotice("Billing settings saved successfully. New bills will use these settings.");
      await Promise.all([loadSettings(), loadOrders()]);
      setActiveEditor("");
    } catch (err) {
      setError(err.message || "Could not save billing settings.");
    } finally {
      setSaving(false);
    }
  };

  const printBill = (paperSize = receiptPaperSize) => {
    const receipt = document.querySelector(".bill-modal .bill-print-area");
    if (!receipt) return;

    const previousTitle = document.title;
    const paper = paperSize;
    const printStyleId = "texos-receipt-print-page";
    const printRoot = document.createElement("div");
    const contentWidthMm = paper === "58mm" ? 50 : paper === "A4" ? 194 : 72;
    const documentName = selectedReceipt ? "Receipt" : "Bill";
    document.title = `${selectedReceipt?.restaurantName || selectedBill?.restaurantName || "Restaurant"} ${documentName}`;
    document.body.dataset.texosPrint = paper;
    receipt.style.width = `${contentWidthMm}mm`;
    receipt.style.maxWidth = `${contentWidthMm}mm`;
    printRoot.className = "bill-print-root";
    printRoot.appendChild(receipt.cloneNode(true));
    document.body.appendChild(printRoot);

    const cleanup = () => {
      document.body.removeAttribute("data-texos-print");
      receipt.style.removeProperty("width");
      receipt.style.removeProperty("max-width");
      printRoot.remove();
      document.getElementById(printStyleId)?.remove();
      document.title = previousTitle;
      window.removeEventListener("afterprint", cleanup);
    };

    // Measure after the receipt has reflowed at the selected paper width.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const widthMm = paper === "58mm" ? 58 : paper === "A4" ? 210 : 80;
      const heightPx = Math.ceil(receipt.scrollHeight + 32);
      const scale = paper === "A4" ? Math.min(1, 1058 / heightPx) : 1;
      const pageHeight = paper === "A4" ? "297mm" : `${Math.max(100, Math.ceil(heightPx * scale))}px`;

      document.getElementById(printStyleId)?.remove();
      const style = document.createElement("style");
      style.id = printStyleId;
      style.textContent = `
        @page { size: ${paper === "A4" ? "A4 portrait" : `${widthMm}mm ${pageHeight}`}; margin: 0; }
        @media print {
          .bill-print-root { display: block !important; width: 100% !important; }
          .bill-print-area {
            width: ${contentWidthMm}mm !important;
            max-width: ${contentWidthMm}mm !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            transform: scale(${scale}) !important;
            transform-origin: top center !important;
          }
        }
      `;
      document.head.appendChild(style);
      window.addEventListener("afterprint", cleanup, { once: true });
      window.print();
    }));
  };
  const billItems = selectedBill?.items || selectedBill?.orderItems || selectedBill?.order?.items || [];


  return (
    <section className="bill-page">
      <div className="bill-heading">
        <div>
          <p className="bill-eyebrow">RESTAURANT FINANCE</p>
          <h1>Billing Management</h1>
          <p>Review order bills and configure tax and service charges.</p>
        </div>
        <div className="bill-heading-actions">
          <div className="bill-section-tabs" aria-label="Billing section">
            <button type="button" className={activeView === "orders" ? "is-active" : ""} aria-pressed={activeView === "orders"} onClick={() => { setActiveEditor(""); setActiveView("orders"); }}>Order Bill</button>
            <button type="button" className={activeView === "payments" ? "is-active" : ""} aria-pressed={activeView === "payments"} onClick={() => { setActiveEditor(""); setActiveView("payments"); }}>Payment History</button>
          </div>
          {activeView === "orders" ? <>
            <select className="bill-date-select" aria-label="Filter billing records by date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
              <option value="LAST_7_DAYS">Last 7 days</option>
              <option value="ALL">All dates</option>
              <option value="TODAY">Today</option>
              <option value="LAST_15_DAYS">Last 15 days</option>
              <option value="LAST_MONTH">Last month</option>
              <option value="CUSTOM">Custom dates</option>
            </select>
            {dateFilter === "CUSTOM" && <div className="bill-custom-dates bill-heading-custom-dates">
              <label>From<input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} /></label>
              <label>To<input type="date" min={customStartDate || undefined} value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} /></label>
            </div>}
            <button type="button" className="bill-refresh" onClick={loadOrders} disabled={loading}>↻ Refresh</button>
          </> : <button type="button" className="bill-refresh" onClick={loadPaymentHistory} disabled={paymentHistoryLoading}>↻ Refresh</button>}
        </div>
      </div>
      {error && <div className="bill-alert bill-alert-error" role="alert">{error}</div>}
      {notice && <div className="bill-alert bill-alert-success" role="status">{notice}</div>}

      <div className="bill-settings-grid">
        <section className="bill-card bill-settings-card">
          <div className="bill-card-heading">
            <div>
              <h2>Billing settings</h2>
              <p>Applied when new bills are generated.</p>
            </div>
            <button type="button" className="bill-view-button bill-settings-edit" aria-expanded={activeEditor === "billing"} onClick={() => setActiveEditor((current) => current === "billing" ? "" : "billing")} disabled={settingsLoading}>
              {activeEditor === "billing" ? "Close" : "Edit Bill Settings"}
            </button>
          </div>
          {activeEditor === "billing" ? <form onSubmit={saveSettings} className="bill-settings-form">
            <label>Menu price tax mode
              <select value={settings.menuPriceTaxMode} onChange={(event) => setSettings((current) => ({ ...current, menuPriceTaxMode: event.target.value }))}>
                <option value="INCLUSIVE">Tax inclusive</option><option value="EXCLUSIVE">Tax exclusive</option>
              </select>
            </label>
            <label>Tax rate (%)
              <input type="number" min="0" max="100" step="0.01" value={settings.taxRate} onChange={(event) => setSettings((current) => ({ ...current, taxRate: event.target.value }))} />
            </label>
            <label className="bill-toggle-row"><span><strong>Service charge</strong><small>Apply a service charge to the menu subtotal.</small></span><input type="checkbox" checked={settings.serviceChargeEnabled} onChange={(event) => setSettings((current) => ({ ...current, serviceChargeEnabled: event.target.checked }))} /></label>
            <label>Service charge rate (%)
              <input type="number" min="0" max="100" step="0.01" disabled={!settings.serviceChargeEnabled} value={settings.serviceChargeRate} onChange={(event) => setSettings((current) => ({ ...current, serviceChargeRate: event.target.value }))} />
            </label>
            <p className="bill-form-note">Saved settings are loaded from your restaurant account. Changes apply to newly generated bills.</p>
            <button className="bill-primary" type="submit" disabled={saving || settingsLoading}>{saving ? "Saving…" : "Save billing settings"}</button>
          </form> : <p className="bill-settings-summary">{settingsLoading ? "Loading saved billing settings…" : `${settings.menuPriceTaxMode === "INCLUSIVE" ? "Tax inclusive" : "Tax exclusive"} · Tax ${settings.taxRate}% · Service charge ${settings.serviceChargeEnabled ? `${settings.serviceChargeRate}%` : "off"}`}</p>}
        </section>

        <section className="bill-card bill-settings-card bill-phonepe-settings-card">
          <div className="bill-card-heading">
            <div>
              <h2>PhonePe merchant account</h2>
              <p>Configure this restaurant's approved PhonePe merchant account.</p>
            </div>
            <button type="button" className="bill-view-button bill-settings-edit" aria-expanded={activeEditor === "phonepe"} onClick={() => setActiveEditor((current) => current === "phonepe" ? "" : "phonepe")} disabled={phonePeLoading}>
              {activeEditor === "phonepe" ? "Close" : "Edit Merchant Account"}
            </button>
          </div>
          {activeEditor === "phonepe" ? <form onSubmit={savePhonePeSettings} className="bill-settings-form">
            <label>Merchant ID
              <input required value={phonePeSettings.merchantId} onChange={(event) => setPhonePeSettings((current) => ({ ...current, merchantId: event.target.value }))} autoComplete="off" />
            </label>
            <label>Client ID
              <input required value={phonePeSettings.clientId} onChange={(event) => setPhonePeSettings((current) => ({ ...current, clientId: event.target.value }))} autoComplete="off" />
            </label>
            <label>Client version
              <input required type="number" min="1" value={phonePeSettings.clientVersion} onChange={(event) => setPhonePeSettings((current) => ({ ...current, clientVersion: event.target.value }))} />
            </label>
            <label>Environment
              <select value={phonePeSettings.environment} onChange={(event) => setPhonePeSettings((current) => ({ ...current, environment: event.target.value }))}>
                <option value="SANDBOX">Sandbox</option><option value="PRODUCTION">Production</option>
              </select>
            </label>
            <label>Client secret
              <input type="password" value={phonePeSettings.clientSecret} onChange={(event) => setPhonePeSettings((current) => ({ ...current, clientSecret: event.target.value }))} placeholder={phonePeSettings.configured ? "Saved securely — leave blank to keep" : "Required for initial setup"} autoComplete="new-password" />
            </label>
            <label>Webhook key ID
              <input required value={phonePeSettings.webhookKeyId} onChange={(event) => setPhonePeSettings((current) => ({ ...current, webhookKeyId: event.target.value }))} autoComplete="off" />
            </label>
            <label>Webhook secret
              <input type="password" value={phonePeSettings.webhookSecret} onChange={(event) => setPhonePeSettings((current) => ({ ...current, webhookSecret: event.target.value }))} placeholder={phonePeSettings.configured ? "Saved securely — leave blank to keep" : "Required for initial setup"} autoComplete="new-password" />
            </label>
            <p className="bill-form-note">
              Credentials are encrypted and saved for this restaurant. Ensure PhonePe has approved direct settlement to this restaurant; TexOS will not receive restaurant payments.
              {!phonePeSettings.onlinePaymentsEnabled && " Customer checkout remains disabled until the administrator enables the approved integration."}
            </p>
            {phonePeSettings.partnerIntegrationEnabled && <p className="bill-form-note">PhonePe Partner Integration is active; confirm the restaurant's Merchant ID is provisioned for TexOS.</p>}
            <button className="bill-primary" type="submit" disabled={saving || phonePeLoading}>{saving ? "Saving…" : "Save PhonePe settings"}</button>
          </form> : <p className="bill-settings-summary">{phonePeLoading ? "Loading saved PhonePe configuration…" : `${phonePeSettings.configured ? "Merchant credentials configured" : "Merchant account not configured"} · ${phonePeSettings.environment} · ${phonePeSettings.onlinePaymentsEnabled ? "Online payments enabled" : "Online payments disabled"}`}</p>}
        </section>
      </div>

      {activeView === "orders" ? <section className="bill-card bill-orders-card">
        <div className="bill-card-heading"><div><h2>Order bills</h2><p>Orders from the same table sitting are combined into one bill. All related order IDs appear on the bill.</p></div><span className="bill-count">{filteredOrders.length} of {orders.length} orders</span></div>
        <div className="bill-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, table or payment status…"/></div>
        {loading ? <div className="bill-empty">Loading billing records…</div> : filteredOrders.length === 0 ? <div className="bill-empty">No matching orders found.</div> : (
          <div className="bill-table-wrap"><table className="bill-table"><thead><tr><th>ORDER</th><th>TABLE</th><th>AMOUNT</th><th>PAYMENT</th><th>DATE</th><th>ACTIONS</th></tr></thead><tbody>
            {filteredOrders.map((order) => <tr key={order.id || order.orderNumber}>
              <td><strong>{shortOrderId(order.orderNumber, order.id)}</strong></td>
              <td>{order.tableNumber || order.table?.tableNumber || "—"}</td>
              <td>{money(order.totalAmount ?? order.bill?.totalAmount)}</td>
              <td><span className={`bill-status ${(order.paymentStatus || "pending").toLowerCase()}`}>{order.paymentStatus || "UNKNOWN"}</span></td>
              <td>{formatDate(order.createdAt)}</td>
              <td>
                <div className="bill-row-actions">
                  {order.paymentStatus === "PENDING" && <>
                    <button className="bill-view-button" disabled={paymentSavingOrder === order.id} onClick={() => recordOfflinePayment(order, "CASH")}>{paymentSavingOrder === order.id ? "Saving…" : "Cash"}</button>
                    <button className="bill-view-button" disabled={paymentSavingOrder === order.id} onClick={() => recordOfflinePayment(order, "OFFLINE_UPI")}>Offline UPI</button>
                  </>}
                  {order.paymentStatus === "PAID" && <button className="bill-view-button" disabled={paymentSavingOrder === order.id} onClick={() => recordOrderRefund(order)}>{paymentSavingOrder === order.id ? "Saving…" : "Record refund"}</button>}
                  <button className="bill-view-button" onClick={() => openBill(order)}>View bill</button>
                  <select
                    className="bill-paper-select bill-row-paper-select"
                    aria-label={`Paper size for order ${shortOrderId(order.orderNumber, order.id)}`}
                    value={billPaperSizes[order.id] || "80mm"}
                    onChange={(event) => {
                      const paperSize = event.target.value;
                      setBillPaperSize(paperSize);
                      setBillPaperSizes((current) => ({ ...current, [order.id]: paperSize }));
                    }}
                  >
                    <option value="80mm">Thermal 80 mm</option>
                    <option value="58mm">Thermal 58 mm</option>
                    <option value="A4">A4 PDF / printer</option>
                  </select>
                </div>
              </td>
            </tr>)}
          </tbody></table></div>
        )}
      </section> : <section className="bill-card bill-payment-history-card">
        <div className="bill-card-heading"><div><h2>Payment history</h2><p>Verified PhonePe payments and authorized offline collections.</p></div><span className="bill-count">{paymentHistory.length} payments</span></div>
        {paymentHistoryLoading ? <div className="bill-empty">Loading payment history…</div> : paymentHistory.length === 0 ? <div className="bill-empty">No payments have been recorded yet.</div> : (
          <div className="bill-table-wrap"><table className="bill-table"><thead><tr><th>DATE</th><th>ORDERS</th><th>TABLE</th><th>AMOUNT</th><th>METHOD</th><th>STATUS</th><th>RECEIPT</th></tr></thead><tbody>
            {paymentHistory.map((payment) => <tr key={payment.transactionId}><td>{formatDate(payment.paidAt || payment.createdAt)}</td><td>{(payment.orderNumbers || []).map((number) => shortOrderId(number)).join(", ") || "—"}</td><td>{payment.tableNumber || "—"}</td><td>{money(payment.amount)}</td><td>{payment.paymentMethod || "—"}</td><td><span className={`bill-status ${String(payment.paymentStatus || "").toLowerCase()}`}>{payment.paymentStatus || "UNKNOWN"}</span></td><td>{payment.paymentStatus === "PAID" && <button className="bill-view-button" onClick={() => openReceipt({ id: payment.transactionId })}>View receipt</button>}</td></tr>)}
          </tbody></table></div>
        )}
      </section>}

      {(billLoading || billError || selectedBill || selectedReceipt) && <div className="bill-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSelectedBill(null); setSelectedReceipt(null); setBillError(""); } }}>
        <section className="bill-modal" role="dialog" aria-modal="true" aria-label="Order bill">
          <button className="bill-modal-close" onClick={() => { setSelectedBill(null); setSelectedReceipt(null); setBillError(""); }} aria-label="Close">×</button>
          {billLoading ? <div className="bill-empty">Loading bill…</div> : billError ? <div className="bill-alert bill-alert-error">No Bill for Canceled Order : {billError}</div> : selectedBill && <>
            <div className="bill-print-area"><div className="bill-receipt-head"><h2>{selectedBill.restaurantName || "Restaurant"} Bill</h2><p>Order IDs: {(selectedBill.orderNumbers?.length ? selectedBill.orderNumbers : [selectedBill.orderNumber]).map((number, index) => shortOrderId(number, selectedBill.orderIds?.[index])).join(", ")}</p><p>Bill ID: {selectedBill.billNumber || "—"}</p></div>
              <div className="bill-receipt-meta"><span>Date</span><strong>{formatDate(selectedBill.billDate || selectedBill.createdAt)}</strong></div>
              {billItems.length > 0 && <table className="bill-receipt-items"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{billItems.map((item, index) => <tr key={item.id || index}><td>{item.itemName || item.name || "Item"}{item.customization && <small className="bill-item-customization">Request: {item.customization}</small>}</td><td>{item.quantity || 1}</td><td>{money(item.lineTotal ?? item.totalPrice ?? item.unitPrice)}</td></tr>)}</tbody></table>}
              <div className="bill-receipt-totals"><p><span>Subtotal</span><strong>{money(selectedBill.subtotal)}</strong></p><p><span>Tax</span><strong>{money(selectedBill.taxAmount)}</strong></p><p><span>Service charge</span><strong>{money(selectedBill.serviceChargeAmount)}</strong></p>{Number(selectedBill.rewardDiscountAmount) > 0 && <p><span>Cashback applied</span><strong>−{money(selectedBill.rewardDiscountAmount)}</strong></p>}<p className="bill-grand-total"><span>Total</span><strong>{money(selectedBill.totalAmount)}</strong></p></div>
              <div className="bill-receipt-foot">Payment status: {selectedBill.paymentStatus || selectedBill.order?.paymentStatus || "See order details"}</div>
            </div><div className="bill-modal-actions"><button className="bill-primary" onClick={() => printBill(billPaperSize)}>Print bill</button></div>
          </>}
          {!billLoading && !billError && selectedReceipt && <>
            <div className="bill-print-area bill-receipt-print-area">
              <div className="bill-receipt-head">
                <span className="bill-receipt-mark">T</span>
                <h2>{selectedReceipt.restaurantName || "Restaurant"}</h2>
                {selectedReceipt.restaurantAddress && <p>{selectedReceipt.restaurantAddress}</p>}
                {selectedReceipt.restaurantPhone && <p>{selectedReceipt.restaurantPhone}</p>}
                <small>Receipt {selectedReceipt.receiptNumber}</small>
              </div>
              <div className="bill-receipt-meta"><span>Paid</span><strong>{formatDate(selectedReceipt.paymentDate)}</strong></div>
              <div className="bill-receipt-meta"><span>Customer</span><strong>{selectedReceipt.customerName || "Guest"}</strong></div>
              <div className="bill-receipt-meta"><span>Order / Bill</span><strong>{(selectedReceipt.orderNumbers || []).map((number) => shortOrderId(number)).join(", ")} / {(selectedReceipt.billNumbers || []).join(", ")}</strong></div>
              <div className="bill-receipt-meta"><span>Table</span><strong>{selectedReceipt.tableNumber || "—"}</strong></div>
              <table className="bill-receipt-items"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
                {(selectedReceipt.items || []).map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}{item.customization && <small className="bill-item-customization">Request: {item.customization}</small>}</td><td>{item.quantity}</td><td>{money(item.lineTotal)}</td></tr>)}
              </tbody></table>
              <div className="bill-receipt-totals"><p><span>Payment method</span><strong>{selectedReceipt.paymentMethod || "—"}</strong></p><p><span>Reference</span><strong>{selectedReceipt.paymentReference || "—"}</strong></p><p className="bill-grand-total"><span>Total paid</span><strong>{money(selectedReceipt.totalAmount)}</strong></p></div>
              <div className="bill-receipt-foot">Payment status: {selectedReceipt.paymentStatus}</div>
            </div>
            <div className="bill-modal-actions bill-receipt-actions">
              <label className="bill-paper-select-label">Paper
                <select className="bill-paper-select" value={receiptPaperSize} onChange={(event) => setReceiptPaperSize(event.target.value)}>
                  <option value="80mm">Thermal 80 mm</option>
                  <option value="58mm">Thermal 58 mm</option>
                  <option value="A4">A4 PDF / printer</option>
                </select>
              </label>
              <button className="bill-primary" onClick={printBill}>Print receipt</button>
            </div>
          </>}
        </section>
      </div>}
    </section>
  );
}
