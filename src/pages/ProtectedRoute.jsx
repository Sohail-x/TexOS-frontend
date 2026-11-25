import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { API_BASE } from "./restaurantApi";
import {
  clearAuthSession,
  consumeLoginSubscriptionStatus,
} from "./authSession";

export default function ProtectedRoute({ children, onboarding = false }) {
  const location = useLocation();
  const [result, setResult] = useState({ state: "checking" });
  const [restaurantSelectionVersion, setRestaurantSelectionVersion] = useState(0);
  const accountContextRef = useRef(null);
  const accountTokenRef = useRef(null);
  const accountSelectionVersionRef = useRef(null);

  useEffect(() => {
    const refresh = () => setRestaurantSelectionVersion((version) => version + 1);
    window.addEventListener("texos:restaurant-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("texos:restaurant-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function validate() {
      const token = localStorage.getItem("texos-token");
      if (!token) {
        setResult({ state: "unauthenticated" });
        return;
      }
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
        let account = accountContextRef.current;
        const accountMustRefresh = !account
          || accountTokenRef.current !== token
          || accountSelectionVersionRef.current !== restaurantSelectionVersion;
        if (accountMustRefresh) {
          const accountResponse = await fetch(`${API_BASE}/api/auth/me`, {
            headers,
            signal: controller.signal,
          });
          if (cancelled) return;
          if (!accountResponse.ok) {
            if (accountResponse.status === 401) clearAuthSession();
            setResult({ state: accountResponse.status === 401 ? "unauthenticated" : "error" });
            return;
          }
          account = await accountResponse.json();
          if (cancelled) return;
          accountContextRef.current = account;
          accountTokenRef.current = token;
          accountSelectionVersionRef.current = restaurantSelectionVersion;
        }
        const restaurants = account.restaurants || [];
        if (onboarding) {
          if (!restaurants.length) {
            setResult({ state: "allowed" });
          } else {
            setResult({ state: "subscribe" });
          }
          return;
        }
        if (!restaurants.length) {
          setResult({ state: "onboarding" });
          return;
        }
        const selected = localStorage.getItem("texos-active-restaurant");
        const restaurant = restaurants.find((item) =>
          String(item.restaurantId) === String(selected)) || restaurants[0];
        localStorage.setItem("texos-active-restaurant", String(restaurant.restaurantId));
        localStorage.setItem("texos-restaurants", JSON.stringify(restaurants));
        let status = consumeLoginSubscriptionStatus(token, restaurant.restaurantId);
        if (!status) {
          const statusResponse = await fetch(
            `${API_BASE}/api/subscriptions/status?restaurantId=${encodeURIComponent(restaurant.restaurantId)}`,
            { headers, signal: controller.signal },
          );
          if (cancelled) return;
          if (!statusResponse.ok) {
            if (statusResponse.status === 401) clearAuthSession();
            setResult({ state: statusResponse.status === 401 ? "unauthenticated" : "error" });
            return;
          }
          status = await statusResponse.json();
          if (cancelled) return;
        }
        setResult({
          state: status.entitled ? "allowed" : status.status === "EXPIRED" ? "expired" : "subscribe",
          account,
          status,
        });
      } catch {
        if (!cancelled && !controller.signal.aborted) setResult({ state: "error" });
      }
    }
    Promise.resolve().then(() => {
      if (!cancelled) validate();
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [location.pathname, onboarding, restaurantSelectionVersion]);

  if (result.state === "checking") return <main className="auth-container"><p>Checking your TexOS account…</p></main>;
  if (result.state === "unauthenticated") {
    const planId = localStorage.getItem("texos-pending-plan-id");
    const query = planId ? `?planId=${encodeURIComponent(planId)}` : "";
    return <Navigate to={`/login${query}`} replace state={{ from: location }} />;
  }
  if (result.state === "onboarding") return <Navigate to="/onboarding" replace />;
  if (result.state === "expired") {
    return <Navigate to="/?subscription=expired#pricing" replace />;
  }
  if (result.state === "subscribe") {
    const restaurantId = localStorage.getItem("texos-active-restaurant");
    return <Navigate to={`/plans?restaurantId=${encodeURIComponent(restaurantId || "")}`} replace />;
  }
  if (result.state === "error") return <main className="auth-container"><p role="alert">Could not verify your account with TexOS. Check your connection and try again.</p></main>;
  if (!onboarding && isValidElement(children)) {
    return cloneElement(children, { authenticatedAccount: result.account });
  }
  return children;
}
