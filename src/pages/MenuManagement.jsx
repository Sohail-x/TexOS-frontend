import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, requireRestaurantId, useActiveRestaurantId } from "./restaurantApi";
import "./MenuManagement.css";

async function api(path, options = {}) {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || body?.error || `Request failed (HTTP ${response.status})`
    );
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

function listFrom(data) { return Array.isArray(data) ? data : data?.content || data?.items || data?.categories || data?.data || []; }
function currency(value) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0)); }

const emptyCategory = { categoryName: "", description: "", displayOrder: 0 };
const emptyItem = { itemName: "", description: "", price: "", imageUrl: "", displayOrder: 0 };

export default function MenuManagement() {
  const restaurantId = useActiveRestaurantId();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [categoryForm, setCategoryForm] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSaving, setImportSaving] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const itemImageInputRef = useRef(null);

  function uploadItemImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/)) {
      setError("Please choose a PNG, JPEG, WebP, or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Menu image must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setItemForm((current) => current ? { ...current, imageUrl: String(reader.result) } : current);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  const loadMenu = useCallback(async () => {
    if (!restaurantId) {
      setCategories([]);
      setItems([]);
      setError("No restaurant selected. Please select a restaurant first.");
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try {
      const [categoryData, itemData] = await Promise.all([
        api(`/api/restaurants/${requireRestaurantId(restaurantId)}/categories`),
        api(`/api/restaurants/${requireRestaurantId(restaurantId)}/items`),
      ]);
      setCategories(listFrom(categoryData));
      setItems(listFrom(itemData));
    } catch (err) { setError(err.message || "Could not load menu data."); }
    finally { setLoading(false); }
  }, [restaurantId]);

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

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const categoryMatch = selectedCategory === "ALL" || String(item.categoryId) === String(selectedCategory);
      const textMatch = !query || `${item.itemName || ""} ${item.description || ""} ${item.categoryName || ""}`.toLowerCase().includes(query);
      return categoryMatch && textMatch;
    });
  }, [items, selectedCategory, search]);
  const needsDefaultCategory = importRows.some((row) => !row.categoryName.trim());

  async function saveCategory(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const payload = { categoryName: categoryForm.categoryName.trim(), description: categoryForm.description.trim(), displayOrder: Number(categoryForm.displayOrder || 0) };
      if (editingCategoryId) await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/categories/${editingCategoryId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/categories`, { method: "POST", body: JSON.stringify(payload) });
      setCategoryForm(null); setEditingCategoryId(null); setNotice(editingCategoryId ? "Category updated." : "Category created."); await loadMenu();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function saveItem(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const payload = { itemName: itemForm.itemName.trim(), description: itemForm.description.trim(), price: Number(itemForm.price), imageUrl: itemForm.imageUrl.trim(), displayOrder: Number(itemForm.displayOrder || 0) };
      const itemRoute = `/api/restaurants/${requireRestaurantId(restaurantId)}/categories/${itemForm.categoryId}/items`;
      if (editingItemId) await api(`${itemRoute}/${editingItemId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api(itemRoute, { method: "POST", body: JSON.stringify(payload) });
      setItemForm(null); setEditingItemId(null); setNotice(editingItemId ? "Menu item updated." : "Menu item created."); await loadMenu();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function editCategory(category) { setEditingCategoryId(category.id); setCategoryForm({ categoryName: category.categoryName || "", description: category.description || "", displayOrder: category.displayOrder ?? 0 }); }
  function editItem(item) { setEditingItemId(item.id); setItemForm({ itemName: item.itemName || "", description: item.description || "", price: String(item.price ?? ""), imageUrl: item.imageUrl || "", displayOrder: item.displayOrder ?? 0, categoryId: item.categoryId }); }

  async function toggleCategory(category) {
    setError(""); setNotice("");
    try { await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/categories/${category.id}/status?active=${!category.active}`, { method: "PATCH" }); setNotice(`Category ${!category.active ? "activated" : "deactivated"}.`); await loadMenu(); }
    catch (err) { setError(err.message); }
  }
  async function toggleItem(item) {
    setError(""); setNotice("");
    try { await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/categories/${item.categoryId}/items/${item.id}/availability?available=${!item.available}`, { method: "PATCH" }); setNotice(`Item ${!item.available ? "made available" : "marked unavailable"}.`); await loadMenu(); }
    catch (err) { setError(err.message); }
  }
  async function deleteCategory(category) {
    if (!window.confirm(`Delete category “${category.categoryName}”?`)) return;
    setError("");
    try { await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/categories/${category.id}`, { method: "DELETE" }); setNotice("Category deleted."); if (String(selectedCategory) === String(category.id)) setSelectedCategory("ALL"); await loadMenu(); }
    catch (err) { setError(err.message); }
  }
  async function deleteItem(item) {
    if (!window.confirm(`Delete “${item.itemName}”?`)) return;
    setError("");
    try { await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/categories/${item.categoryId}/items/${item.id}`, { method: "DELETE" }); setNotice("Menu item deleted."); await loadMenu(); }
    catch (err) { setError(err.message); }
  }

  async function previewMenuFile() {
    if (!importFile) { setImportError("Choose an Excel or PDF file first."); return; }
    setImportLoading(true); setImportError(""); setImportRows([]);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const parsed = await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/menu/import/preview`, {
        method: "POST",
        body: form,
      });
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No menu rows were found in this file.");
      setImportRows(parsed.map((item) => ({
        itemName: item.itemName || "",
        categoryName: item.categoryName || "",
        description: item.description || "",
        price: item.price == null ? "" : String(item.price),
      })));
    } catch (err) { setImportError(err.message || "Could not read this menu file."); }
    finally { setImportLoading(false); }
  }

  function updateImportRow(rowIndex, patch) {
    setImportRows((current) => current.map((row, index) => index === rowIndex ? { ...row, ...patch } : row));
  }

  async function saveImportedMenu() {
    if (!importRows.length) return;
    if (importRows.some((row) => !row.itemName.trim() || row.price === "" || !Number.isFinite(Number(row.price)) || Number(row.price) < 0)) {
      setImportError("Each row needs an item name and a valid non-negative price.");
      return;
    }
    if (defaultCategory === "NEW" && !newCategoryName.trim()) {
      setImportError("Enter a name for the new default category.");
      return;
    }
    setImportSaving(true); setImportError(""); setError(""); setNotice("");
    try {
      const payload = {
        items: importRows.map((row) => ({
          itemName: row.itemName.trim(),
          categoryName: row.categoryName.trim(),
          description: row.description.trim(),
          price: Number(row.price),
        })),
        ...(defaultCategory && defaultCategory !== "NEW" ? { defaultCategoryId: Number(defaultCategory) } : {}),
        ...(defaultCategory === "NEW" ? { defaultCategoryName: newCategoryName.trim() } : {}),
      };
      const result = await api(`/api/restaurants/${requireRestaurantId(restaurantId)}/menu/import`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setImportOpen(false); setImportFile(null); setImportRows([]);
      setNotice(`${result.importedCount} menu item${result.importedCount === 1 ? "" : "s"} imported.`);
      await loadMenu();
    } catch (err) { setImportError(err.message || "Could not import this menu."); }
    finally { setImportSaving(false); }
  }

  return <section className="menu-page">
    <div className="menu-page-heading"><div><p className="menu-eyebrow">WORKSPACE / MENU</p><h1>Menu Management</h1><p>Manage categories, food items, prices and availability.</p></div><div className="menu-heading-actions"><button className="menu-btn menu-btn-light" onClick={loadMenu} type="button">↻ Refresh</button><button className="menu-btn menu-btn-light" onClick={() => { setImportOpen(true); setImportError(""); setImportRows([]); setDefaultCategory(""); setNewCategoryName(""); }} type="button">＋ Import menu</button><button className="menu-btn menu-btn-primary" onClick={() => { setEditingCategoryId(null); setCategoryForm({ ...emptyCategory }); }} type="button">＋ Add category</button><button className="menu-btn menu-btn-primary" onClick={() => { setEditingItemId(null); setItemForm({ ...emptyItem, categoryId: categories[0]?.id || "" }); }} type="button" disabled={!categories.length}>＋ Add item</button></div></div>
    <div className="menu-stats"><div><span>Categories</span><strong>{categories.length}</strong></div><div><span>Total menu items</span><strong>{items.length}</strong></div><div><span>Available items</span><strong>{items.filter((item) => item.available).length}</strong></div><div><span>Unavailable items</span><strong>{items.filter((item) => !item.available).length}</strong></div></div>
    {error && <div className="menu-alert menu-alert-error" role="alert">{error}</div>}{notice && <div className="menu-alert menu-alert-success" role="status">{notice}</div>}

    {importOpen && <div className="menu-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !importLoading && !importSaving) setImportOpen(false); }}>
      <div className="menu-form-modal menu-import-modal">
        <div className="menu-modal-heading"><div><span>MENU IMPORT</span><h2>Import from Excel or PDF</h2></div><button type="button" disabled={importLoading || importSaving} onClick={() => setImportOpen(false)}>✕</button></div>
        <div className="menu-form menu-import-content">
          <p className="menu-import-intro">Excel files need an Item Name and Price header. Text-based PDFs with one item and price per line are supported; scanned image PDFs are not.</p>
          <label className="menu-import-upload">Choose .xlsx, .xls or .pdf<input type="file" accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setImportRows([]); setImportError(""); }} /></label>
          {importFile && <div className="menu-import-file"><span>{importFile.name}</span><small>{(importFile.size / 1024 / 1024).toFixed(2)} MB</small></div>}
          {importRows.length > 0 && <>
            <label>Default category for rows without a category
              <select value={defaultCategory} onChange={(event) => { setDefaultCategory(event.target.value); setImportError(""); }}>
                <option value="">Select a category</option>
                {categories.map((category) => <option key={category.id} value={String(category.id)}>{category.categoryName}</option>)}
                <option value="NEW">Create a new category</option>
              </select>
            </label>
            {defaultCategory === "NEW" && <label>New category name<input maxLength="100" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="e.g. Main course" /></label>}
            <div className="menu-import-review-heading"><strong>Review imported items</strong><span>{importRows.length} rows</span></div>
            <div className="menu-import-review-list">{importRows.map((row, index) => <div className="menu-import-row" key={`import-${index}`}>
              <input aria-label={`Item ${index + 1} name`} value={row.itemName} maxLength="150" onChange={(event) => updateImportRow(index, { itemName: event.target.value })} placeholder="Item name" />
              <input aria-label={`Item ${index + 1} price`} type="number" min="0" step="0.01" value={row.price} onChange={(event) => updateImportRow(index, { price: event.target.value })} placeholder="Price" />
              <input aria-label={`Item ${index + 1} category`} value={row.categoryName} maxLength="100" onChange={(event) => updateImportRow(index, { categoryName: event.target.value })} placeholder="Category (optional)" />
              <input aria-label={`Item ${index + 1} description`} value={row.description} maxLength="1000" onChange={(event) => updateImportRow(index, { description: event.target.value })} placeholder="Description (optional)" />
              <button type="button" title="Remove item" onClick={() => setImportRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>×</button>
            </div>)}</div>
          </>}
          {importError && <div className="menu-alert menu-alert-error" role="alert">{importError}</div>}
          {importLoading && <div className="menu-import-progress">Reading menu file…</div>}
          <div className="menu-form-actions">
            <button type="button" className="menu-btn menu-btn-light" disabled={importLoading || importSaving} onClick={() => setImportOpen(false)}>Cancel</button>
            {importRows.length === 0
              ? <button type="button" className="menu-btn menu-btn-primary" disabled={!importFile || importLoading} onClick={previewMenuFile}>{importLoading ? "Reading…" : "Read menu"}</button>
              : <button type="button" className="menu-btn menu-btn-primary" disabled={importSaving || !importRows.length || (needsDefaultCategory && !defaultCategory)} onClick={saveImportedMenu}>{importSaving ? "Importing…" : "Confirm & import"}</button>}
          </div>
        </div>
      </div>
    </div>}

    {(categoryForm || itemForm) && <div className="menu-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCategoryForm(null); setItemForm(null); setEditingCategoryId(null); setEditingItemId(null); } }}>
      <div className="menu-form-modal">
        <div className="menu-modal-heading"><div><span>{categoryForm ? "CATEGORY DETAILS" : "MENU ITEM DETAILS"}</span><h2>{categoryForm ? (editingCategoryId ? "Edit category" : "Add category") : (editingItemId ? "Edit menu item" : "Add menu item")}</h2></div><button type="button" onClick={() => { setCategoryForm(null); setItemForm(null); setEditingCategoryId(null); setEditingItemId(null); }}>✕</button></div>
        {categoryForm && <form onSubmit={saveCategory} className="menu-form"><label>Category name<input required maxLength="100" value={categoryForm.categoryName} onChange={(e) => setCategoryForm({ ...categoryForm, categoryName: e.target.value })} placeholder="e.g. Starters" /></label><label>Description<textarea rows="3" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} placeholder="Short category description" /></label><label>Display order<input type="number" min="0" value={categoryForm.displayOrder} onChange={(e) => setCategoryForm({ ...categoryForm, displayOrder: e.target.value })} /></label><div className="menu-form-actions"><button type="button" className="menu-btn menu-btn-light" onClick={() => setCategoryForm(null)}>Cancel</button><button className="menu-btn menu-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save category"}</button></div></form>}
        {itemForm && <form onSubmit={saveItem} className="menu-form"><label>Item name<input required maxLength="120" value={itemForm.itemName} onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })} placeholder="e.g. Chicken Lollipop" /></label><label>Category<select required value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })} disabled={!!editingItemId}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.categoryName}</option>)}</select></label><label>Price (₹)<input required type="number" min="0" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} placeholder="0.00" /></label><label>Description<textarea rows="3" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Describe this item" /></label><label>Image URL<input type="text" value={itemForm.imageUrl?.startsWith("data:image/") ? "" : itemForm.imageUrl} onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })} placeholder="https://..." /></label><div className="menu-item-image-upload"><input ref={itemImageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadItemImage} /><button type="button" className="menu-btn menu-btn-light" onClick={() => itemImageInputRef.current?.click()}>Upload image</button>{itemForm.imageUrl?.startsWith("data:image/") && <><span>Image selected</span><button type="button" className="menu-image-clear" onClick={() => { setItemForm({ ...itemForm, imageUrl: "" }); if (itemImageInputRef.current) itemImageInputRef.current.value = ""; }}>Remove</button></>}</div><label>Display order<input type="number" min="0" value={itemForm.displayOrder} onChange={(e) => setItemForm({ ...itemForm, displayOrder: e.target.value })} /></label><div className="menu-form-actions"><button type="button" className="menu-btn menu-btn-light" onClick={() => setItemForm(null)}>Cancel</button><button className="menu-btn menu-btn-primary" disabled={saving || !categories.length}>{saving ? "Saving…" : "Save item"}</button></div></form>}
      </div>
    </div>}

    <div className="menu-layout"><aside className="menu-category-panel"><div className="menu-section-title"><div><h2>Categories</h2><p>Filter items by category</p></div><span>{categories.length}</span></div><button type="button" className={`menu-category-option ${selectedCategory === "ALL" ? "selected" : ""}`} onClick={() => setSelectedCategory("ALL")}><span>All items</span><b>{items.length}</b></button>{categories.map((category) => <div className={`menu-category-row ${String(selectedCategory) === String(category.id) ? "selected" : ""}`} key={category.id}><button type="button" className="menu-category-option" onClick={() => setSelectedCategory(String(category.id))}><span>{category.categoryName}</span><b>{items.filter((item) => String(item.categoryId) === String(category.id)).length}</b></button><div className="menu-category-tools"><button title="Edit category" onClick={() => editCategory(category)} type="button">✎</button><button title={category.active ? "Deactivate" : "Activate"} onClick={() => toggleCategory(category)} type="button">{category.active ? "◉" : "○"}</button><button title="Delete category" onClick={() => deleteCategory(category)} type="button">⌫</button></div></div>)}</aside>
      <div className="menu-items-panel"><div className="menu-items-toolbar"><div><h2>Menu items</h2><p>{visibleItems.length} item{visibleItems.length === 1 ? "" : "s"} shown</p></div><input aria-label="Search menu items" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu items…" /></div>
        {loading ? <div className="menu-empty">Loading menu…</div> : visibleItems.length === 0 ? <div className="menu-empty"><strong>No menu items found</strong><span>Add a menu item or choose another category.</span></div> : <div className="menu-item-grid">{visibleItems.map((item) => <article className={`menu-item-card ${!item.available ? "is-unavailable" : ""}`} key={item.id}><div className="menu-item-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.itemName} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span>🍽️</span>}<i className={item.available ? "available" : "unavailable"}>{item.available ? "Available" : "Unavailable"}</i></div><div className="menu-item-body"><span className="menu-item-category">{item.categoryName || categories.find((category) => String(category.id) === String(item.categoryId))?.categoryName || "Uncategorised"}</span><h3>{item.itemName}</h3><p>{item.description || "No description added."}</p><div className="menu-item-footer"><strong>{currency(item.price)}</strong><div><button type="button" title="Edit item" onClick={() => editItem(item)}>✎</button><button type="button" title={item.available ? "Mark unavailable" : "Make available"} onClick={() => toggleItem(item)}>{item.available ? "◉" : "○"}</button><button type="button" title="Delete item" onClick={() => deleteItem(item)}>⌫</button></div></div></div></article>)}</div>}
      </div></div>
  </section>;
}
