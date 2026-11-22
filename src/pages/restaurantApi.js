import { useEffect, useState } from "react";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
export const ACTIVE_RESTAURANT_KEY = "texos-active-restaurant";
const RESTAURANT_EVENT = "texos:restaurant-changed";

export function getActiveRestaurantId() {
  return localStorage.getItem(ACTIVE_RESTAURANT_KEY) || "";
}

export function setActiveRestaurantId(id) {
  if (id === null || id === undefined || id === "") localStorage.removeItem(ACTIVE_RESTAURANT_KEY);
  else localStorage.setItem(ACTIVE_RESTAURANT_KEY, String(id));
  window.dispatchEvent(new CustomEvent(RESTAURANT_EVENT, { detail: { restaurantId: String(id || "") } }));
}

export function useActiveRestaurantId() {
  const [restaurantId, setRestaurantId] = useState(getActiveRestaurantId);
  useEffect(() => {
    const sync = () => setRestaurantId(getActiveRestaurantId());
    window.addEventListener(RESTAURANT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(RESTAURANT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return restaurantId;
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("texos-token");
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
  return fetch(url, { ...options, headers, credentials: "include" });
}

export function requireRestaurantId(id) {
  if (!id) throw new Error("No restaurant selected. Please select a restaurant first.");
  return id;
}

export function shortOrderId(orderNumber, fallbackId) {
  const value = String(orderNumber || "").trim();
  const formatted = value.match(/^TX\s*-\s*#(\d+)$/i);
  if (formatted) return `TX - #${formatted[1].padStart(7, "0")}`;
  const compact = value.match(/^TX-(\d+)$/i);
  const numericId = String(compact?.[1] ?? fallbackId ?? "").replace(/\D/g, "");
  if (!numericId) return "TX - #—";
  return `TX - #${numericId.slice(-7).padStart(7, "0")}`;
}
