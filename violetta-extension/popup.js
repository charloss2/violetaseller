// ── Defaults de conexión (igual que en vendedora.html) ──────────────────────
const DEFAULT_URL = 'https://yafxocedtrktdrplpvie.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhZnhvY2VkdHJrdGRycGxwdmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjgwMDYsImV4cCI6MjA5MDY0NDAwNn0.arzPAHqrGv9-YH_OUJ5vO07f_0ZLsoMspnPlfvLNa3M';

let productos = [];   // lista procesada: [{codigo, nombre, qty}]
let cargando  = false;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await cargarConfigUI();
  await recargarProductos();
  verificarPagina();
});

// ── Tabs ─────────────────────────────────────────────────────────────────────
function showTab(id) {
  ['cargar','config'].forEach(t => {
    document.getElementById('pane-'+t).style.display = t===id ? 'block' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===id);
  });
}

// ── Config ────────────────────────────────────────────────────────────────────
async function cargarConfigUI() {
  const cfg = await chrome.storage.local.get(['supa_url','supa_key','campana']);
  document.getElementById('cfg-url').value  = cfg.supa_url  || DEFAULT_URL;
  document.getElementById('cfg-key').value  = cfg.supa_key  || DEFAULT_KEY;
  document.getElementById('cfg-camp').value = cfg.campana   || 'Campaña 5/26';
}

async function guardarConfig() {
  const url  = document.getElementById('cfg-url').value.trim();
  const key  = document.getElementById('cfg-key').value.trim();
  const camp = document.getElementById('cfg-camp').value.trim();
  await chrome.storage.local.set({ supa_url: url, supa_key: key, campana: camp });
  showMsg('cfg-msg', '✅ Guardado. Actualizando productos...', 'ok');
  setTimeout(() => recargarProductos(), 500);
}

// ── Obtener config activa ─────────────────────────────────────────────────────
async function getCfg() {
  const cfg = await chrome.storage.local.get(['supa_url','supa_key','campana']);
  return {
    url:  cfg.supa_url  || DEFAULT_URL,
    key:  cfg.supa_key  || DEFAULT_KEY,
    camp: cfg.campana   || 'Campaña 5/26'
  };
}

// ── Cargar productos desde Supabase ──────────────────────────────────────────
async function recargarProductos() {
  showMsg('msg-area', '🔄 Buscando productos del pedido...', 'info');
  document.getElementById('products-wrap').innerHTML =
    '<div class="empty"><div class="icon">⏳</div><div>Cargando desde el sistema...</div></div>';
  document.getElementById('btn-cargar').disabled = true;

  try {
    const cfg = await getCfg();
    const h = { 'Content-Type':'application/json', 'apikey': cfg.key, 'Authorization': 'Bearer '+cfg.key };

    // Traer pedidos con items_precio, no cancelados, de la campaña configurada
    const q = `items_precio=not.is.null&estado=neq.cancelado&campana=eq.${encodeURIComponent(cfg.camp)}&order=created_at.desc`;
    const r = await fetch(`${cfg.url}/rest/v1/pedidos?${q}`, { headers: h });
    if (!r.ok) throw new Error('Error Supabase: ' + await r.text());
    const pedidos = await r.json();

    // Expandir en ítems y agrupar por código
    const agrup = {};
    pedidos.forEach(p => {
      let items = [];
      try { items = JSON.parse(p.items_precio); } catch(e) {}
      items.forEach(it => {
        if (!it.codigo || !it.precio) return;
        const k = it.codigo;
        if (!agrup[k]) agrup[k] = { codigo: it.codigo, nombre: it.nombre, qty: 0, clientes: [] };
        agrup[k].qty += (it.qty || 1);
        agrup[k].clientes.push(p.nombre || '—');
      });
    });

    productos = Object.values(agrup).filter(p => p.codigo && p.qty > 0);

    if (!productos.length) {
      document.getElementById('products-wrap').innerHTML =
        '<div class="empty"><div class="icon">📭</div><div>No hay productos con código cargado.<br>Asegurate de guardar los precios con código en el panel de vendedora.</div></div>';
      showMsg('msg-area', '⚠️ Sin productos con código para cargar.', 'warn');
      return;
    }

    renderProductos();
    showMsg('msg-area', `✅ ${productos.length} producto${productos.length!==1?'s':''} listos para cargar en Violetta.`, 'ok');
    document.getElementById('btn-cargar').disabled = false;

  } catch(e) {
    showMsg('msg-area', '❌ ' + e.message, 'err');
    document.getElementById('products-wrap').innerHTML =
      '<div class="empty"><div class="icon">❌</div><div>Error al conectar con el sistema.<br>Revisá la configuración.</div></div>';
  }
}

// ── Renderizar lista de productos ─────────────────────────────────────────────
function renderProductos(estados = {}) {
  const html = productos.map((p, i) => {
    const st = estados[p.codigo];
    const icon = st === 'ok'  ? '<span class="done">✅</span>'
               : st === 'err' ? '<span class="error">❌</span>'
               : st === 'loading' ? '<span style="font-size:14px;">⏳</span>'
               : '<span class="pending">○</span>';
    return `<div class="product-item" id="pitem-${i}">
      <span class="cod">${p.codigo}</span>
      <span class="nom" title="${p.clientes.join(', ')}">${p.nombre}</span>
      <span class="qty">${p.qty}</span>
      ${icon}
    </div>`;
  }).join('');
  document.getElementById('products-wrap').innerHTML =
    `<div class="products-list">${html}</div>`;
}

// ── Verificar que estamos en la página correcta ───────────────────────────────
async function verificarPagina() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    const esVioletta = url.includes('violetta.com.ar');
    const esCesta    = url.includes('hacer-pedido') || url.includes('captacion') || url.includes('pedido');

    const box = document.getElementById('estado-sitio');
    box.style.display = 'block';

    if (esVioletta && esCesta) {
      document.getElementById('sitio-nombre').textContent = '✅ Página de pedido detectada';
      box.style.borderColor = '#86efac';
    } else if (esVioletta) {
      document.getElementById('sitio-nombre').textContent = '⚠️ Andá a "Hacer Pedido" en Violetta';
      box.style.borderColor = '#fde047';
    } else {
      document.getElementById('sitio-nombre').textContent = '❌ Abrí la web de Violetta primero';
      box.style.borderColor = '#fca5a5';
      document.getElementById('btn-cargar').disabled = true;
    }
  } catch(e) {}
}

// ── Iniciar carga en la web ───────────────────────────────────────────────────
async function iniciarCarga() {
  if (cargando || !productos.length) return;
  cargando = true;

  const btn = document.getElementById('btn-cargar');
  btn.disabled  = true;
  btn.textContent = '⏳ Cargando...';
  btn.classList.add('loading');

  document.getElementById('progress-wrap').style.display = 'block';

  const estados = {};
  let ok = 0, err = 0;

  for (let i = 0; i < productos.length; i++) {
    const p = productos[i];
    estados[p.codigo] = 'loading';
    renderProductos(estados);

    // Actualizar barra de progreso
    const pct = Math.round((i / productos.length) * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-pct').textContent  = pct + '%';
    document.getElementById('progress-label').textContent = `Cargando ${i+1} de ${productos.length}: ${p.nombre.substring(0,30)}...`;

    try {
      // Enviar al content script para que lo ingrese en la web
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: agregarProductoEnWeb,
        args: [p.codigo, p.qty]
      });

      const res = result?.[0]?.result;
      if (res?.ok) {
        estados[p.codigo] = 'ok';
        ok++;
      } else {
        estados[p.codigo] = 'err';
        err++;
        console.warn('Error en', p.codigo, res?.error);
      }
    } catch(e) {
      estados[p.codigo] = 'err';
      err++;
    }

    renderProductos(estados);
    // Pausa entre productos para no saturar la web
    await sleep(1800);
  }

  // Final
  document.getElementById('progress-fill').style.width = '100%';
  document.getElementById('progress-pct').textContent  = '100%';
  document.getElementById('progress-label').textContent = '¡Listo!';

  cargando = false;
  btn.disabled    = false;
  btn.textContent = '🚀 Cargar en la web de Violetta';
  btn.classList.remove('loading');

  if (err === 0) {
    showMsg('msg-area', `✅ ${ok} producto${ok!==1?'s':''} cargados correctamente en la cesta.`, 'ok');
  } else {
    showMsg('msg-area', `⚠️ ${ok} OK · ${err} con error. Revisá los marcados con ❌ y agregalos manualmente.`, 'warn');
  }
}

// ── Función que se ejecuta DENTRO de la pestaña de Violetta ──────────────────
// Esta función se inyecta en la página de Violetta y simula la interacción
function agregarProductoEnWeb(codigo, qty) {
  return new Promise(resolve => {
    try {
      // 1. Buscar el input de producto (campo "Ingrese el código o nombre del producto")
      const input = document.querySelector(
        'input[placeholder*="código"], input[placeholder*="codigo"], input[placeholder*="nombre del producto"], input[placeholder*="Ingrese"]'
      );
      if (!input) { resolve({ ok: false, error: 'Input no encontrado' }); return; }

      // 2. Limpiar y escribir el código
      input.focus();
      input.value = '';
      // Disparar evento para que React/Vue detecte el cambio
      input.dispatchEvent(new Event('input',  { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      setTimeout(() => {
        input.value = String(codigo);
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // Simular tecla Enter o buscar el botón AÑADIR
        input.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', keyCode:13, bubbles:true }));
        input.dispatchEvent(new KeyboardEvent('keyup',   { key:'Enter', keyCode:13, bubbles:true }));

        // 3. Esperar a que aparezca el producto en la lista y ajustar cantidad
        setTimeout(() => {
          // Buscar botón AÑADIR
          const btnAnadir = [...document.querySelectorAll('button')].find(b =>
            b.textContent.trim().toUpperCase().includes('AÑADIR') ||
            b.textContent.trim().toUpperCase().includes('ANADIR') ||
            b.textContent.trim().toUpperCase().includes('AGREGAR')
          );
          if (btnAnadir) {
            btnAnadir.click();
            setTimeout(() => {
              // Ajustar cantidad si qty > 1
              if (qty > 1) {
                // Buscar el último ítem agregado y sus botones + de cantidad
                const plusBtns = document.querySelectorAll('button[class*="plus"], button[aria-label*="suma"], button[aria-label*="más"]');
                const lastPlus = plusBtns[plusBtns.length - 1];
                let clicks = qty - 1;
                const clickInterval = setInterval(() => {
                  if (clicks <= 0) { clearInterval(clickInterval); resolve({ ok: true }); return; }
                  if (lastPlus) lastPlus.click();
                  clicks--;
                }, 300);
              } else {
                resolve({ ok: true });
              }
            }, 1200);
          } else {
            // Intentar con Enter si no hay botón
            resolve({ ok: true, error: 'btn AÑADIR no encontrado, Enter enviado' });
          }
        }, 1500);
      }, 400);

    } catch(e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="msg ${type}">${text}</div>`;
}
