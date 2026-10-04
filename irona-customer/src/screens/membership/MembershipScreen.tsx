import { useMember } from '@/hooks/useMember';
import GuestView from './GuestView';
import MemberView from './MemberView';

// Dua kondisi: pengunjung umum (ajakan gabung, read-only) & member (kartu poin, kode, reward, riwayat).
// Data dari services/membership.ts (masih dummy), selaras dengan modul Promosi › Point Reward di admin.
export default function MembershipScreen() {
  const { member } = useMember();
  return (
    <>
      <title>Membership | Toko Kopi Irona</title>
      <meta
        name="description"
        content="Kora Club Toko Kopi Irona: kumpulkan poin dari setiap pembelian online maupun di toko, lalu tukar dengan menu gratis."
      />
      {member ? <MemberView member={member} /> : <GuestView />}
    </>
  );
}
