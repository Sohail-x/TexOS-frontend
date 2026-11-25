import { lazy, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE, apiFetch, setActiveRestaurantId, shortOrderId, useActiveRestaurantId } from "./restaurantApi";
import { clearAuthSession } from "./authSession";
import { useLiveUpdates } from "./useLiveUpdates";
import "./Dashboard.css";
import "./DashboardUpdates.css";

const Orders = lazy(() => import("./Orders"));
const KitchenDisplay = lazy(() => import("./KitchenDisplay"));
const MenuManagement = lazy(() => import("./MenuManagement"));
const TablesAndQR = lazy(() => import("./TablesAndQR"));
const BillingManagement = lazy(() => import("./BillingManagement"));
const ReportsAnalytics = lazy(() => import("./ReportsAnalytics"));
const Customers = lazy(() => import("./Customers"));
const RewardManagement = lazy(() => import("./RewardManagement"));
const Settings = lazy(() => import("./Settings"));
const SubscriptionPage = lazy(() => import("./SubscriptionPage"));

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></>,
    chef: <><path d="M6 13a4 4 0 1 1 1-7.9A5 5 0 0 1 17 7a3.5 3.5 0 0 1 1 6.9V20H6v-7Z"/><path d="M9 16h6"/></>,
    menu: <><path d="M4 5h16M4 12h16M4 19h16"/></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v2M17 20h4M20 18v3"/></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 2.3-3.5L12 8Zm0 0h4.5a2.5 2.5 0 1 0-2.3-3.5L12 8Z"/></>, 
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4.93 10A8 8 0 0 1 19 7l1 5"/><path d="M4 17v-5h5"/><path d="M19.07 14A8 8 0 0 1 5 17l-1-5"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/></>,
    trend: <><path d="m3 17 6-6 4 3 8-8"/><path d="M15 6h6v6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  };
  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}



const navItems = [
  { label: "Overview", path: "/dashboard", icon: "grid" },
  { label: "Orders", path: "/dashboard/orders", icon: "bag" },
  { label: "Kitchen Display", path: "/dashboard/kitchen", icon: "chef" },
  { label: "Menu Management", path: "/dashboard/menu", icon: "menu" },
  { label: "Tables & QR", path: "/dashboard/tables", icon: "qr" },
  { label: "Billing", path: "/dashboard/billing", icon: "receipt" },
  { label: "Customers", path: "/dashboard/customers", icon: "users" },
  { label: "Reward Management", path: "/dashboard/rewards", icon: "gift" },
  { label: "Reports & Analytics", path: "/dashboard/reports", icon: "chart" },
];

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  return data?.content || data?.orders || data?.recentOrders || data?.activeOrders || data?.data || [];
}

function firstValue(source, keys, fallback = null) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
}

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
}

function loadSeenAnnouncementIds(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set();
  }
}

function dateLabel(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function exactDateTime(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString("en-IN", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}

function orderStatusTone(status) {
  const value = String(status || "NEW").toUpperCase();
  if (["READY", "SERVED"].includes(value)) return "green";
  if (["PREPARING", "ACCEPTED"].includes(value)) return "amber";
  if (value === "CANCELLED") return "gray";
  return "blue";
}

function MetricCard({ title, value, icon, note }) {
  return (
    <article className="db-metric-card">
      <div className="db-metric-top">
        <span className="db-metric-icon"><Icon name={icon} size={19} /></span>
        <span className="db-metric-change">LIVE DATA</span>
      </div>
      <p className="db-metric-title">{title}</p>
      <strong className="db-metric-value">{value}</strong>
      <span className="db-metric-note">{note}</span>
    </article>
  );
}

export default function Dashboard() {
  const restaurantId = useActiveRestaurantId();
  const [restaurants, setRestaurants] = useState([]);
  const [owner, setOwner] = useState(() => {
    try { return JSON.parse(localStorage.getItem("texos-owner") || "null"); } catch { return null; }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementPopup, setAnnouncementPopup] = useState(null);
  const [announcementQueue, setAnnouncementQueue] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const announcementSeenStorageKey =
    `texos-seen-announcements-${owner?.ownerId ?? owner?.id ?? "account"}`;
  const seenAnnouncementIds = useRef(new Set());
  const activeAnnouncementPopup = useRef(null);
  const paymentNotificationRef = useRef(null);
  const paymentNotificationLoadInFlight = useRef(false);
  const paymentNotificationRequestRef = useRef(null);
  const overviewRequestRef = useRef(null);
  const announcementRequestRef = useRef(null);
  const liveConnectedRef = useRef(false);
  const refreshAnnouncementsRef = useRef(null);
  const overviewRefreshTimer = useRef(null);
  const [paymentNotification, setPaymentNotification] = useState(null);
  const [paymentNotificationError, setPaymentNotificationError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("texos-theme") || "light");
  const navigate = useNavigate();
  const location = useLocation();

  const activeItem = navItems.find((item) => item.path === location.pathname);
  const active = activeItem?.label
    || (location.pathname === "/dashboard/support" ? "Support"
    : location.pathname === "/dashboard/settings" ? "Settings"
    : location.pathname === "/dashboard/subscription" ? "Subscription"
    : location.pathname === "/dashboard/rewards" ? "Reward Management"
    : "Overview");
  const ownerName = owner?.fullName?.trim() || "Restaurant Owner";
  const currentPaymentNotification =
    paymentNotification?.restaurantId === String(restaurantId) ? paymentNotification : null;

  const goTo = (path) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadOwnerContext() {
      try {
        const response = await apiFetch(`${API_BASE}/api/auth/me`);
        if (!response.ok) throw new Error(`Unable to load account (HTTP ${response.status})`);
        const data = await response.json();
        if (cancelled) return;
        const account = data.owner || data;
        const ownedRestaurants = data.restaurants || account.restaurants || [];
        setOwner(account);
        setRestaurants(ownedRestaurants);
        localStorage.setItem("texos-owner", JSON.stringify({
          ownerId: account.ownerId ?? account.id,
          fullName: account.fullName,
          email: account.email,
          phone: account.phone,
          avatarIcon: account.avatarIcon,
          avatarImage: account.avatarImage,
        }));
        const current = localStorage.getItem("texos-active-restaurant");
        if (!current || !ownedRestaurants.some((r) => String(r.restaurantId ?? r.id) === String(current))) {
          setActiveRestaurantId(ownedRestaurants[0]?.restaurantId ?? ownedRestaurants[0]?.id ?? "");
        }
      } catch (error) {
        setOverviewError(error.message || "Could not load your restaurant account.");
      }
    }
    loadOwnerContext();
    return () => { cancelled = true; };
  }, []);

  const loadOverview = useCallback(async (quiet = false) => {
    if (!restaurantId) {
      setSummary(null); setRecentOrders([]); setActiveOrders([]);
      setLoadingOverview(false);
      return;
    }
    if (overviewRequestRef.current) return;
    const controller = new AbortController();
    overviewRequestRef.current = controller;
    if (!quiet) setLoadingOverview(true);
    setOverviewError("");
    try {
      const base = `${API_BASE}/api/restaurants/${restaurantId}/dashboard`;
      const requests = await Promise.allSettled([
        apiFetch(`${base}/summary`, { signal: controller.signal }),
        apiFetch(`${base}/recent-orders`, { signal: controller.signal }),
        apiFetch(`${base}/active-orders`, { signal: controller.signal }),
      ]);

      const results = await Promise.all(requests.map(async (result) => {
        if (result.status !== "fulfilled") throw result.reason;
        const response = result.value;
        if (!response.ok) throw new Error(`Dashboard API returned HTTP ${response.status}`);
        return response.json();
      }).map((promise) => promise.catch((error) => ({ __error: error.message }))));
      if (controller.signal.aborted) return;

      const [summaryData, recentData, activeData] = results;
      if (!summaryData?.__error) setSummary(summaryData?.summary || summaryData?.data || summaryData);
      if (!recentData?.__error) setRecentOrders(unwrapList(recentData));
      if (!activeData?.__error) setActiveOrders(unwrapList(activeData));

      const errors = results.filter((item) => item?.__error).map((item) => item.__error);
      if (errors.length === 3) setOverviewError("Could not load dashboard data. Check that the backend is running and the restaurant ID is correct.");
      else if (errors.length) setOverviewError("Some dashboard sections could not be loaded. Check the backend response.");
    } finally {
      if (overviewRequestRef.current === controller) {
        overviewRequestRef.current = null;
        if (!controller.signal.aborted) setLoadingOverview(false);
      }
    }
  }, [restaurantId]);

  const loadNextPaymentNotification = useCallback(async () => {
    if (!restaurantId
      || paymentNotificationRef.current?.restaurantId === String(restaurantId)
      || paymentNotificationLoadInFlight.current) return;
    paymentNotificationLoadInFlight.current = true;
    const controller = new AbortController();
    paymentNotificationRequestRef.current = controller;
    try {
      const response = await apiFetch(
        `${API_BASE}/api/restaurants/${restaurantId}/payments/notifications/next`,
        { signal: controller.signal },
      );
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data?.message || "Could not load payment notifications.");
      if (data?.notificationId) {
        const notification = { ...data, restaurantId: String(restaurantId) };
        paymentNotificationRef.current = notification;
        setPaymentNotification(notification);
        setPaymentNotificationError("");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setPaymentNotificationError(error.message || "Could not load payment notifications.");
      }
    } finally {
      if (paymentNotificationRequestRef.current === controller) {
        paymentNotificationRequestRef.current = null;
        paymentNotificationLoadInFlight.current = false;
      }
    }
  }, [restaurantId]);

  useEffect(() => () => {
    paymentNotificationRequestRef.current?.abort();
    paymentNotificationRequestRef.current = null;
    paymentNotificationLoadInFlight.current = false;
  }, [restaurantId]);

  const scheduleOverviewRefresh = useCallback(() => {
    if (overviewRefreshTimer.current) {
      window.clearTimeout(overviewRefreshTimer.current);
    }
    overviewRefreshTimer.current = window.setTimeout(() => {
      overviewRefreshTimer.current = null;
      if (location.pathname === "/dashboard") loadOverview(true);
    }, 120);
  }, [loadOverview, location.pathname]);

  useEffect(() => () => {
    if (overviewRefreshTimer.current) {
      window.clearTimeout(overviewRefreshTimer.current);
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== "/dashboard") return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!restaurantId) {
        setLoadingOverview(false);
        return;
      }
      loadOverview();
    });
    return () => {
      active = false;
      overviewRequestRef.current?.abort();
      overviewRequestRef.current = null;
    };
  }, [location.pathname, restaurantId, loadOverview]);

  useEffect(() => {
    paymentNotificationRef.current = paymentNotification;
    if (!restaurantId
      || paymentNotification?.restaurantId === String(restaurantId)) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadNextPaymentNotification();
    });
    return () => {
      active = false;
    };
  }, [loadNextPaymentNotification, paymentNotification, restaurantId]);

  useEffect(() => {
    let active = true;
    seenAnnouncementIds.current = loadSeenAnnouncementIds(announcementSeenStorageKey);
    const pollAnnouncements = async () => {
      if (announcementRequestRef.current) return;
      const controller = new AbortController();
      announcementRequestRef.current = controller;
      try {
        const response = await apiFetch(`${API_BASE}/api/announcements/active`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(data?.message || `Could not load notifications (HTTP ${response.status}).`);
        if (!active) return;
        setNotificationsError("");
        const currentAnnouncements = Array.isArray(data) ? data : [];
        setAnnouncements(currentAnnouncements);
        const currentIds = new Set(
          currentAnnouncements.map((announcement) => String(announcement.id)),
        );
        seenAnnouncementIds.current.forEach((id) => {
          if (!currentIds.has(id)) seenAnnouncementIds.current.delete(id);
        });
        const freshAnnouncements = currentAnnouncements.filter(
          (announcement) => !seenAnnouncementIds.current.has(String(announcement.id)),
        );
        freshAnnouncements.forEach((announcement) =>
          seenAnnouncementIds.current.add(String(announcement.id)));
        try {
          localStorage.setItem(
            announcementSeenStorageKey,
            JSON.stringify([...seenAnnouncementIds.current]),
          );
        } catch (storageError) {
          console.error("Could not persist seen announcement IDs.", storageError);
        }
        if (freshAnnouncements.length === 0) return;
        if (!activeAnnouncementPopup.current) {
          activeAnnouncementPopup.current = freshAnnouncements[0];
          setAnnouncementPopup(freshAnnouncements[0]);
          setAnnouncementQueue((queue) => [...queue, ...freshAnnouncements.slice(1)]);
        } else {
          setAnnouncementQueue((queue) => [...queue, ...freshAnnouncements]);
        }
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setNotificationsError(error.message || "Could not load TexOS announcements.");
        }
      } finally {
        if (announcementRequestRef.current === controller) {
          announcementRequestRef.current = null;
        }
      }
    };
    refreshAnnouncementsRef.current = pollAnnouncements;
    pollAnnouncements();
    return () => {
      active = false;
      announcementRequestRef.current?.abort();
      announcementRequestRef.current = null;
      refreshAnnouncementsRef.current = null;
    };
  }, [announcementSeenStorageKey]);

  const dashboardTopics = [
    ...(restaurantId ? [{
      destination: `/topic/restaurants/${restaurantId}/dashboard-updates`,
      onMessage: (event) => {
        if (event?.type === "PAYMENT_NOTIFICATIONS_CHANGED") {
          loadNextPaymentNotification();
        }
        scheduleOverviewRefresh();
      },
    }] : []),
    {
      destination: "/topic/announcements",
      onMessage: () => refreshAnnouncementsRef.current?.(),
    },
  ];

  useLiveUpdates({
    enabled: Boolean(localStorage.getItem("texos-token")),
    token: localStorage.getItem("texos-token") || "",
    subscriptions: dashboardTopics,
    onConnected: () => {
      if (!liveConnectedRef.current) {
        liveConnectedRef.current = true;
        return;
      }
      scheduleOverviewRefresh();
      loadNextPaymentNotification();
      refreshAnnouncementsRef.current?.();
    },
    fallbacks: [
      { intervalMs: 5000, callback: loadNextPaymentNotification },
      {
        intervalMs: 30000,
        callback: () => {
          if (location.pathname === "/dashboard") loadOverview(true);
        },
      },
      { intervalMs: 30000, callback: () => refreshAnnouncementsRef.current?.() },
    ],
  });

  const closeAnnouncementPopup = () => {
    const nextAnnouncement = announcementQueue[0] || null;
    activeAnnouncementPopup.current = nextAnnouncement;
    setAnnouncementPopup(nextAnnouncement);
    setAnnouncementQueue((queue) => queue.slice(1));
  };

  const closePaymentNotification = async () => {
    if (!currentPaymentNotification?.notificationId) return;
    try {
      const response = await apiFetch(
        `${API_BASE}/api/restaurants/${restaurantId}/payments/notifications/${currentPaymentNotification.notificationId}/dismiss`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(`Could not dismiss notification (HTTP ${response.status}).`);
      setPaymentNotification(null);
    } catch (error) {
      setPaymentNotificationError(error.message || "Could not dismiss notification.");
    }
  };

  const assignWaiter = async () => {
    if (!currentPaymentNotification?.notificationId) return;
    try {
      const response = await apiFetch(
        `${API_BASE}/api/restaurants/${restaurantId}/payments/notifications/${currentPaymentNotification.notificationId}/assign`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Could not assign this waiter request.");
      setPaymentNotification(null);
      setPaymentNotificationError("");
    } catch (error) {
      setPaymentNotificationError(error.message || "Could not assign this waiter request.");
    }
  };

  const openPaymentReceipt = async () => {
    if (!currentPaymentNotification?.transactionId) return;
    try {
      const response = await apiFetch(
        `${API_BASE}/api/restaurants/${restaurantId}/payments/notifications/${currentPaymentNotification.notificationId}/dismiss`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(`Could not close payment notification (HTTP ${response.status}).`);
      const receiptPath = `/dashboard/billing?receiptId=${encodeURIComponent(currentPaymentNotification.transactionId)}`;
      setPaymentNotification(null);
      goTo(receiptPath);
    } catch (error) {
      setPaymentNotificationError(error.message || "Could not open the payment receipt.");
    }
  };

  const totalRevenue = firstValue(summary, ["totalRevenue", "todayRevenue", "revenue", "totalSales"]);
  const totalOrders = firstValue(summary, ["totalOrders", "todayOrders", "orderCount", "ordersCount"]);
  const activeCount = firstValue(summary, ["activeOrders", "activeOrderCount"], activeOrders.length);
  const pendingCount = firstValue(summary, ["pendingOrders", "pendingPaymentOrders", "pendingPayments"], null);
  const pendingFromOrders = activeOrders.filter((order) => String(order.paymentStatus || "").toUpperCase() === "PENDING").length;
  const displayedPending = pendingCount ?? pendingFromOrders;

  async function toggleNotifications() {
    if (notificationsOpen) {
      setNotificationsOpen(false);
      return;
    }
    setNotificationsOpen(true);
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const response = await apiFetch(`${API_BASE}/api/announcements/active`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || `Could not load notifications (HTTP ${response.status}).`);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (error) {
      setNotificationsError(error.message || "Could not load TexOS announcements.");
    } finally {
      setNotificationsLoading(false);
    }
  }

  return (
    <div className="texos-dashboard" data-theme={theme}>
      <aside className={`db-sidebar ${mobileNavOpen ? "db-sidebar-open" : ""}`}>
        <a className="db-brand" href="/dashboard" aria-label="TexOS dashboard">
          <span className="db-brand-mark">T</span><span>Tex<span>OS</span></span>
        </a>
        <p className="db-nav-label">WORKSPACE</p>
        <nav className="db-nav">
          {navItems.map((item) => (
            <button type="button" key={item.label} className={`db-nav-item ${active === item.label ? "active" : ""}`} onClick={() => goTo(item.path)}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <p className="db-nav-label db-nav-label-bottom">PREFERENCES</p>
        <nav className="db-nav">
          <button type="button" className={`db-nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => goTo("/dashboard/settings")}><Icon name="settings" /><span>Settings</span></button>
          <button type="button" className={`db-nav-item ${active === "Subscription" ? "active" : ""}`} onClick={() => goTo("/dashboard/subscription")}><Icon name="wallet" /><span>Subscription</span></button>
        </nav>
        <div className="db-sidebar-bottom">
          <button type="button" className="db-help-card" onClick={() => goTo("/dashboard/support")}><span className="db-help-dot" /><div><strong>Need a hand?</strong><span>Visit our help centre</span></div><Icon name="arrow" size={15} /></button>
          <button type="button" className="db-logout" onClick={() => {
            clearAuthSession();
            window.location.href = "/login";
          }}><Icon name="logout" /><span>Log out</span></button>
          <div className="db-version">TexOS workspace · v1.0</div>
        </div>
      </aside>

      {mobileNavOpen && <button className="db-mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {currentPaymentNotification && <section className="db-payment-notification" role="status" aria-live="polite">
        <button
          type="button"
          className="db-payment-notification-close"
          onClick={closePaymentNotification}
          aria-label="Close payment notification"
        >×</button>
        <span className="db-payment-notification-kicker">
          {currentPaymentNotification.type === "CALL_WAITER" ? "WAITER REQUEST" : "PAYMENT RECEIVED"}
        </span>
        <h2>{currentPaymentNotification.type === "CALL_WAITER" ? "Customer needs assistance" : "Online payment verified"}</h2>
        <p><strong>Customer:</strong> {currentPaymentNotification.customerName || "Guest"}{currentPaymentNotification.customerMobile ? ` · ${currentPaymentNotification.customerMobile}` : ""}</p>
        <p><strong>Order:</strong> {(currentPaymentNotification.orderNumbers || [currentPaymentNotification.orderNumber]).filter(Boolean).map((number) => shortOrderId(number)).join(", ") || "—"}</p>
        <p><strong>Bill:</strong> {(currentPaymentNotification.billNumbers || [currentPaymentNotification.billNumber]).filter(Boolean).join(", ") || "—"}</p>
        <p><strong>Table:</strong> {currentPaymentNotification.tableNumber || "—"}</p>
        {currentPaymentNotification.type === "CALL_WAITER" ? (
          <>
            <p><strong>Requested:</strong> {exactDateTime(currentPaymentNotification.requestedAt)}</p>
            <button type="button" className="db-payment-notification-primary" onClick={assignWaiter}>Assign</button>
          </>
        ) : (
          <>
            <p><strong>Amount received:</strong> {money(currentPaymentNotification.amount)}</p>
            <p><strong>Method:</strong> {currentPaymentNotification.paymentMethod || "—"}</p>
            <p><strong>Paid at:</strong> {exactDateTime(currentPaymentNotification.paidAt)}</p>
            <p><strong>PhonePe reference:</strong> {currentPaymentNotification.paymentReference || "—"}</p>
            <p><strong>Status:</strong> {currentPaymentNotification.paymentStatus || "VERIFIED"}</p>
            <button type="button" className="db-payment-notification-primary" onClick={openPaymentReceipt}>View receipt</button>
          </>
        )}
      </section>}
      {paymentNotificationError && <p className="db-payment-notification-error" role="alert">{paymentNotificationError}</p>}
      <main className="db-main">
        <header className="db-topbar">
          <div className="db-topbar-left">
            <button type="button" className="db-menu-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Icon name="menu" /></button>
            <div className="db-breadcrumb"><span>Workspace</span><b>/</b><strong>{active}</strong></div>
          </div>
          <div className="db-topbar-context">
            {restaurants.length > 0 && <select className="db-header-restaurant-select" aria-label="Select restaurant" value={restaurantId} onChange={(event) => setActiveRestaurantId(event.target.value)}><option value="">Select restaurant</option>{restaurants.map((r) => <option key={r.restaurantId ?? r.id} value={r.restaurantId ?? r.id}>{r.restaurantName || `Restaurant ${r.restaurantId ?? r.id}`}</option>)}</select>}
            <span className="db-open-status"><span />Live</span>
          </div>
          <div className="db-topbar-actions">
            <button type="button" className="db-icon-button db-theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => { const nextTheme = theme === "dark" ? "light" : "dark"; setTheme(nextTheme); localStorage.setItem("texos-theme", nextTheme); }}>{theme === "dark" ? "☀" : "☾"}</button>
            <div className="db-notification-wrap">
              <button type="button" className="db-icon-button db-notification" aria-label="TexOS notifications" aria-expanded={notificationsOpen} onClick={toggleNotifications}><Icon name="bell" />{announcements.length > 0 && <i />}</button>
              {announcementPopup && <aside className="db-announcement-popup" role="status" aria-live="polite">
                <button type="button" aria-label="Close announcement" onClick={closeAnnouncementPopup}>×</button>
                <span>NEW TEXOS ANNOUNCEMENT</span>
                <strong>{announcementPopup.title}</strong>
                <p>{announcementPopup.message}</p>
                {announcementPopup.endsAt && <small>Until {new Date(announcementPopup.endsAt).toLocaleString()}</small>}
              </aside>}
              {notificationsOpen && <div className="db-notification-panel" role="dialog" aria-label="TexOS notifications">
                <div className="db-notification-heading"><strong>TexOS announcements</strong><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">×</button></div>
                {notificationsLoading ? <p>Loading announcements…</p> : notificationsError ? <p className="error">{notificationsError}</p> : announcements.length === 0 ? <p>No current announcements.</p> : announcements.map((announcement) => <article key={announcement.id}><strong>{announcement.title}</strong><p>{announcement.message}</p>{announcement.endsAt && <small>Until {new Date(announcement.endsAt).toLocaleString()}</small>}</article>)}
              </div>}
            </div>
            <div className="db-profile"><div className="db-profile-avatar">{owner?.avatarImage ? <img src={owner.avatarImage} alt="" /> : (owner?.avatarIcon || ownerName.slice(0, 2).toUpperCase())}</div><div><strong>{ownerName}</strong><span>{owner?.email || "Restaurant account"}</span></div><span className="db-profile-chevron"></span></div>
          </div>
        </header>

        <div className="db-content">
          {location.pathname === "/dashboard/subscription" ? <SubscriptionPage embedded /> : location.pathname === "/dashboard/settings" ? <Settings key={owner?.ownerId} owner={owner} restaurants={restaurants} activeRestaurantId={restaurantId} onOwnerUpdated={(updated) => {
            setOwner((current) => ({ ...current, ...updated }));
            localStorage.setItem("texos-owner", JSON.stringify({ ...owner, ...updated }));
          }} onRestaurantCreated={(restaurant) => {
            setRestaurants((current) => [...current, restaurant]);
            setActiveRestaurantId(restaurant.restaurantId ?? restaurant.id);
          }} onRestaurantUpdated={(updated) => setRestaurants((current) => current.map((restaurant) => String(restaurant.restaurantId ?? restaurant.id) === String(updated.restaurantId ?? updated.id) ? updated : restaurant))} onRestaurantRemoved={(removedId) => {
            const remaining = restaurants.filter((restaurant) => String(restaurant.restaurantId ?? restaurant.id) !== String(removedId));
            setRestaurants(remaining);
            if (String(restaurantId) === String(removedId)) setActiveRestaurantId(remaining[0]?.restaurantId ?? remaining[0]?.id ?? "");
          }} /> : !restaurantId ? <section className="db-panel" style={{ padding: 28 }}><h2>No restaurant selected</h2><p>Your account does not currently have an active restaurant. Please complete restaurant setup or contact support.</p></section> : location.pathname === "/dashboard/support" ? <section className="db-panel" style={{ padding: 28, maxWidth: 620 }}><p className="db-eyebrow">TEXOS SUPPORT</p><h1>Need a hand?</h1><p>Usually reply within 2-3 hours.</p><div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}><a className="db-secondary-button" href="https://mail.google.com/mail/?view=cm&fs=1&to=texosservice%40gmail.com" target="_blank" rel="noreferrer">Email support</a><a className="db-secondary-button" href="https://wa.me/9749384032" target="_blank" rel="noreferrer">WhatsApp support</a></div></section> : location.pathname === "/dashboard/orders" ? <Orders /> : location.pathname === "/dashboard/kitchen" ? <KitchenDisplay /> : location.pathname === "/dashboard/menu" ? <MenuManagement key={restaurantId} /> : location.pathname === "/dashboard/tables" ? <TablesAndQR /> : location.pathname === "/dashboard/billing" ? <BillingManagement /> : location.pathname === "/dashboard/reports" ? <ReportsAnalytics /> : location.pathname === "/dashboard/customers" ? <Customers /> : location.pathname === "/dashboard/rewards" ? <RewardManagement restaurantId={restaurantId} /> : location.pathname === "/dashboard" ? (
            <>
              <section className="db-welcome-row">
                <div><p className="db-eyebrow">RESTAURANT OVERVIEW</p><h1>Dashboard overview <span>✦</span></h1><p className="db-welcome-subtitle">Live business data from your TexOS backend.</p></div>
                <div className="db-overview-actions">
                  <button
                    type="button"
                    className="db-secondary-button"
                    onClick={() => loadOverview()}
                    disabled={loadingOverview}
                  >
                    <Icon name="refresh" size={15} />
                    {loadingOverview ? "Refreshing…" : "Refresh"}
                  </button>
                  <button type="button" className="db-primary-button" onClick={() => goTo("/dashboard/orders")}><Icon name="bag" size={17} /> View orders</button>
                </div>
              </section>

              {overviewError && <div role="alert" style={{ padding: "12px 15px", marginBottom: 16, borderRadius: 9, background: "#fff1f0", color: "#b42318", fontSize: 12 }}>{overviewError}</div>}

              <section className="db-metrics-grid" aria-label="Business summary">
                <MetricCard title="Total revenue" value={loadingOverview ? "Loading..." : money(totalRevenue)} note="Paid orders only, as reported by backend" icon="wallet" />
                <MetricCard title="Total orders" value={loadingOverview ? "Loading..." : (totalOrders ?? "—")} note="Order count from dashboard summary" icon="bag" />
                <MetricCard title="Active orders" value={loadingOverview ? "Loading..." : activeCount} note="Orders currently in progress" icon="clock" />
                <MetricCard title="Pending payments" value={loadingOverview ? "Loading..." : displayedPending} note="Orders awaiting payment" icon="receipt" />
              </section>

              <section className="db-primary-grid">
                <article className="db-panel db-orders-panel">
                  <div className="db-panel-heading"><div><h2>Recent orders</h2><p>Latest orders received by your restaurant.</p></div><button type="button" className="db-text-button" onClick={() => goTo("/dashboard/orders")}>View all <Icon name="arrow" size={14} /></button></div>
                  {loadingOverview ? <p className="db-empty-state">Loading recent orders...</p> : recentOrders.length === 0 ? <p className="db-empty-state">No orders have been received yet.</p> : (
                    <div className="db-table-wrap"><table className="db-orders-table">
                      <thead><tr><th>ORDER</th><th>ITEMS</th><th>TABLE</th><th>AMOUNT</th><th>STATUS</th></tr></thead>
                      <tbody>{recentOrders.slice(0, 5).map((order) => {
                        const items = order.items || [];
                        const itemLabel = items.length ? items.map((item) => `${item.itemName || "Item"} × ${item.quantity || 1}${item.customization ? ` (Request: ${item.customization})` : ""}`).join(", ") : "—";
                        const status = String(order.orderStatus || order.status || "NEW").replaceAll("_", " ");
                        return <tr key={order.id || order.orderNumber}>
                          <td><strong>{shortOrderId(order.orderNumber, order.id)}</strong><span>{dateLabel(order.createdAt)}</span></td>
                          <td><span>{itemLabel}</span></td>
                          <td><span className="db-order-type">{order.tableNumber || "—"}</span></td>
                          <td className="db-amount">{money(order.bill?.totalAmount ?? order.totalAmount)}</td>
                          <td><span className={`db-status ${orderStatusTone(status)}`}><i />{status}</span></td>
                        </tr>;
                      })}</tbody>
                    </table></div>
                  )}
                </article>

                <article className="db-panel db-activity-panel">
                  <div className="db-panel-heading"><div><h2>Recent activity</h2><p>Activity based on recent order updates.</p></div><span className="db-live-pill"><i /> SYNCED</span></div>
                  <div className="db-activity-list">
                    {recentOrders.slice(0, 4).map((order) => {
                      const status = String(order.orderStatus || order.status || "NEW").toUpperCase();
                      const isPaid = String(order.paymentStatus || "").toUpperCase() === "PAID";
                      const title = isPaid ? "Payment completed" : status === "NEW" ? "New order received" : `Order ${status.toLowerCase().replaceAll("_", " ")}`;
                      return <div className="db-activity-item" key={`activity-${order.id || order.orderNumber}`}>
                        <span className="db-activity-icon cyan"><Icon name={isPaid ? "receipt" : "bag"} size={16} /></span>
                        <div><strong>{title}</strong><p>Order {shortOrderId(order.orderNumber, order.id)} · {order.tableNumber || "Table not specified"}</p><time>{dateLabel(order.updatedAt || order.createdAt)}</time></div>
                      </div>;
                    })}
                    {!loadingOverview && recentOrders.length === 0 && <p className="db-empty-state">New order activity will appear here.</p>}
                  </div>
                </article>
              </section>

              <section className="db-bottom-grid db-bottom-grid-single">
                <article className="db-panel db-quick-panel"><div className="db-panel-heading"><div><h2>Quick actions</h2><p>Go directly to a workspace module.</p></div></div>
                  <div className="db-quick-actions">
                    <button type="button" onClick={() => goTo("/dashboard/menu")}><span><Icon name="menu" /></span><b>Manage menu</b><small>Update items & prices</small></button>
                    <button type="button" onClick={() => goTo("/dashboard/tables")}><span><Icon name="qr" /></span><b>Manage tables</b><small>Tables & QR codes</small></button>
                    <button type="button" onClick={() => goTo("/dashboard/kitchen")}><span><Icon name="chef" /></span><b>Kitchen display</b><small>Track preparation</small></button>
                    <button type="button" onClick={() => goTo("/dashboard/reports")}><span><Icon name="chart" /></span><b>View reports</b><small>Sales & performance</small></button>
                  </div>
                </article>
              </section>
              <footer className="db-footer"><span>© 2026 TexOS. All rights reserved.</span><span>Built for better restaurant operations.</span></footer>
            </>
          ) : (
            <section className="db-panel" style={{ padding: 28 }}><h2>{active}</h2><p>This section is not connected yet. We will build it using the existing TexOS backend APIs.</p></section>
          )}
        </div>
      </main>
    </div>
  );
}
