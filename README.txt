PayNest PWA FINAL v1

PWA-only patch for the latest PayNest project.

Included:
- manifest.json
- sw.js
- pwa-install.js
- icons/icon-192.png
- icons/icon-512.png
- INDEX-PWA-INTEGRATION.txt

Design goals:
1. Chrome installability criteria
2. Service Worker controls the start URL
3. Offline navigation fallback
4. Resilient installation: one missing optional shell file cannot abort SW installation
5. Online-first navigation keeps index fresh
6. LocalStorage app remains usable offline; Firebase/cloud sync can fail gracefully when offline
7. beforeinstallprompt is captured and a temporary "ติดตั้ง PayNest" button appears only when Chrome says installation is available
8. No PayNest UI/business logic is changed except the temporary PWA install button
