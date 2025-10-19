const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

const products = window.__PRODUCTS__ || [];
const cartKey = "liteshop_cart_v2";
const cart = JSON.parse(localStorage.getItem(cartKey) || "{}");
const fmt = n => new Intl.NumberFormat(undefined, {style:'currency', currency:'USD'}).format(n);

(function buildSchema(){
  const items = (window.__PRODUCTS__||[]).map(p => ({
    "@type":"Product",
    "name": p.title,
    "sku": p.sku,
    "brand": {"@type":"Brand","name": p.brand||"LiteShop"},
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": p.price.toFixed(2),
      "availability": "https://schema.org/" + (p.availability || "InStock")
    }
  }));
  document.getElementById("schema-products").textContent = JSON.stringify({
    "@context":"https://schema.org",
    "@graph": items
  });
})();

function renderProducts(list = products){
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  list.forEach(p=>{
    const el = document.createElement("article");
    el.className = "item";
    el.setAttribute("role", "listitem");
    el.innerHTML = `
      <div class="box">
        <img alt="${p.title}" loading="lazy" class="thumb" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect width='100%25' height='100%25' fill='${encodeURIComponent(p.img)}'/%3E%3C/svg%3E">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
      </div>
      <div class="info">
        <h3 class="title">${p.title}</h3>
        <div class="cardbar">
          <div class="price">${fmt(p.price)}</div>
          <div class="qty">
            <button aria-label="decrease" data-id="${p.id}" class="dec">−</button>
            <span id="q-${p.id}">${cart[p.id]?.qty || 0}</span>
            <button aria-label="increase" data-id="${p.id}" class="inc">+</button>
          </div>
        </div>
        <button class="btn" data-add="${p.id}">Add to Cart</button>
      </div>`;
    grid.appendChild(el);
  });

  grid.addEventListener("click", e=>{
    const add = e.target.closest("[data-add]");
    const inc = e.target.closest(".inc");
    const dec = e.target.closest(".dec");
    if(add){ addToCart(add.dataset.add, 1); }
    if(inc){ addToCart(inc.dataset.id, 1, true); }
    if(dec){ addToCart(dec.dataset.id, -1, true); }
  });
}

function addToCart(id, delta=1, silent=false){
  const prod = products.find(p=>p.id===id);
  if(!prod) return;
  const entry = cart[id] || {id, title:prod.title, price:prod.price, qty:0, img:prod.img};
  entry.qty = Math.max(0, (entry.qty||0) + delta);
  if(entry.qty===0) delete cart[id]; else cart[id] = entry;
  localStorage.setItem(cartKey, JSON.stringify(cart));
  updateBadges();
  renderCart();
  window.analytics.track('cart_update', {id, qty: entry.qty});
  if(!silent) openDrawer();
  toast(`${prod.title} — ${delta>0? 'added':'updated'}`);
}

function updateBadges(){
  let count = Object.values(cart).reduce((s,i)=>s+i.qty,0);
  let total = Object.values(cart).reduce((s,i)=>s+i.qty*i.price,0);
  document.getElementById("cartCount").textContent = count;
  document.getElementById("subtotal").textContent = fmt(total||0);
  products.forEach(p=>{
    const span = document.getElementById("q-"+p.id);
    if(span) span.textContent = cart[p.id]?.qty || 0;
  });
}

function renderCart(){
  const list = document.getElementById("cartList");
  list.innerHTML = "";
  const items = Object.values(cart);
  if(items.length===0){
    list.innerHTML = `<p class="muted">Your cart is empty.</p>`;
    return;
  }
  items.forEach(it=>{
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <div class="ph" style="background:${it.img}">IMG</div>
      <div>
        <div style="color:#e6f0ff;font-weight:700">${it.title}</div>
        <div style="color:#94a3b8">${fmt(it.price)} × ${it.qty}</div>
      </div>
      <div style="color:#e6f0ff">${fmt(it.price*it.qty)}</div>
    `;
    list.appendChild(row);
  });
}

function openDrawer(){
  const drawer = document.getElementById("drawer");
  drawer.classList.add("open");
  document.getElementById("backdrop").classList.add("show");
  drawer.setAttribute("aria-hidden","false");
  document.getElementById("cartBtn").setAttribute("aria-expanded","true");
  drawer.dataset.prev = document.activeElement ? (document.activeElement.id || "cartBtn") : "cartBtn";
  document.getElementById("closeDrawer").focus();
}
function closeDrawer(){
  const drawer = document.getElementById("drawer");
  drawer.classList.remove("open");
  document.getElementById("backdrop").classList.remove("show");
  drawer.setAttribute("aria-hidden","true");
  document.getElementById("cartBtn").setAttribute("aria-expanded","false");
  const prev = drawer.dataset.prev || "cartBtn";
  (document.getElementById(prev) || document.getElementById("cartBtn")).focus();
}

function toast(msg){
  let t = document.getElementById("toast");
  if(!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1300);
}

function attachGlobalHandlers(){
  document.getElementById("cartBtn").onclick = openDrawer;
  document.getElementById("closeDrawer").onclick = closeDrawer;
  document.getElementById("backdrop").onclick = closeDrawer;
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && document.getElementById("drawer").classList.contains("open")) closeDrawer();
  });

  document.getElementById("search").addEventListener("input", e=>{
    const q = e.target.value.trim().toLowerCase();
    const list = products.filter(p => p.title.toLowerCase().includes(q));
    renderProducts(sorted(list, document.getElementById("sort").value));
  });
  document.getElementById("sort").addEventListener("change", e=>{
    const mode = e.target.value;
    const q = document.getElementById("search").value.trim().toLowerCase();
    const list = products.filter(p => p.title.toLowerCase().includes(q));
    renderProducts(sorted(list, mode));
  });

  document.getElementById("checkout").onclick = ()=>{
    const order = Object.values(cart);
    if(order.length===0){ alert("Cart is empty."); return; }
    const data = new Blob([JSON.stringify({order, total: order.reduce((s,i)=>s+i.qty*i.price,0)}, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = "order.json"; a.click();
    URL.revokeObjectURL(url);
    alert("Checkout complete (demo). Downloaded order.json.");
    localStorage.removeItem(cartKey);
    Object.keys(cart).forEach(k=>delete cart[k]);
    updateBadges(); renderCart();
  };

  document.getElementById("clearCart").onclick = ()=>{
    if(confirm("Clear all items?")){
      localStorage.removeItem(cartKey);
      Object.keys(cart).forEach(k=>delete cart[k]);
      updateBadges(); renderCart();
    }
  };
}

function sorted(list, mode){
  let out = [...list];
  if(mode === "asc") out.sort((a,b)=>a.price-b.price);
  else if(mode === "desc") out.sort((a,b)=>b.price-a.price);
  else if(mode === "az") out.sort((a,b)=>a.title.localeCompare(b.title));
  else out.sort((a,b)=> (b.popularity||0) - (a.popularity||0));
  return out;
}

function init(){
  document.getElementById("year").textContent = new Date().getFullYear();
  renderProducts(sorted(products, "pop"));
  renderCart();
  updateBadges();
  attachGlobalHandlers();
  window.analytics.track('page_view');
}
document.addEventListener("DOMContentLoaded", init);
