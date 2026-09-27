-- ============================================================
-- METODE PEMBAYARAN: TUNAI / QRIS
--
-- - Hanya 2 metode: tunai & qris (pesanan online dibayar QRIS lewat payment gateway).
-- - Tunai: simpan uang diterima & kembalian (tampil di struk).
-- ============================================================

alter table public.transactions
  add constraint transactions_payment_method_check check (payment_method in ('tunai', 'qris')),
  add column cash_received numeric(14,2) check (cash_received >= 0),
  add column change_amount numeric(14,2) check (change_amount >= 0),
  add constraint transactions_cash_only_check check (
    payment_method = 'tunai' or (cash_received is null and change_amount is null)
  );

comment on column public.transactions.cash_received is 'Khusus tunai: uang yang diterima kasir';
comment on column public.transactions.change_amount is 'Khusus tunai: kembalian ke pelanggan';
