import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "./restaurantApi";
import KitchenDisplay from "./KitchenDisplay";
import "./KitchenStaffPortal.css";

const SESSION_KEY = "texos-kitchen-staff-token";

async function staffRequest(path, token, options = {}) {
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
  if (!response.ok) {
    throw new Error(data?.message || `Request failed (HTTP ${response.status}).`);
  }
  return data;
}

export default function KitchenStaffPortal() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || "");
  const [restaurant, setRestaurant] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      try {
        const account = await staffRequest("/api/kitchen-staff/me", token);
        if (active) setRestaurant(account);
      } catch {
        if (active) {
          sessionStorage.removeItem(SESSION_KEY);
          setToken("");
          setRestaurant(null);
          setError("Your kitchen session has expired or been revoked. Enter a new access code.");
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function verify(event) {
    event.preventDefault();
    setVerifying(true);
    setError("");
    try {
      const session = await staffRequest("/api/kitchen-staff/verify", "", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      sessionStorage.setItem(SESSION_KEY, session.token);
      setToken(session.token);
      setRestaurant({
        restaurantId: session.restaurantId,
        restaurantName: session.restaurantName,
        expiresAt: session.expiresAt,
      });
      setCode("");
    } catch (requestError) {
      setError(requestError.message || "Unable to verify access. Please contact your restaurant owner.");
    } finally {
      setVerifying(false);
    }
  }

  async function logout() {
    try {
      await staffRequest("/api/kitchen-staff/logout", token, { method: "POST" });
    } catch (requestError) {
      setError(requestError.message || "Could not end the kitchen session.");
    } finally {
      sessionStorage.removeItem(SESSION_KEY);
      setToken("");
      setRestaurant(null);
    }
  }

  const handleAccessRevoked = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setToken("");
    setRestaurant(null);
    setError("Your kitchen access has been revoked. Enter a new access code to continue.");
  }, []);

  if (loading) {
    return <main className="kitchen-staff-access"><div className="kitchen-staff-card"><p>Checking kitchen access…</p></div></main>;
  }

  if (token && restaurant?.restaurantId) {
    return <div className="kitchen-staff-workspace">
      <div className="kitchen-staff-restaurant">{restaurant.restaurantName}</div>
      <KitchenDisplay
        staffMode
        staffToken={token}
        staffRestaurantId={String(restaurant.restaurantId)}
        onStaffLogout={logout}
        onStaffAccessRevoked={handleAccessRevoked}
      />
      {error && <div className="kitchen-staff-error" role="alert">{error}</div>}
    </div>;
  }

  return <main className="kitchen-staff-access">
    <form className="kitchen-staff-card" onSubmit={verify}>
      <span className="kitchen-staff-brand">T</span>
      <p className="kitchen-staff-eyebrow">TEXOS KITCHEN</p>
      <h1>Kitchen Staff Access</h1>
      <p>Enter the one-time access code provided by your restaurant owner.</p>
      {error && <div className="kitchen-staff-error" role="alert">{error}</div>}
      <label htmlFor="kitchen-access-code">6-digit access code</label>
      <input
        id="kitchen-access-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="Enter code"
      />
      <button type="submit" disabled={verifying || code.length !== 6}>
        {verifying ? "Verifying…" : "Verify & Access Kitchen"}
      </button>
      <small>Access codes expire after five minutes and can only be used once.</small>
    </form>
  </main>;
}
