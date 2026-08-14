/* PayNest PWA controller — single install flow + single service worker registration. */

(() => {
  "use strict";

  const SW_URL = "./sw.js";
  const SW_SCOPE = "./";
  const PWA_VERSION = "20260814-v2";

  let deferredInstallPrompt = null;

  const getInstallButton = () => document.getElementById("installApp");

  function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;
  }

  function showInstallButton() {
    const button = getInstallButton();
    if (!button || isStandalone()) return;
    button.hidden = false;
  }

  function hideInstallButton() {
    const button = getInstallButton();
    if (button) button.hidden = true;
  }

  async function promptInstall() {
    if (!deferredInstallPrompt) return;

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    hideInstallButton();

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (error) {
      console.warn("[PayNest PWA] install prompt failed:", error);
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;

    try {
      const registration = await navigator.serviceWorker.register(
        SW_URL,
        { scope: SW_SCOPE, updateViaCache: "none" }
      );

      try {
        await registration.update();
      } catch (_) {}

      console.info("[PayNest PWA] Service Worker registered", PWA_VERSION);
      return registration;
    } catch (error) {
      console.error("[PayNest PWA] Service Worker registration failed:", error);
      return null;
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
    console.info("[PayNest PWA] install prompt available");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallButton();
    console.info("[PayNest PWA] installed");
  });

  window.addEventListener("load", () => {
    const button = getInstallButton();

    if (button) {
      button.addEventListener("click", promptInstall);
      if (isStandalone()) hideInstallButton();
    }

    registerServiceWorker();

    if (isStandalone()) {
      console.info("[PayNest PWA] running as installed app", PWA_VERSION);
    }
  });
})();
