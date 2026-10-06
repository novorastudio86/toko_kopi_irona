import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  History,
  Pencil,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { fetchProductOptions } from '../../services/promotions';
import { deleteOrderTypeRule, fetchOrderTypeRules } from '../../services/orderTypes';
import { formatRupiah } from '../../utils/format';
import type { ProductOption } from '../../types/promotion';
import type { OrderTypeRule, RuleScope } from '../../types/orderType';
import OrderTypeHistoryModal from './OrderTypeHistoryModal';
import OrderTypeRuleFormModal from './OrderTypeRuleFormModal';
import ProductPriceModal from './ProductPriceModal';
import { SCOPE_LABELS, formatQty } from './orderTypeFormat';
import icPlus from '../../assets/ui/plus.svg';

function RulesTable({
  rules,
  onEdit,
  onDelete,
}: {
  rules: OrderTypeRule[];
  onEdit: (r: OrderTypeRule) => void;
  onDelete: (r: OrderTypeRule) => void;
}) {
  const th = 'py-2.5 text-left text-xs font-bold uppercase tracking-[0.4px] text-[#64748b]';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="border-y border-[#e2e8f0] bg-[#f8fafc]">
          <tr>
            <th className={`${th} pl-5`}>Cakupan Produk</th>
            <th className={th}>Bahan Tambahan</th>
            <th className={th}>Scope</th>
            <th className={`${th} text-right`}>Total Biaya</th>
            <th className={`${th} pr-5 text-right`}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-sm text-[#94a3b8]">
                Belum ada aturan.
              </td>
            </tr>
          )}
          {rules.map((r) => (
            <tr key={r.id} className="border-t border-[#f1f5f9] align-top first:border-t-0">
              <td className="max-w-[220px] py-3 pl-5 pr-3">
                <div className="flex flex-wrap gap-1">
                  {r.appliesToAllProducts ? (
                    <span className="rounded-md bg-[#0f172a] px-2 py-0.5 text-xs font-bold text-white">
                      Semua Produk
                    </span>
                  ) : (
                    r.productNames.map((n) => (
                      <span
                        key={n}
                        className="rounded-md bg-[#334155] px-2 py-0.5 text-xs font-semibold text-white"
                      >
                        {n}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="py-3 pr-3">
                <div className="flex flex-wrap gap-1">
                  {r.items.map((i) => (
                    <span
                      key={i.rawMaterialId}
                      className="rounded-md border border-[#cbd5e1] bg-white px-2 py-0.5 text-xs font-semibold text-[#334155]"
                    >
                      {i.rawMaterialName} ({formatQty(i.quantity)} {i.unitName})
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-3 pr-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    r.scope === 'keduanya'
                      ? 'bg-[#f5f3ff] text-[#6d28d9]'
                      : r.scope === 'online'
                        ? 'bg-[#eff6ff] text-[#1d4ed8]'
                        : 'bg-[#fef3c7] text-[#92400e]'
                  }`}
                >
                  {SCOPE_LABELS[r.scope]}
                </span>
              </td>
              <td className="py-3 pr-3 text-right font-mono text-sm font-bold text-[#0f172a]">
                {formatRupiah(r.totalCost)}
              </td>
              <td className="py-3 pr-5">
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => onEdit(r)}
                    aria-label="Ubah aturan"
                    className="rounded-lg border border-[#e2e8f0] p-[6px] text-[#475569] hover:bg-[#f8fafc]"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(r)}
                    aria-label="Hapus aturan"
                    className="rounded-lg border border-[#e2e8f0] p-[6px] text-[#475569] hover:border-[#fecdd3] hover:text-[#e11d48]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  subtitle,
  onAdd,
  children,
}: {
  icon: typeof Globe;
  title: string;
  subtitle: string;
  onAdd?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#334155]">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-[#0f172a]">{title}</p>
            <p className="text-xs text-[#64748b]">{subtitle}</p>
          </div>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e293b]"
          >
            <img src={icPlus} alt="" className="size-3.5" />
            Tambah Aturan
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export default function OrderTypeScreen() {
  const [rules, setRules] = useState<OrderTypeRule[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [menuSearch, setMenuSearch] = useState('');
  const [priceFor, setPriceFor] = useState<string | null>(null);
  const [formState, setFormState] = useState<{
    rule: OrderTypeRule | null;
    scope: RuleScope;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p] = await Promise.all([fetchOrderTypeRules(), fetchProductOptions()]);
      setRules(r);
      setProducts(p);
    } catch (err: any) {
      setError(err?.message ?? 'Gagal memuat tipe order.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  // 1 sumber data aturan, difilter per kartu berdasarkan scope
  const takeAwayRules = rules.filter((r) => r.scope === 'take_away' || r.scope === 'keduanya');
  const onlineRules = rules.filter((r) => r.scope === 'online' || r.scope === 'keduanya');

  const menuResults = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8) : [];
  }, [products, menuSearch]);

  async function handleDelete(r: OrderTypeRule) {
    if (!window.confirm(`Hapus aturan ${SCOPE_LABELS[r.scope]} (${formatRupiah(r.totalCost)})?`))
      return;
    setError(null);
    try {
      await deleteOrderTypeRule(r.id);
      setFlash('Aturan berhasil dihapus.');
      loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Gagal menghapus aturan.');
    }
  }

  return (
    <div className="flex max-w-[1400px] flex-col gap-6 p-6 xl:p-8">
      <PageHeader
        title="Tipe Order"
        info="Atur bahan tambahan (cup, kresek, dll) yang ikut terpakai & ditagihkan untuk Take Away dan Online. Biaya dari beberapa aturan yang kena 1 produk dijumlahkan."
        action={
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            <History className="size-3.5" />
            Riwayat Perubahan
          </button>
        }
      />

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-xs font-medium text-[#0f172a]">
          <CheckCircle2 className="size-4 text-[#059669]" />
          {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Tutup">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Cari Menu → Rincian Harga per Tipe */}
      <div className="relative rounded-2xl border border-[#e2e8f0] bg-white p-[17px] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
        <div className="relative w-96">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Cari menu untuk lihat rincian harga per tipe..."
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 pl-[41px] pr-[17px] text-xs text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8]"
          />
        </div>
        {menuResults.length > 0 && (
          <div className="absolute left-[17px] top-[62px] z-20 w-96 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-lg">
            {menuResults.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPriceFor(p.id);
                  setMenuSearch('');
                }}
                className="flex w-full items-center justify-between gap-3 border-t border-[#f1f5f9] px-4 py-2.5 text-left text-xs first:border-t-0 hover:bg-[#f8fafc]"
              >
                <span className="font-semibold text-[#0f172a]">{p.name}</span>
                <span className="font-mono text-[#64748b]">
                  {p.sellingPrice > 0 ? formatRupiah(p.sellingPrice) : '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat tipe order...</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Card
            icon={UtensilsCrossed}
            title="Dine In"
            subtitle="Tidak ada biaya tambahan atau bahan yang terpakai untuk tipe ini."
          />

          <Card
            icon={ShoppingBag}
            title="Take Away"
            subtitle={`${takeAwayRules.length} aturan berlaku (scope Take Away + Keduanya)`}
            onAdd={() => setFormState({ rule: null, scope: 'take_away' })}
          >
            <RulesTable
              rules={takeAwayRules}
              onEdit={(r) => setFormState({ rule: r, scope: r.scope })}
              onDelete={handleDelete}
            />
          </Card>

          <Card
            icon={Globe}
            title="Online"
            subtitle={`${onlineRules.length} aturan berlaku (scope Online + Keduanya)`}
            onAdd={() => setFormState({ rule: null, scope: 'online' })}
          >
            <p className="border-t border-[#e2e8f0] bg-[#fcfcfd] px-5 py-2 text-xs text-[#94a3b8]">
              Menampilkan aturan berscope Online atau Keduanya — aturan khusus Take Away tidak ikut
              tampil di sini.
            </p>
            <RulesTable
              rules={onlineRules}
              onEdit={(r) => setFormState({ rule: r, scope: r.scope })}
              onDelete={handleDelete}
            />
          </Card>
        </div>
      )}

      {formState && (
        <OrderTypeRuleFormModal
          rule={formState.rule}
          defaultScope={formState.scope}
          onClose={() => setFormState(null)}
          onSaved={(mode) => {
            setFormState(null);
            setFlash(`Aturan berhasil ${mode === 'edit' ? 'diperbarui' : 'ditambahkan'}.`);
            loadData();
          }}
        />
      )}

      {priceFor && (
        <ProductPriceModal productId={priceFor} rules={rules} onClose={() => setPriceFor(null)} />
      )}
      {historyOpen && <OrderTypeHistoryModal onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
