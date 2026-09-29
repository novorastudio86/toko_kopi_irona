// TODO: Sambungkan ke backend setelah ada perintah; tampilkan status netral selama data jam buka
// belum dimuat agar tidak muncul 'tutup' sesaat.
const MENU_STATUS = {
  isOpen: true,
  openText: 'Buka pukul 10.00–21.00',
  closedText: 'Buka lagi hari ini pukul 10.00–21.00',
  /** Jam buka berikutnya untuk pesan saat pengunjung mencoba order ketika tutup */
  reopenTime: '10.00',
};

export interface MenuStatus {
  isOpen: boolean;
  title: string;
  subtitle: string;
  /** Pesan toast saat "+ Tambah" diklik ketika tutup */
  closedNotice: string;
}

/** Dev saja: ?store=open / ?store=closed menimpa isOpen untuk menguji dua kondisi */
function devOverride(): boolean | null {
  if (!import.meta.env.DEV) return null;
  const store = new URLSearchParams(window.location.search).get('store');
  return store === 'open' ? true : store === 'closed' ? false : null;
}

export function useMenuStatus(): MenuStatus {
  const isOpen = devOverride() ?? MENU_STATUS.isOpen;
  return {
    isOpen,
    title: isOpen ? 'Mau Ngopi Apa Hari Ini?' : 'Kora Lagi Istirahat',
    subtitle: isOpen ? MENU_STATUS.openText : MENU_STATUS.closedText,
    closedNotice: `Kora lagi istirahat. Pesanan bisa dibuat lagi hari ini pukul ${MENU_STATUS.reopenTime}.`,
  };
}
