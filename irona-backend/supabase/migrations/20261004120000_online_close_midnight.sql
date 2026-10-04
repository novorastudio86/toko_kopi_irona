-- Jam Layanan Online tutup jam 24:00 (tengah malam), bukan 23:00.
-- Postgres menerima '24:00'::time, jadi check close_time > open_time dan is_store_open() tetap jalan.
-- Di Web Admin, 24:00 tampil sebagai 00:00 (input type="time" tidak bisa menampilkan 24:00).
update public.store_hours
set close_time = '24:00'
where channel = 'online' and is_open;
