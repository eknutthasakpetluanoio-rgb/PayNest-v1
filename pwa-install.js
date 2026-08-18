/* PayNest — PWA controller (single source of truth) */
(() => {
  "use strict";

  const SW_URL = "./sw.js";
  const SW_SCOPE = "./";
  let deferredInstallPrompt = null;

  const $ = id => document.getElementById(id);

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true;

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: SW_SCOPE,
        updateViaCache: "none"
      });
      try { await registration.update(); } catch (_) {}
      return registration;
    } catch (error) {
      console.error("[PayNest PWA] Service Worker registration failed:", error);
      return null;
    }
  }

  function showInstallButton() {
    const el = $("installApp");
    if (!el) return;
    el.hidden = isStandalone();
    el.setAttribute("aria-hidden", String(isStandalone()));
  }

  function closeInstallHelp() {
    const root = $("pwaInstallRoot");
    if (root) root.innerHTML = "";
  }

  function showInstallHelp() {
    let root = $("pwaInstallRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "pwaInstallRoot";
      document.body.appendChild(root);
    }

    root.innerHTML = `
      <div class="overlay" role="dialog" aria-modal="true" aria-label="ติดตั้ง PayNest">
        <div class="modal small">
          <div class="modal-head">
            <div>
              <div class="eyebrow">PAYNEST PWA</div>
              <h2>ติดตั้ง PayNest</h2>
            </div>
            <button class="icon-btn" type="button" data-pwa-close aria-label="ปิด">×</button>
          </div>

          <div class="form-note">
            <b>เพิ่ม PayNest ลงหน้าจอหลัก</b>
            <span>
              หาก Chrome ยังไม่แสดงหน้าต่างติดตั้งอัตโนมัติ
              ให้เปิดเมนู <b>⋮</b> ของ Chrome แล้วเลือก
              <b>ติดตั้งแอป</b> หรือ <b>เพิ่มไปยังหน้าจอหลัก</b>
            </span>
          </div>

          <button class="wide-btn" type="button" data-pwa-close>เข้าใจแล้ว</button>
        </div>
      </div>
    `;

    root.querySelectorAll("[data-pwa-close]").forEach(el =>
      el.addEventListener("click", closeInstallHelp)
    );
  }

  async function install() {
    if (isStandalone()) return;

    if (!deferredInstallPrompt) {
      showInstallHelp();
      return;
    }

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (error) {
      console.warn("[PayNest PWA] Install prompt failed:", error);
    }

    showInstallButton();
  }

  // Register immediately. Do not wait for window.load.
  registerServiceWorker();

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    showInstallButton();
  });

  window.addEventListener("DOMContentLoaded", () => {
    const el = $("installApp");
    el?.addEventListener("click", install);
    showInstallButton();
  });

  window.addEventListener("pageshow", showInstallButton);
})();
