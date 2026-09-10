(() => {
  if (!('serviceWorker' in navigator)) return;
  let installPrompt = null;
  const state = document.querySelector('[data-network-state]');
  const installButton = document.querySelector('[data-pwa-install]');

  const paintNetwork = () => {
    const online = navigator.onLine;
    if (!state) return;
    state.classList.toggle('is-offline', !online);
    const label = state.querySelector('span');
    if (label) label.textContent = online ? 'Onlayn' : 'Offline';
    state.title = online ? 'Server bilan aloqa mavjud' : 'Internet yo‘q. Ayrim amallar qurilmada navbatga saqlanadi.';
  };
  paintNetwork();
  window.addEventListener('online', () => { paintNetwork(); navigator.serviceWorker.controller?.postMessage({type:'REPLAY_QUEUE'}); });
  window.addEventListener('offline', paintNetwork);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (_) {}
    installPrompt = null; installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (installButton) installButton.hidden = true; });

  navigator.serviceWorker.register('/sw.js', {scope:'/'}).catch(() => {});

  document.addEventListener('submit', event => {
    if (navigator.onLine) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const hasFile = form.enctype === 'multipart/form-data' || !!form.querySelector('input[type="file"]');
    if (hasFile) {
      event.preventDefault();
      alert('Fayl yuklash uchun internet aloqasi kerak. Internet qaytgach qayta urinib ko‘ring.');
    }
  }, true);
})();
