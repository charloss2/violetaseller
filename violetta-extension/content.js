// content.js — se inyecta automáticamente en violetta.com.ar
// Escucha mensajes del popup y facilita la interacción con la página

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'ping') {
    sendResponse({ ok: true, url: window.location.href });
  }
  if (msg.action === 'getPageInfo') {
    sendResponse({
      url:     window.location.href,
      title:   document.title,
      hasInput: !!document.querySelector('input[placeholder*="código"], input[placeholder*="nombre del producto"], input[placeholder*="Ingrese"]')
    });
  }
});

// Indicador visual cuando la extensión está activa
const badge = document.createElement('div');
badge.style.cssText = [
  'position:fixed', 'bottom:20px', 'right:20px', 'z-index:99999',
  'background:linear-gradient(135deg,#7c3aed,#ec4899)', 'color:white',
  'padding:8px 14px', 'border-radius:20px', 'font-size:12px', 'font-weight:700',
  'font-family:system-ui,sans-serif', 'box-shadow:0 4px 16px rgba(124,58,237,.4)',
  'cursor:pointer', 'user-select:none', 'transition:opacity .3s'
].join(';');
badge.textContent = '♦ Violetta Auto-Carga activa';
badge.title = 'Extensión de carga automática de pedidos';
document.body.appendChild(badge);

// Ocultar badge después de 4 segundos
setTimeout(() => { badge.style.opacity = '0'; }, 4000);
setTimeout(() => { badge.remove(); }, 4500);
