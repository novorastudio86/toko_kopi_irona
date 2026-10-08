-- ============================================================
-- MEMBER DAFTAR ONLINE (Web Customer) DENGAN VERIFIKASI EMAIL (OTP 6 angka)
--
-- Alur: Web Customer → supabase.auth.signUp(email, password, data: { account_type: 'member',
--   name, phone }) → Supabase kirim kode ke email → verifyOtp → email terkonfirmasi →
--   trigger di bawah membuat / menyambungkan baris customers.
-- - Kalau No HP (dinormalkan: 08…, 628…, +628… dianggap sama) sudah dipakai member yang
--   didaftarkan kasir & belum punya akun online → akun online DISAMBUNGKAN ke data lama
--   (poin & riwayat tetap). Kalau sudah dipakai akun online lain → ditolak.
-- - Hanya user dengan metadata account_type = 'member'. Akun karyawan (create-employee) tidak
--   tersentuh.
-- ============================================================

alter table public.customers add column email text;
create unique index customers_email_key on public.customers (lower(email)) where email is not null;
comment on column public.customers.email is 'Email akun member online (terverifikasi OTP). Kosong untuk member kasir.';

-- No HP → digit tanpa awalan 0 / 62 (sama seperti find_member_by_phone)
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select regexp_replace(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '^(62|0)', '');
$$;

-- Cek sebelum daftar (dipanggil Web Customer tanpa login):
--   'new'   = No HP belum terdaftar
--   'link'  = No HP milik member kasir yang belum punya akun online → akan disambungkan
--   'taken' = No HP sudah dipakai akun online lain
create or replace function public.member_signup_check(p_phone text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_digits text := normalize_phone(p_phone);
  v_linked boolean;
begin
  if length(v_digits) < 8 then
    raise exception 'Nomor HP tidak valid.';
  end if;
  select auth_user_id is not null into v_linked
  from customers where normalize_phone(phone_number) = v_digits
  limit 1;
  if v_linked is null then return 'new'; end if;
  return case when v_linked then 'taken' else 'link' end;
end;
$$;

revoke all on function public.member_signup_check(text) from public;
grant execute on function public.member_signup_check(text) to anon, authenticated;

-- Email terkonfirmasi → buat / sambungkan data member
create or replace function public.handle_member_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  v_phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  v_existing customers%rowtype;
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') <> 'member'
     or new.email_confirmed_at is null
     or (tg_op = 'UPDATE' and old.email_confirmed_at is not null) then
    return new;
  end if;

  -- Sudah tersambung (mis. konfirmasi ulang): cukup perbarui email
  if exists (select 1 from customers where auth_user_id = new.id) then
    update customers set email = new.email where auth_user_id = new.id;
    return new;
  end if;

  select * into v_existing from customers
  where normalize_phone(phone_number) = normalize_phone(v_phone)
  limit 1;

  if v_existing.id is not null then
    if v_existing.auth_user_id is not null then
      raise exception 'Nomor HP sudah dipakai akun member lain.';
    end if;
    -- Member kasir → sambungkan; nama & No HP lama dipertahankan
    update customers set auth_user_id = new.id, email = new.email where id = v_existing.id;
  else
    insert into customers (name, phone_number, email, auth_user_id)
    values (coalesce(v_name, split_part(new.email, '@', 1)), v_phone, new.email, new.id);
  end if;
  return new;
end;
$$;

create trigger on_member_email_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_member_confirmed();

-- Member mengubah profil sendiri (nama & No HP; email tidak bisa diubah)
create or replace function public.update_my_member_profile(p_name text, p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := current_customer_id();
begin
  if v_id is null then
    raise exception 'Akun member tidak ditemukan.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nama wajib diisi.'; end if;
  if length(normalize_phone(p_phone)) < 8 then raise exception 'Nomor HP tidak valid.'; end if;
  if exists (select 1 from customers
             where normalize_phone(phone_number) = normalize_phone(p_phone) and id <> v_id) then
    raise exception 'Nomor HP sudah dipakai member lain.';
  end if;
  update customers set name = trim(p_name), phone_number = trim(p_phone) where id = v_id;
end;
$$;

revoke all on function public.update_my_member_profile(text, text) from public, anon;
grant execute on function public.update_my_member_profile(text, text) to authenticated;

-- Web Admin › Pelanggan: tampilkan email akun online
create or replace view public.customer_overview
with (security_invoker = true)
as
SELECT c.id,
    c.name,
    c.phone_number,
    c.points_balance,
    c.is_active,
    c.registered_at,
    (c.auth_user_id IS NOT NULL) AS has_account,
    COALESCE(agg.total_transactions, (0)::bigint) AS total_transactions,
    (COALESCE(agg.gross_spent, (0)::numeric) - COALESCE(ref.refunded, (0)::numeric)) AS total_spent,
    agg.last_transaction_at,
    COALESCE(agg.all_transactions, (0)::bigint) AS all_transactions,
    c.email
   FROM ((customers c
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE (t.status = ANY (ARRAY['selesai'::text, 'refund_sebagian'::text]))) AS total_transactions,
            sum((t.subtotal - t.discount_amount)) FILTER (WHERE (t.status = ANY (ARRAY['selesai'::text, 'refund_sebagian'::text]))) AS gross_spent,
            max(t.transaction_date) FILTER (WHERE (t.status <> 'dibatalkan'::text)) AS last_transaction_at,
            count(*) AS all_transactions
           FROM transactions t
          WHERE (t.customer_id = c.id)) agg ON (true))
     LEFT JOIN LATERAL ( SELECT sum(r.refund_amount) AS refunded
           FROM (refunds r
             JOIN transactions t ON ((t.id = r.transaction_id)))
          WHERE ((t.customer_id = c.id) AND (t.status = 'refund_sebagian'::text))) ref ON (true));

-- Web Customer: reward & aturan poin juga tampil untuk pengunjung yang belum login (anon)
create or replace function public.online_member_rewards()
returns table (id uuid, name text, product_name text, points_required integer, available_stock integer, photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name, p.name, r.points_required, r.available_stock, p.photo_url
  from reward_overview r
  join products p on p.id = r.product_id
  where r.is_active
  order by r.points_required, r.name;
$$;

create or replace function public.online_point_tiers()
returns table (min_amount numeric, points integer)
language sql
stable
security definer
set search_path = public
as $$
  select min_amount, points from point_earning_tiers order by min_amount;
$$;

revoke execute on function public.online_member_rewards() from public;
revoke execute on function public.online_point_tiers() from public;
grant execute on function public.online_member_rewards() to anon, authenticated;
grant execute on function public.online_point_tiers() to anon, authenticated;
