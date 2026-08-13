/* PayNest PWA controller — PWA-only layer. */

(() => {
  "use strict";

  const SW_URL = "./sw.js";
  const PWA_VERSION = "20260814-v1";

  let deferredInstallPrompt = null;

  function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;
  }

  function removeInstallButton() {
    document.getElementById("paynest-pwa-install")?.remove();
  }

  function createInstallButton() {
    if (isStandalone() || document.getElementById("paynest-pwa-install")) return;

    const button = document.createElement("button");
    button.id = "paynest-pwa-install";
    button.type = "button";
    button.textContent = "ติดตั้ง PayNest";
    button.setAttribute("aria-label", "ติดตั้ง PayNest");

    Object.assign(button.style, {
      position: "fixed",
      left: "50%",
      bottom: "96px",
      transform: "translateX(-50%)",
      zIndex: "9999",
      border: "1px solid rgba(255,255,255,.22)",
      borderRadius: "18px",
      padding: "14px 22px",
      background: "rgba(245,245,248,.96)",
      color: "#050507",
      font: "700 15px system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
      boxShadow: "0 14px 40px rgba(0,0,0,.55)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)"
    });

    button.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;

      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      removeInstallButton();

      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch (_) {}
    });

    document.body.appendChild(button);
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;

    try {
      const registration = await navigator.serviceWorker.register(
        SW_URL,
        { scope: "./", updateViaCache: "none" }
      );

      // Ask the browser to check for a new PWA controller.
      try {
        await registration.update();
      } catch (_) {}

      return registration;
    } catch (error) {
      console.warn("[PayNest PWA] Service Worker registration failed:", error);
      return null;
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    createInstallButton();
    console.info("[PayNest PWA] install prompt available");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    removeInstallButton();
    console.info("[PayNest PWA] installed");
  });

  window.addEventListener("load", () => {
    registerServiceWorker();

    if (isStandalone()) {
      console.info("[PayNest PWA] running as installed app", PWA_VERSION);
    }
  });
})();
