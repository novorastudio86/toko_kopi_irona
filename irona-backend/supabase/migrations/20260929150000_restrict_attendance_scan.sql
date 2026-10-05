-- ============================================================
-- SCAN ABSENSI HANYA DARI PERANGKAT YANG DIBUKA OWNER
--
-- Sebelumnya record_attendance_scan bisa dipanggil tanpa login (halaman uji /absensi di Web
-- Admin). Scanner sekarang ada di Kasir App, dan perangkat Kasir login sebagai Owner, jadi
-- pemanggilnya wajib Admin/Owner. Halaman /absensi di Web Admin tetap jalan karena berada di
-- balik login Admin.
--
-- Logika scan (hitung telat/lembur/shift) tidak diubah: fungsi lama diganti nama menjadi
-- record_attendance_scan_unchecked dan hanya bisa dipanggil lewat pembungkus di bawah.
-- Kalau nanti logika scan diubah, ubah record_attendance_scan_unchecked.
-- ============================================================

alter function public.record_attendance_scan(uuid) rename to record_attendance_scan_unchecked;
revoke execute on function public.record_attendance_scan_unchecked(uuid) from public, anon, authenticated;

create or replace function public.record_attendance_scan(p_qr_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Perangkat belum login sebagai Owner.' using errcode = '42501';
  end if;
  return record_attendance_scan_unchecked(p_qr_token);
end;
$$;

revoke execute on function public.record_attendance_scan(uuid) from public, anon;
grant execute on function public.record_attendance_scan(uuid) to authenticated;
