/* PayNest — single PWA controller */
(() => {
  "use strict";

  const SW_URL = "./sw.js";
  const SW_SCOPE = "./";
  let deferredInstallPrompt = null;

  const button = () => document.getElementById("installApp");

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  const renderButton = () => {
    const el = button();
    if (!el) return;
    el.hidden = isStandalone() || !deferredInstallPrompt;
  };

  const registerServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: SW_SCOPE,
        updateViaCache: "none"
      });
      try { await registration.update(); } catch (_) {}
      console.info("[PayNest PWA] Service Worker ready");
    } catch (error) {
      console.error("[PayNest PWA] Service Worker registration failed:", error);
    }
  };

  const install = async () => {
    if (!deferredInstallPrompt || isStandalone()) return;
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    renderButton();
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (error) {
      console.warn("[PayNest PWA] Install prompt failed:", error);
    }
  };

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    renderButton();
  });

  window.addEventListener("load", () => {
    const el = button();
    el?.addEventListener("click", install);
    renderButton();
    registerServiceWorker();
  });
})();
