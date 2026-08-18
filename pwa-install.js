let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // ป้องกันไม่ให้ Chrome แสดงแถบติดตั้งอัตโนมัติแบบเดิม
  e.preventDefault();
  // เก็บบันทึกอีเวนต์ไว้เรียกใช้งานผ่านปุ่ม Custom
  deferredPrompt = e;
  
  // ค้นหาปุ่มติดตั้งในหน้าเว็บ (เช่น มี id="pwa-install-btn") แล้วแสดงผล
  const installButton = document.getElementById('pwa-install-btn');
  if (installButton) {
    installButton.style.display = 'block';
    
    installButton.addEventListener('click', async () => {
      installButton.style.display = 'none';
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('ผู้ใช้ยอมรับการติดตั้ง PWA');
      } else {
        console.log('ผู้ใช้ปฏิเสธการติดตั้ง PWA');
      }
      deferredPrompt = null;
    });
  }
});

// ตรวจสอบกรณีติดตั้งเรียบร้อยแล้ว
window.addEventListener('appinstalled', () => {
  console.log('ติดตั้ง PWA สำเร็จเรียบร้อย');
  deferredPrompt = null;
});
