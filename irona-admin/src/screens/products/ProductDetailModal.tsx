import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, Info, Pencil, X } from 'lucide-react';
import { fetchProductDetail, fetchRecipeSources } from '../../services/products';
import { formatPercent, formatQty, formatRupiah } from '../../utils/format';
import type { LowStockItem, ProductDetail, RecipeSource } from '../../types/product';

type Props = {
  productId: string;
  categoryName: string;
  lowStockItems: LowStockItem[];
  onClose: () => void;
  onEdit: () => void;
};

function SectionTitle({ children, aside }: { children: string; aside?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
      <h3 className="text-sm font-bold uppercase tracking-[0.6px] text-[#0f172a]">{children}</h3>
      {aside && <span className="text-xs text-[#64748b]">{aside}</span>}
    </div>
  );
}

function PriceCard({ label, value, note, emphasized }: { label: string; value: string; note?: string; emphasized?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl bg-white p-4 ${
        emphasized ? 'border-2 border-[#0f172a]' : 'border border-[#e2e8f0]'
      }`}
    >
      <span className="text-xs text-[#64748b]">{label}</span>
      <span className="font-mono text-lg font-bold text-[#0f172a]">{value}</span>
      {note && <span className="text-[11px] text-[#94a3b8]">{note}</span>}
    </div>
  );
}

export default function ProductDetailModal({ productId, categoryName, lowStockItems, onClose, onEdit }: Props) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [sources, setSources] = useState<RecipeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProductDetail(productId), fetchRecipeSources()])
      .then(([d, s]) => {
        if (cancelled) return;
        if (!d) setError('Produk tidak ditemukan atau sudah dihapus.');
        setDetail(d);
        setSources(s);
      })
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat detail produk.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.key, s])), [sources]);

  const recipeLines = (detail?.recipe ?? []).map((r) => {
    const source = sourceMap.get(`${r.type}:${r.id}`);
    return {
      key: `${r.type}:${r.id}`,
      name: source?.name ?? '(bahan nonaktif)',
      type: r.type,
      quantity: r.quantity,
      unit: source?.unitName ?? '',
      subtotal: source ? r.quantity * source.unitPrice : 0,
    };
  });

  const subtotal = detail?.liveCost ?? recipeLines.reduce((s, l) => s + l.subtotal, 0);
  const totalCost = detail?.totalCost ?? null;
  const price = detail?.sellingPrice ?? null;
  const desired = detail?.desiredCostPercentage ?? null;
  const recommended = totalCost !== null && desired ? totalCost / (desired / 100) : null;
  const hasMargin = totalCost !== null && price !== null && price > 0;
  const margin = hasMargin ? price! - totalCost! : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#f1f5f9] px-8 py-5">
          <div className="flex items-center gap-3">
            <h2 id="product-detail-title" className="text-xl font-bold tracking-[-0.5px] text-[#0f172a]">
              Detail Produk
            </h2>
            {detail && detail.recipeStatus === 'belum_lengkap' && (
              <span className="rounded border border-dashed border-[#f43f5e] px-2 py-0.5 text-[11px] font-medium text-[#e11d48]">
                Resep Belum Diisi
              </span>
            )}
            {detail && detail.recipeStatus !== 'belum_lengkap' && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  detail.isActive ? 'bg-[#0f172a] text-white' : 'border border-dashed border-[#94a3b8] text-[#475569]'
                }`}
              >
                {detail.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-2 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat detail...</p>
          ) : error || !detail ? (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{error}</p>
          ) : (
            <div className="flex flex-col gap-8">
              {/* Informasi produk */}
              <section className="flex flex-col gap-4">
                <SectionTitle>Informasi Produk</SectionTitle>
                <div className="flex gap-6">
                  <div className="flex size-44 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
                    {detail.photoUrl ? (
                      <img src={detail.photoUrl} alt={detail.name} className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="size-8 text-[#cbd5e1]" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#475569]">
                      <span className="font-bold uppercase tracking-[0.5px] text-[#0f172a]">{categoryName}</span>
                      <span className="font-mono">SKU: {detail.sku ?? '-'}</span>
                      <span>Satuan: {detail.unit}</span>
                    </div>
                    <p className="text-xl font-bold text-[#0f172a]">{detail.name}</p>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.3px] text-[#64748b]">
                        Ketersediaan Saluran
                      </span>
                      <div className="flex gap-2">
                        {detail.availableOffline && (
                          <span className="rounded bg-[#1e293b] px-2 py-0.5 text-xs font-medium text-white">Kasir / POS</span>
                        )}
                        {detail.availableOnline && (
                          <span className="rounded bg-[#1e293b] px-2 py-0.5 text-xs font-medium text-white">
                            Online Order &amp; Delivery
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="rounded-xl border border-[#e2e8f0] p-3 text-sm leading-6 text-[#334155]">
                      {detail.description || <span className="text-[#94a3b8]">Belum ada deskripsi.</span>}
                    </p>
                  </div>
                </div>
              </section>

              {/* Peringatan bahan menipis */}
              {lowStockItems.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[#f43f5e] bg-[#fff1f2] p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#e11d48]">
                    <AlertTriangle className="size-4" />
                    Bahan baku menipis
                  </p>
                  {lowStockItems.map((item) => (
                    <p key={item.itemId} className="text-xs text-[#9f1239]">
                      {item.name}: sisa {formatQty(item.currentStock)} {item.unitName} (batas minimum{' '}
                      {formatQty(item.minStock)} {item.unitName})
                    </p>
                  ))}
                </div>
              )}

              {/* Resep */}
              <section className="flex flex-col gap-4">
                <SectionTitle aside={detail.recipeStatus === 'lengkap' ? `${recipeLines.length} Bahan` : undefined}>
                  Resep &amp; Komposisi
                </SectionTitle>

                {detail.recipeStatus === 'belum_lengkap' && (
                  <p className="flex items-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-sm text-[#475569]">
                    <Info className="size-4" />
                    Resep belum diisi. Lengkapi di Master Resep atau lewat Ubah Data.
                  </p>
                )}

                {detail.recipeStatus === 'tanpa_resep' && (
                  <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <span className="text-sm text-[#475569]">Produk tanpa resep — Total Cost diisi manual</span>
                    <span className="font-mono text-sm font-bold text-[#0f172a]">
                      {totalCost !== null ? formatRupiah(totalCost) : '-'}
                    </span>
                  </div>
                )}

                {detail.recipeStatus === 'lengkap' && (
                  <>
                    <div className="overflow-hidden rounded-xl border border-[#e2e8f0]">
                      <table className="w-full border-collapse text-sm">
                        <thead className="bg-[#f8fafc] text-[11px] font-bold uppercase tracking-[0.5px] text-[#64748b]">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Nama Bahan / Racikan</th>
                            <th className="px-4 py-2.5 text-left">Takaran</th>
                            <th className="px-4 py-2.5 text-right">Subtotal HPP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipeLines.map((line) => (
                            <tr key={line.key} className="border-t border-[#f1f5f9]">
                              <td className="px-4 py-2.5 text-[#0f172a]">
                                {line.name}
                                {line.type === 'racikan' && (
                                  <span className="ml-1.5 text-[11px] text-[#94a3b8]">(racikan)</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-[#475569]">
                                {formatQty(line.quantity)} {line.unit}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs text-[#0f172a]">
                                {formatRupiah(line.subtotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] p-4">
                      <div className="flex items-center gap-6 text-xs">
                        <div>
                          <p className="text-[#64748b]">Subtotal Bahan</p>
                          <p className="font-mono font-bold text-[#0f172a]">{formatRupiah(subtotal)}</p>
                        </div>
                        <span className="text-[#94a3b8]">+</span>
                        <div>
                          <p className="text-[#64748b]">Penyusutan ({formatQty(detail.addCostPercentage)}%)</p>
                          <p className="font-mono font-bold text-[#0f172a]">
                            +{formatRupiah(subtotal * (detail.addCostPercentage / 100))}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-[#475569]">
                        TOTAL COST (HPP):{' '}
                        <span className="font-mono text-lg font-bold text-[#0f172a]">
                          {totalCost !== null ? formatRupiah(totalCost) : '-'}
                        </span>
                      </p>
                    </div>
                  </>
                )}
              </section>

              {/* Harga */}
              {detail.recipeStatus !== 'belum_lengkap' && (
                <section className="flex flex-col gap-4">
                  <SectionTitle aside="Metode Target Costing">Penetapan Harga &amp; Analisis Margin</SectionTitle>
                  <div className="grid grid-cols-4 gap-3">
                    <PriceCard label="Total Cost (HPP)" value={totalCost !== null ? formatRupiah(totalCost) : '-'} />
                    <PriceCard label="Target Desired Cost" value={desired !== null ? `${formatQty(desired)}%` : '-'} />
                    <PriceCard
                      label="Harga Rekomendasi"
                      value={recommended !== null ? formatRupiah(recommended) : '-'}
                    />
                    <PriceCard
                      label="Harga Jual Ditetapkan"
                      value={price !== null ? formatRupiah(price) : '-'}
                      note="Kasir & Delivery"
                      emphasized
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#e2e8f0] p-4">
                    <div className="flex gap-8 text-xs">
                      <div>
                        <p className="font-semibold uppercase tracking-[0.3px] text-[#64748b]">Cost Ratio</p>
                        <p className="font-mono text-base font-bold text-[#0f172a]">
                          {hasMargin ? formatPercent((totalCost! / price!) * 100) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-[0.3px] text-[#64748b]">Margin Jual</p>
                        <p className="font-mono text-base font-bold text-[#0f172a]">
                          {margin !== null ? `${formatRupiah(margin)} / ${detail.unit.split(' (')[0]}` : '-'}
                        </p>
                      </div>
                    </div>
                    {margin !== null && (
                      <span className="rounded-full bg-[#0f172a] px-3 py-1 text-sm font-bold text-white">
                        Margin {formatPercent((margin / price!) * 100)}
                      </span>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-[rgba(226,232,240,0.8)] bg-[rgba(248,250,252,0.8)] px-8 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#cbd5e1] bg-white px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={!detail}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            <Pencil className="size-4" />
            Ubah Data
          </button>
        </div>
      </div>
    </div>
  );
}