import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, apiFetch } from "./restaurantApi";
import "./Settings.css";

const EMPTY_RESTAURANT = { restaurantName: "", address: "", phone: "", email: "", googleMapsUrl: "", openingHours: "" };

async function request(path, options) {
  const response = await apiFetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
  return data;
}

export default function Settings({ owner, restaurants, activeRestaurantId, onOwnerUpdated, onRestaurantCreated, onRestaurantUpdated, onRestaurantRemoved }) {
  const [profile, setProfile] = useState({
    fullName: owner?.fullName || "",
    phone: owner?.phone || "",
    avatarIcon: owner?.avatarIcon || "",
    avatarImage: owner?.avatarImage || "",
  });
  const [newRestaurant, setNewRestaurant] = useState({ ...EMPTY_RESTAURANT });
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);
  const [restaurantForm, setRestaurantForm] = useState({ ...EMPTY_RESTAURANT });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [kitchenAccessStatus, setKitchenAccessStatus] = useState(null);
  const [kitchenAccessLoading, setKitchenAccessLoading] = useState(false);
  const [kitchenAccessCode, setKitchenAccessCode] = useState(null);
  const [kitchenCodeSeconds, setKitchenCodeSeconds] = useState(0);
  const [orderApprovalSettings, setOrderApprovalSettings] = useState({ enabled: false, pageUrl: null });
  const [orderApprovalLoading, setOrderApprovalLoading] = useState(false);
  const [orderApprovalCode, setOrderApprovalCode] = useState(null);
  const [orderApprovalCodeSeconds, setOrderApprovalCodeSeconds] = useState(0);
  const [kitchenAccessExpanded, setKitchenAccessExpanded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const avatarInputRef = useRef(null);

  // Opening hours for the active restaurant – shown/edited in Owner Profile section
  const [openingHours, setOpeningHours] = useState(() => {
    const active = restaurants?.find((r) => String(r.restaurantId ?? r.id) === String(activeRestaurantId));
    return active?.openingHours || "";
  });


  const loadKitchenAccessStatus = useCallback(async () => {
    if (!activeRestaurantId) {
      setKitchenAccessStatus(null);
      return;
    }
    setKitchenAccessLoading(true);
    try {
      const status = await request(
        `/api/restaurants/${activeRestaurantId}/kitchen-access`,
        { method: "GET" },
      );
      setKitchenAccessStatus(status.status ? status : null);
    } catch (requestError) {
      setError(requestError.message || "Could not load kitchen staff access.");
    } finally {
      setKitchenAccessLoading(false);
    }
  }, [activeRestaurantId]);

  const loadOrderApprovalSettings = useCallback(async () => {
    if (!activeRestaurantId) {
      setOrderApprovalSettings({ enabled: false, pageUrl: null });
      return;
    }
    setOrderApprovalLoading(true);
    try {
      const settings = await request(`/api/restaurants/${activeRestaurantId}/order-approval`, { method: "GET" });
      setOrderApprovalSettings(settings);
    } catch (requestError) {
      setError(requestError.message || "Could not load order approval settings.");
    } finally {
      setOrderApprovalLoading(false);
    }
  }, [activeRestaurantId]);
useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) return loadKitchenAccessStatus();
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [loadKitchenAccessStatus]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) return loadOrderApprovalSettings();
      return undefined;
    });
    return () => {
      active = false;
    };
  }, [loadOrderApprovalSettings]);

  // Sync openingHours whenever the active restaurant changes
  useEffect(() => {
    const active = restaurants?.find((r) => String(r.restaurantId ?? r.id) === String(activeRestaurantId));
    setOpeningHours(active?.openingHours || "");
  }, [activeRestaurantId, restaurants]);

  useEffect(() => {
    if (kitchenAccessStatus?.status !== "ACTIVE") return undefined;
    const timer = window.setInterval(() => {
      loadKitchenAccessStatus();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [kitchenAccessStatus?.status, loadKitchenAccessStatus]);

  useEffect(() => {
    if (!kitchenAccessCode) return undefined;
    const updateRemaining = () => {
      setKitchenCodeSeconds(Math.max(
        0,
        Math.ceil((new Date(kitchenAccessCode.expiresAt).getTime() - Date.now()) / 1000),
      ));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [kitchenAccessCode]);

  useEffect(() => {
    if (!orderApprovalCode) return undefined;
    const updateRemaining = () => {
      setOrderApprovalCodeSeconds(Math.max(
        0,
        Math.ceil((new Date(orderApprovalCode.expiresAt).getTime() - Date.now()) / 1000),
      ));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [orderApprovalCode]);

  async function generateKitchenAccessCode() {
    if (!activeRestaurantId) return;
    setKitchenAccessLoading(true);
    setError("");
    setNotice("");
    try {
      const generated = await request(
        `/api/restaurants/${activeRestaurantId}/kitchen-access`,
        { method: "POST" },
      );
      setKitchenAccessCode({ ...generated, restaurantId: String(activeRestaurantId) });
      setKitchenCodeSeconds(300);
      await loadKitchenAccessStatus();
      setNotice("Kitchen staff access code generated. It can only be used once.");
    } catch (requestError) {
      setError(requestError.message || "Could not generate kitchen access code.");
    } finally {
      setKitchenAccessLoading(false);
    }
  }

  async function revokeKitchenAccess() {
    if (!activeRestaurantId) return;
    setKitchenAccessLoading(true);
    setError("");
    setNotice("");
    try {
      const status = await request(
        `/api/restaurants/${activeRestaurantId}/kitchen-access/revoke`,
        { method: "POST" },
      );
      setKitchenAccessStatus(status.status ? status : null);
      setKitchenAccessCode(null);
      setNotice("Kitchen access code or active staff session has been revoked.");
    } catch (requestError) {
      setError(requestError.message || "Could not revoke kitchen staff access.");
    } finally {
      setKitchenAccessLoading(false);
    }
  }

  async function copyKitchenAccessCode() {
    try {
      await navigator.clipboard.writeText(kitchenAccessCode.code);
      setNotice("Access code copied.");
    } catch {
      setError("Could not copy automatically. Select and copy the code manually.");
    }
  }

  async function setOrderApprovalEnabled(enabled) {
    if (!activeRestaurantId) return;
    setOrderApprovalLoading(true);
    setError("");
    setNotice("");
    try {
      const settings = await request(`/api/restaurants/${activeRestaurantId}/order-approval`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      setOrderApprovalSettings(settings);
      if (!enabled) setOrderApprovalCode(null);
      setNotice(enabled
        ? "Staff order approval is enabled. Generate a one-time code to grant access."
        : "Staff order approval is disabled. Pending orders were released to the normal order flow.");
    } catch (requestError) {
      setError(requestError.message || "Could not update order approval settings.");
    } finally {
      setOrderApprovalLoading(false);
    }
  }

  async function generateOrderApprovalCode() {
    if (!activeRestaurantId) return;
    setOrderApprovalLoading(true);
    setError("");
    setNotice("");
    try {
      const generated = await request(
        `/api/restaurants/${activeRestaurantId}/order-approval/access-code`,
        { method: "POST" },
      );
      setOrderApprovalCode({ ...generated, restaurantId: String(activeRestaurantId) });
      setOrderApprovalCodeSeconds(300);
      setNotice("One-time order approval code generated. Share it separately from the page link.");
    } catch (requestError) {
      setError(requestError.message || "Could not generate the order approval code.");
    } finally {
      setOrderApprovalLoading(false);
    }
  }

  async function revokeOrderApprovalLink() {
    if (!activeRestaurantId) return;
    setOrderApprovalLoading(true);
    setError("");
    setNotice("");
    try {
      const settings = await request(`/api/restaurants/${activeRestaurantId}/order-approval/link`, { method: "DELETE" });
      setOrderApprovalSettings(settings);
      setOrderApprovalCode(null);
      setNotice("All order approval codes and active staff sessions have been revoked.");
    } catch (requestError) {
      setError(requestError.message || "Could not revoke order approval staff access.");
    } finally {
      setOrderApprovalLoading(false);
    }
  }

  async function copyLink(url, label) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`${label} copied.`);
    } catch {
      setError(`Could not copy automatically. Select and copy the ${label.toLowerCase()} manually.`);
    }
  }

  async function persistProfileImage(avatarImage) {
    const previousImage = profile.avatarImage;
    const nextProfile = { ...profile, avatarImage, avatarIcon: "" };
    setProfile(nextProfile);
    onOwnerUpdated?.({ avatarImage, avatarIcon: "" });
    setSavingProfile(true);
    setError("");
    try {
      const updated = await request("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(nextProfile),
      });
      if (updated.token) localStorage.setItem("texos-token", updated.token);
      setProfile({ fullName: updated.fullName, phone: updated.phone || "", avatarIcon: updated.avatarIcon || "", avatarImage: updated.avatarImage || "" });
      onOwnerUpdated?.(updated);
      setNotice(avatarImage ? "Profile image updated." : "Profile image removed.");
    } catch (requestError) {
      setProfile((current) => ({ ...current, avatarImage: previousImage }));
      onOwnerUpdated?.({ avatarImage: previousImage });
      setError(requestError.message || "Could not save your profile image.");
    } finally {
      setSavingProfile(false);
    }
  }

  function updateProfileImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/)) {
      setError("Please choose a PNG, JPEG, WebP, or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Profile image must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      await persistProfileImage(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      const updated = await request("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      if (updated.token) localStorage.setItem("texos-token", updated.token);
      setProfile({ fullName: updated.fullName, phone: updated.phone || "", avatarIcon: updated.avatarIcon || "", avatarImage: updated.avatarImage || "" });
      onOwnerUpdated?.(updated);

      // Also persist openingHours to the active restaurant if one is selected
      if (activeRestaurantId && openingHours !== undefined) {
        const activeRestaurant = restaurants?.find(
          (r) => String(r.restaurantId ?? r.id) === String(activeRestaurantId)
        );
        if (activeRestaurant) {
          const updatedRestaurant = await request(`/api/restaurants/${activeRestaurantId}`, {
            method: "PUT",
            body: JSON.stringify({
              restaurantName: activeRestaurant.restaurantName || "",
              address: activeRestaurant.address || "",
              phone: activeRestaurant.phone || "",
              email: activeRestaurant.email || "",
              googleMapsUrl: activeRestaurant.googleMapsUrl || "",
              openingHours: openingHours.trim(),
            }),
          });
          onRestaurantUpdated?.(updatedRestaurant);
        }
      }

      setNotice("Profile updated.");
    } catch (requestError) {
      setError(requestError.message || "Could not update your profile.");
    } finally {
      setSavingProfile(false);
    }
  }


  async function addRestaurant(event) {
    event.preventDefault();
    setSavingRestaurant(true);
    setError("");
    setNotice("");
    try {
      const created = await request(`/api/restaurants/owner/${owner?.ownerId}`, {
        method: "POST",
        body: JSON.stringify(newRestaurant),
      });
      setNewRestaurant({ ...EMPTY_RESTAURANT });
      onRestaurantCreated?.(created);
      setNotice("Restaurant added to your workspace.");
    } catch (requestError) {
      setError(requestError.message || "Could not add restaurant.");
    } finally {
      setSavingRestaurant(false);
    }
  }

  async function saveRestaurant(event) {
    event.preventDefault();
    setSavingRestaurant(true);
    setError("");
    setNotice("");
    try {
      const updated = await request(`/api/restaurants/${editingRestaurantId}`, {
        method: "PUT",
        body: JSON.stringify(restaurantForm),
      });
      onRestaurantUpdated?.(updated);
      setEditingRestaurantId(null);
      setNotice("Restaurant details updated.");
    } catch (requestError) {
      setError(requestError.message || "Could not update restaurant details.");
    } finally {
      setSavingRestaurant(false);
    }
  }

  async function removeRestaurant(restaurant) {
    const id = restaurant.restaurantId ?? restaurant.id;
    if (!window.confirm(`Remove ${restaurant.restaurantName || "this restaurant"} from your workspace? Its existing data will be retained.`)) return;
    setSavingRestaurant(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/restaurants/${id}`, { method: "DELETE" });
      onRestaurantRemoved?.(id);
      setNotice("Restaurant removed from your workspace.");
    } catch (requestError) {
      setError(requestError.message || "Could not remove the restaurant.");
    } finally {
      setSavingRestaurant(false);
    }
  }

  return (
    <section className="db-settings-page">
      <p className="db-eyebrow">PROFILE & RESTAURANTS</p>
      <h1>Settings</h1>
      <p>Manage your owner profile and restaurant workspaces.</p>

      {error && <div role="alert" className="db-settings-alert error">{error}</div>}
      {notice && <div role="status" className="db-settings-alert success">{notice}</div>}

      <section className="db-panel db-settings-card">
        <h2>Owner profile</h2>
        <form onSubmit={saveProfile} className="db-settings-form">
          <label>Full name<input required maxLength="100" value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} /></label>
          <label>Email<input value={owner?.email || ""} readOnly /></label>
          <label>Phone<input required maxLength="20" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
          {/* Restaurant opening & closing time – saved to the active restaurant when profile is saved */}
          {activeRestaurantId && (
            <label>
              Restaurant Opening Hours
              <input
                type="text"
                maxLength="100"
                placeholder="e.g. Open 11am–10pm"
                value={openingHours}
                onChange={(event) => setOpeningHours(event.target.value)}
              />
              <small style={{ display: "block", marginTop: 4, color: "#888", fontSize: 11 }}>
                Shown on the customer menu page. Example: <em>Open 9am–11pm</em> or <em>Mon–Sun 10am–10pm</em>
              </small>
            </label>
          )}
          <div className="db-avatar-field">
            <span>Profile image (optional)</span>
            <div className="db-avatar-upload-row">
              <div className="db-avatar-preview" aria-label="Profile image preview">{profile.avatarImage ? <img src={profile.avatarImage} alt="Profile preview" /> : <span>{profile.fullName.trim().slice(0, 2).toUpperCase() || "RO"}</span>}</div>
              <div>
                <input ref={avatarInputRef} className="db-avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={updateProfileImage} />
                <button type="button" className="db-secondary-button db-avatar-upload-button" disabled={savingProfile} onClick={() => avatarInputRef.current?.click()}>{savingProfile ? "Saving…" : "Upload image"}</button>
                {profile.avatarImage && <button type="button" className="db-avatar-remove-button" disabled={savingProfile} onClick={() => { persistProfileImage(""); if (avatarInputRef.current) avatarInputRef.current.value = ""; }}>Remove image</button>}
                <small>PNG, JPEG, WebP, or GIF · up to 2 MB</small>
              </div>
            </div>
          </div>
          <button type="submit" className="db-primary-button" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</button>
        </form>
      </section>

      <section className="db-panel db-settings-card">
        <h2>Access for "Order Approval by Staff"</h2>
        <p>Require authorised staff to approve customer orders before they appear on the owner and kitchen order boards.</p>
        {!activeRestaurantId ? <p>Select a restaurant to manage order approval.</p> : <>
          <label className="db-reward-toggle db-approval-toggle">
            <span>Order Approval by Staff</span>
            <input type="checkbox" checked={orderApprovalSettings.enabled} disabled={orderApprovalLoading}
              onChange={(event) => setOrderApprovalEnabled(event.target.checked)} />
          </label>
          {orderApprovalSettings.enabled && <div className="db-kitchen-access-summary">
            <strong>Order Approval Page Link</strong>
            {orderApprovalSettings.pageUrl
              ? <div className="db-access-link-row"><input readOnly aria-label="Order approval page URL" value={orderApprovalSettings.pageUrl} /><button type="button" className="db-secondary-button" onClick={() => copyLink(orderApprovalSettings.pageUrl, "Order approval link")}>Copy Link</button></div>
              : <p>Approval link is unavailable.</p>}
            <div className="db-settings-actions">
              <button type="button" className="db-primary-button" disabled={orderApprovalLoading || !orderApprovalSettings.pageUrl} onClick={generateOrderApprovalCode}>
                {orderApprovalLoading ? "Please wait…" : "Generate Code"}
              </button>
              <button type="button" className="db-remove-button" disabled={orderApprovalLoading} onClick={revokeOrderApprovalLink}>Revoke all staff access</button>
            </div>
            <small>Send the page link and generated code separately. Each six-digit code expires after five minutes and works once. Turning approval off releases pending orders to the normal owner workflow.</small>
          </div>}
        </>}
      </section>

      <section className="db-panel db-settings-card">
        <h2>Access for "Kitchen Staff"</h2>
        <p>Give staff access to this restaurant’s kitchen order board without sharing your owner account.</p>
        {!activeRestaurantId ? <p>Select a restaurant to manage kitchen access.</p> : <>
          <label className="db-reward-toggle db-approval-toggle">
            <span>Enable Kitchen Staff Access</span>
            <input type="checkbox" checked={kitchenAccessExpanded} onChange={(event) => setKitchenAccessExpanded(event.target.checked)} />
          </label>
          {kitchenAccessExpanded && <>
            <div className="db-kitchen-access-summary">
              <span>Current access: <strong>{kitchenAccessStatus?.status || "Not generated"}</strong></span>
              {kitchenAccessStatus?.sessionActive && <span>Kitchen staff session is active</span>}
              {kitchenAccessStatus?.expiresAt && kitchenAccessStatus.status === "ACTIVE" && (
                <span>Code expires {new Date(kitchenAccessStatus.expiresAt).toLocaleString()}</span>
              )}
              <strong>Kitchen Staff Page Link</strong>
              <div className="db-access-link-row"><input readOnly aria-label="Kitchen staff page URL" value={`${window.location.origin}/kitchen-staff`} /><button type="button" className="db-secondary-button" onClick={() => copyLink(`${window.location.origin}/kitchen-staff`, "Kitchen staff page link")}>Copy Link</button></div>
              <a href="/kitchen-staff" target="_blank" rel="noreferrer">Open Kitchen Staff Portal ↗</a>
            </div>
            <div className="db-settings-actions">
              <button type="button" className="db-primary-button" disabled={kitchenAccessLoading || (
                kitchenAccessStatus?.status === "ACTIVE"
                || (kitchenAccessStatus?.status === "USED" && kitchenAccessStatus.sessionActive)
              )} onClick={generateKitchenAccessCode}>
                {kitchenAccessLoading ? "Please wait…" : "Generate Code"}
              </button>
              {(kitchenAccessStatus?.status === "ACTIVE" || kitchenAccessStatus?.sessionActive) && (
                <button type="button" className="db-remove-button" disabled={kitchenAccessLoading} onClick={revokeKitchenAccess}>
                  Revoke access
                </button>
              )}
            </div>
          </>}
        </>}
      </section>

      <section className="db-panel db-settings-card">
        <h2>Your restaurants</h2>
        {restaurants.length === 0 && <p>No restaurants have been added yet.</p>}
        <div className="db-settings-restaurants">
          {restaurants.map((restaurant) => {
            const id = restaurant.restaurantId ?? restaurant.id;
            const isEditing = String(editingRestaurantId) === String(id);
            return <article className="db-settings-restaurant" key={id}>
              {isEditing ? <form onSubmit={saveRestaurant} className="db-settings-form">
                <label>Restaurant name<input required maxLength="150" value={restaurantForm.restaurantName} onChange={(event) => setRestaurantForm({ ...restaurantForm, restaurantName: event.target.value })} /></label>
                <label>Address<input maxLength="255" value={restaurantForm.address} onChange={(event) => setRestaurantForm({ ...restaurantForm, address: event.target.value })} /></label>
                <label>Phone<input maxLength="20" value={restaurantForm.phone} onChange={(event) => setRestaurantForm({ ...restaurantForm, phone: event.target.value })} /></label>
                <label>Email<input type="email" maxLength="100" value={restaurantForm.email} onChange={(event) => setRestaurantForm({ ...restaurantForm, email: event.target.value })} /></label>
                <label>Google Maps review link<input type="url" maxLength={2048} placeholder="https://maps.google.com/…" value={restaurantForm.googleMapsUrl} onChange={(event) => setRestaurantForm({ ...restaurantForm, googleMapsUrl: event.target.value })} /></label>
                <label>Opening Hours<input maxLength="100" placeholder="e.g. Open 11am–10pm" value={restaurantForm.openingHours || ""} onChange={(event) => setRestaurantForm({ ...restaurantForm, openingHours: event.target.value })} /></label>
                <div className="db-settings-actions">
                  <button type="button" className="db-secondary-button" onClick={() => setEditingRestaurantId(null)}>Cancel</button>
                  <button type="submit" className="db-primary-button" disabled={savingRestaurant}>{savingRestaurant ? "Saving…" : "Save restaurant"}</button>
                </div>
              </form> : <>
                <div><strong>{restaurant.restaurantName || `Restaurant ${id}`}</strong><span>{restaurant.address || "No address added"}</span></div>
                <div className="db-settings-restaurant-actions">
                  <button type="button" className="db-remove-button" disabled={savingRestaurant} onClick={() => removeRestaurant(restaurant)}>Remove</button>
                  <button type="button" className="db-secondary-button" disabled={savingRestaurant} onClick={() => {
                    setEditingRestaurantId(id);
                    setRestaurantForm({
                      restaurantName: restaurant.restaurantName || "",
                      address: restaurant.address || "",
                      phone: restaurant.phone || "",
                      email: restaurant.email || "",
                      googleMapsUrl: restaurant.googleMapsUrl || "",
                      openingHours: restaurant.openingHours || "",
                    });
                  }}>Edit details</button>
                </div>
              </>}
            </article>;
          })}
        </div>
      </section>

      <section className="db-panel db-settings-card">
        <h2>Add restaurant</h2>
        <form onSubmit={addRestaurant} className="db-settings-form">
          <label>Restaurant name<input required maxLength="150" value={newRestaurant.restaurantName} onChange={(event) => setNewRestaurant({ ...newRestaurant, restaurantName: event.target.value })} /></label>
          <label>Address<input maxLength="255" value={newRestaurant.address} onChange={(event) => setNewRestaurant({ ...newRestaurant, address: event.target.value })} /></label>
          <label>Phone<input maxLength="20" value={newRestaurant.phone} onChange={(event) => setNewRestaurant({ ...newRestaurant, phone: event.target.value })} /></label>
          <label>Email<input type="email" maxLength="100" value={newRestaurant.email} onChange={(event) => setNewRestaurant({ ...newRestaurant, email: event.target.value })} /></label>
          <label>Google Maps review link<input type="url" maxLength={2048} placeholder="https://maps.google.com/…" value={newRestaurant.googleMapsUrl} onChange={(event) => setNewRestaurant({ ...newRestaurant, googleMapsUrl: event.target.value })} /></label>
          <label>Opening Hours<input maxLength="100" placeholder="e.g. Open 11am–10pm" value={newRestaurant.openingHours || ""} onChange={(event) => setNewRestaurant({ ...newRestaurant, openingHours: event.target.value })} /></label>
          <button type="submit" className="db-primary-button" disabled={savingRestaurant}>{savingRestaurant ? "Saving…" : "Add restaurant"}</button>
        </form>
      </section>

      {kitchenAccessCode && kitchenAccessCode.restaurantId === String(activeRestaurantId) && <div className="db-kitchen-code-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setKitchenAccessCode(null);
      }}>
        <section className="db-kitchen-code-modal" role="dialog" aria-modal="true" aria-labelledby="kitchen-code-title">
          <button type="button" className="db-kitchen-code-close" aria-label="Close" onClick={() => setKitchenAccessCode(null)}>×</button>
          <span className="db-kitchen-code-icon">K</span>
          <h2 id="kitchen-code-title">Grant Kitchen Access</h2>
          <p>Share this temporary code with one kitchen staff member. It expires in five minutes and cannot be reused.</p>
          <output className="db-kitchen-code-value">{kitchenAccessCode.code}</output>
          <strong className="db-kitchen-code-timer">
            {kitchenCodeSeconds > 0
              ? `Valid for ${String(Math.floor(kitchenCodeSeconds / 60)).padStart(2, "0")}:${String(kitchenCodeSeconds % 60).padStart(2, "0")}`
              : "Code expired"}
          </strong>
          <button type="button" className="db-primary-button" disabled={kitchenCodeSeconds === 0} onClick={copyKitchenAccessCode}>Copy Code</button>
          <small>For security, this code will not be shown again after you close this window.</small>
        </section>
      </div>}
      {orderApprovalCode && orderApprovalCode.restaurantId === String(activeRestaurantId) && <div className="db-kitchen-code-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOrderApprovalCode(null);
      }}>
        <section className="db-kitchen-code-modal" role="dialog" aria-modal="true" aria-labelledby="order-approval-code-title">
          <button type="button" className="db-kitchen-code-close" aria-label="Close" onClick={() => setOrderApprovalCode(null)}>×</button>
          <span className="db-kitchen-code-icon">A</span>
          <h2 id="order-approval-code-title">Grant Order Approval Access</h2>
          <p>Share this code separately from the approval page link. It expires in five minutes and can only be used once.</p>
          <output className="db-kitchen-code-value">{orderApprovalCode.code}</output>
          <strong className="db-kitchen-code-timer">
            {orderApprovalCodeSeconds > 0
              ? `Valid for ${String(Math.floor(orderApprovalCodeSeconds / 60)).padStart(2, "0")}:${String(orderApprovalCodeSeconds % 60).padStart(2, "0")}`
              : "Code expired"}
          </strong>
          <button type="button" className="db-primary-button" disabled={orderApprovalCodeSeconds === 0} onClick={async () => {
            try {
              await navigator.clipboard.writeText(orderApprovalCode.code);
              setNotice("Order approval code copied.");
            } catch {
              setError("Could not copy automatically. Select and copy the code manually.");
            }
          }}>Copy Code</button>
          <small>For security, this code will not be shown again after you close this window.</small>
        </section>
      </div>}
    </section>
  );
}
