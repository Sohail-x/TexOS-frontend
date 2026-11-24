import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch, requireRestaurantId, useActiveRestaurantId } from "./restaurantApi";
import "./TablesAndQR.css";

const CUSTOMER_BASE = (import.meta.env.VITE_CUSTOMER_BASE_URL || window.location.origin).replace(/\/$/, "");

async function api(path, options = {}) {
  const response = await apiFetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Request failed (HTTP ${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

function listFrom(data) {
  if (Array.isArray(data)) return data;
  return data?.content || data?.tables || data?.data || [];
}

function normalizeTable(table) {
  return { ...table, id: table.id ?? table.tableId };
}

function qrImageSource(table) {
  const value = table?.qrImageBase64 || table?.qrImage || table?.qrCodeImage || table?.qrImageData;
  if (!value) return "";
  if (typeof value === "string") return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
  if (Array.isArray(value)) {
    let binary = "";
    value.forEach((byte) => { binary += String.fromCharCode(byte); });
    return `data:image/png;base64,${btoa(binary)}`;
  }
  return "";
}

function TableCard({ table, onSelect, onDelete, deleting }) {
  const image = qrImageSource(table);
  const active = table.active !== false;
  return (
    <article className={`tqr-card ${active ? "" : "tqr-card-inactive"}`}>
      <div className="tqr-card-top">
        <div><span className="tqr-table-label">RESTAURANT TABLE</span><h3>{table.tableNumber || `Table ${table.id}`}</h3></div>
        <span className={`tqr-status ${active ? "active" : "inactive"}`}>{active ? "Active" : "Inactive"}</span>
      </div>
      <div className="tqr-qr-area">
        {image ? <img src={image} alt={`QR code for ${table.tableNumber || "table"}`} /> : <div className="tqr-no-qr"><span>▦</span><strong>QR image unavailable</strong><small>Backend response did not include the QR image.</small></div>}
      </div>
      <div className="tqr-token"><span>QR TOKEN</span><code>{table.qrToken || "Not returned by API"}</code></div>
      <div className="tqr-card-actions">
        <button type="button" className="tqr-btn tqr-btn-light" onClick={() => onSelect(table)}>View details</button>
        <button type="button" className="tqr-btn tqr-btn-danger" onClick={() => onDelete(table)} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
      </div>
    </article>
  );
}

export default function TablesAndQR() { 
  const restaurantId = useActiveRestaurantId();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [deletingTableId, setDeletingTableId] = useState(null);

  const loadTables = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/tables`);
      setTables(listFrom(data).map(normalizeTable));
    } catch (err) { setError(err.message || "Could not load tables."); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (restaurantId) {
        loadTables();
      } else {
        setTables([]);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [loadTables, restaurantId]);

  const activeCount = useMemo(() => tables.filter((table) => table.active !== false).length, [tables]);

  async function createTable(event) {
    event.preventDefault();
    const value = tableNumber.trim();
    if (!value) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/tables`, {
        method: "POST",
        body: JSON.stringify({ tableNumber: value }),
      });
      setTableNumber("");
      setNotice(`Table ${value} created. Its QR token is permanent.`);
      await loadTables();
    } catch (err) { setError(err.message || "Could not create table."); }
    finally { setSaving(false); }
  }

  async function toggleTable(table) {
    setError(""); setNotice("");
    try {
      await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/tables/${table.id}/status?active=${table.active === false}`, { method: "PATCH" });
      setNotice(`${table.tableNumber || "Table"} ${table.active === false ? "activated" : "deactivated"}.`);
      await loadTables();
      setSelectedTable(null);
    } catch (err) { setError(err.message || "Could not update table status."); }
  }

  async function deleteTable(table) {
    const tableName = table.tableNumber || `Table ${table.id}`;
    if (!window.confirm(`Permanently delete ${tableName} and its QR code? Existing order, payment, or service history will prevent deletion.`)) return;

    setDeletingTableId(table.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/tables/${table.id}`, { method: "DELETE" });
      setSelectedTable((current) => current?.id === table.id ? null : current);
      setNotice(`${tableName} and its QR code were deleted.`);
      await loadTables();
    } catch (err) {
      setError(err.message || "Could not delete table.");
    } finally {
      setDeletingTableId(null);
    }
  }

  async function copyCustomerLink(table) {
    const link = `${CUSTOMER_BASE}/menu/${table.qrToken}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(link);
      setNotice("Customer menu link copied.");
    } catch {
      setError("Could not copy the link. Copy it from the details panel.");
    }
  }

  function printTable(table) {
    const image = qrImageSource(table);
    if (!image) { setError("QR image is not available in the table API response, so it cannot be printed yet."); return; }
    const popup = window.open("", "_blank", "width=500,height=650");
    if (!popup) { setError("Allow pop-ups to print the QR code."); return; }
    popup.document.write("<!doctype html><html><head><title>Table QR</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:35px}img{width:260px;height:260px;object-fit:contain}h1{font-size:26px}p{color:#555;word-break:break-all}</style></head><body></body></html>");
    const heading = popup.document.createElement("h1");
    heading.textContent = table.tableNumber || "Restaurant Table";
    const qr = popup.document.createElement("img");
    qr.src = image;
    qr.alt = `QR code for ${table.tableNumber || "table"}`;
    const link = popup.document.createElement("p");
    link.textContent = `${CUSTOMER_BASE}/menu/${table.qrToken || ""}`;
    popup.document.body.append(heading, qr, link);
    popup.onload = () => popup.print();
    popup.document.close();
  }

  return (
    <div className="tqr-page">
      <div className="tqr-heading">
        <div><p className="tqr-eyebrow">RESTAURANT SETUP</p><h1>Tables & QR Codes</h1><p>Create permanent QR codes for each restaurant table.</p></div>
        <button type="button" className="tqr-btn tqr-btn-light" onClick={loadTables}>↻ Refresh</button>
      </div>

      <section className="tqr-stats">
        <div><span>Total tables</span><strong>{loading ? "—" : tables.length}</strong></div>
        <div><span>Active tables</span><strong>{loading ? "—" : activeCount}</strong></div>
        <div><span>Inactive tables</span><strong>{loading ? "—" : tables.length - activeCount}</strong></div>
      </section>

      {error && <div className="tqr-alert error" role="alert">{error}</div>}
      {notice && <div className="tqr-alert success" role="status">{notice}</div>}

      <form className="tqr-create-form" onSubmit={createTable}>
        <div><span className="tqr-form-eyebrow">ADD A NEW TABLE</span><h2>Create table & QR</h2><p>Each table gets a permanent QR token linked to its customer menu.</p></div>
        <label><span>Table name / number</span><input value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} placeholder="e.g. T1 or Table 01" required maxLength={40} /></label>
        <button className="tqr-btn tqr-btn-primary" disabled={saving}>{saving ? "Creating..." : "+ Create table"}</button>
      </form>

      <div className="tqr-list-heading"><div><h2>Your tables</h2><p>QR tokens stay the same when a table is deactivated or reactivated. Tables with existing activity cannot be deleted.</p></div><span>{tables.length} TABLES</span></div>
      {loading ? <div className="tqr-empty">Loading restaurant tables...</div> : tables.length === 0 ? <div className="tqr-empty"><strong>No tables created yet</strong><span>Create your first table to generate its permanent QR token.</span></div> : <div className="tqr-grid">{tables.map((table) => <TableCard key={table.id} table={table} onSelect={setSelectedTable} onDelete={deleteTable} deleting={deletingTableId === table.id} />)}</div>}

      {selectedTable && <div className="tqr-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTable(null); }}>
        <section className="tqr-modal" role="dialog" aria-modal="true" aria-label="Table details">
          <div className="tqr-modal-head"><div><span>TABLE DETAILS</span><h2>{selectedTable.tableNumber || `Table ${selectedTable.id}`}</h2></div><button type="button" onClick={() => setSelectedTable(null)}>×</button></div>
          <div className="tqr-modal-content">
            {qrImageSource(selectedTable) ? <img className="tqr-modal-qr" src={qrImageSource(selectedTable)} alt="Table QR code" /> : <div className="tqr-no-qr"><span>▦</span><strong>QR image unavailable</strong></div>}
            <label>Customer menu URL</label><code>{`${CUSTOMER_BASE}/menu/${selectedTable.qrToken || ""}`}</code>
            <label>Permanent QR token</label><code>{selectedTable.qrToken || "Not returned by API"}</code>
          </div>
          <div className="tqr-modal-actions">
            <button type="button" className="tqr-btn tqr-btn-light" onClick={() => copyCustomerLink(selectedTable)}>Copy menu link</button>
            <button type="button" className="tqr-btn tqr-btn-light" onClick={() => printTable(selectedTable)}>Print QR</button>
            <button type="button" className="tqr-btn tqr-btn-primary" onClick={() => toggleTable(selectedTable)}>{selectedTable.active === false ? "Activate table" : "Deactivate table"}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
