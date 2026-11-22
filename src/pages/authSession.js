import { API_BASE } from "./restaurantApi";

export function saveAuthSession(data) {
  localStorage.setItem("texos-token", data.token);
  localStorage.setItem("texos-owner", JSON.stringify({
    ownerId: data.ownerId,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    avatarImage: data.avatarImage,
  }));
  const restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];
  localStorage.setItem("texos-restaurants", JSON.stringify(restaurants));
  localStorage.removeItem("texos-active-restaurant");
  if (restaurants.length) {
    localStorage.setItem("texos-active-restaurant", String(restaurants[0].restaurantId));
  }
}

export async function routeAfterAuth(data, navigate, planId = "") {
  saveAuthSession(data);
  const restaurantId = data.restaurants?.[0]?.restaurantId;
  if (data.onboardingRequired || !restaurantId) {
    navigate(`/onboarding?planId=${encodeURIComponent(planId)}`, { replace: true });
    return;
  }
  try {
    const response = await fetch(
      `${API_BASE}/api/subscriptions/status?restaurantId=${encodeURIComponent(restaurantId)}`,
      { headers: { Authorization: `Bearer ${data.token}`, Accept: "application/json" } },
    );
    if (!response.ok) throw new Error("Subscription status could not be verified.");
    const subscription = await response.json();
    if (subscription.entitled) {
      localStorage.removeItem("texos-pending-plan-id");
      navigate("/dashboard", { replace: true });
      return;
    }
    if (subscription.status === "EXPIRED") {
      navigate("/?subscription=expired#pricing", { replace: true });
      return;
    }
    const extra = planId ? `&planId=${encodeURIComponent(planId)}` : "";
    navigate(`/plans?restaurantId=${encodeURIComponent(restaurantId)}${extra}${subscription.status === "PENDING" ? "&pending=1" : ""}`, { replace: true });
  } catch {
    navigate(`/plans?restaurantId=${encodeURIComponent(restaurantId)}${planId ? `&planId=${encodeURIComponent(planId)}` : ""}`, { replace: true });
  }
}

export function clearAuthSession() {
  for (const key of [
    "texos-token",
    "texos-owner",
    "texos-restaurants",
    "texos-active-restaurant",
    "texos-pending-plan-id",
  ]) {
    localStorage.removeItem(key);
  }
}

export function rememberPlanId(planId) {
  if (planId) localStorage.setItem("texos-pending-plan-id", String(planId));
  else localStorage.removeItem("texos-pending-plan-id");
}

export function getRememberedPlanId() {
  return localStorage.getItem("texos-pending-plan-id") || "";
}
