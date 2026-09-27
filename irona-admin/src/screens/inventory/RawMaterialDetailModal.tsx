import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Pencil, X } from 'lucide-react';
import { fetchUnits } from '../../services/recipes';
import { fetchRawMaterialDetail, fetchRawMaterialUsage } from '../../services/rawMaterials';
import { formatQty, formatRupiahDetail } from '../../utils/format';
import type { RawMaterialDetail, RawMaterialUsage } from '../../types/rawMaterial';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase leading-4 tracking-[0.55px] text-[#94a3b8]">{label}</span>
      <div className="text-xs font-semibold leading-4 text-[#334155]">{children}</div>
    </div>
  );
}

type Props = {
  materialId: string;
  onClose: () => void;
  onEdit: () => void;
};

export default function RawMaterialDetailModal({ materialId, onClose, onEdit }: Props) {
  const [detail, setDetail] = useState<RawMaterialDetail | null>(null);
  const [usage, setUsage] = useState<RawMaterialUsage[]>([]);
  const [unitNames, setUnitNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRawMaterialDetail(materialId), fetchRawMaterialUsage(materialId), fetchUnits()])
      .then(([d, u, units]) => {
        if (cancelled) return;
        if (!d) setError('Bahan baku tidak ditemukan.');
        setDetail(d);
        setUsage(u);
        setUnitNames(new Map(units.map((unit) => [unit.id, unit.name])));
      })
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat detail bahan baku.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const baseUnit = detail ? (unitNames.get(detail.baseUnitId) ?? '') : '';
  const purchaseUnit = detail?.defaultPurchaseUnitId ? (unitNames.get(detail.defaultPurchaseUnitId) ?? '') : null;
  const isLow = !!detail && detail.minStockAlert > 0 && detail.currentStock <= detail.minStockAlert;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white font-['Plus_Jakarta_Sans_Variable',sans-serif] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.5)] px-6 pb-[17px] pt-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold leading-6 tracking-[-0.4px] text-[#0f172a]">Detail Bahan Baku</h2>
            <span className="rounded bg-[rgba(226,232,240,0.7)] px-2 py-0.5 font-mono text-xs leading-4 text-[#334155]">
              ID: {materialId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-md p-1 text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-[#94a3b8]">Memuat detail...</p>
          ) : error || !detail ? (
            <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-xs text-[#e11d48]">{error}</p>
          ) : (
            <>
              {/* Data bahan */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-[#e2e8f0] p-5">
                <Field label="Nama Bahan">
                  <span className="text-sm font-bold text-[#0f172a]">{detail.name}</span>
                </Field>

                <Field label="Jenis Bahan">
                  {detail.materialType === 'menyusut' ? (
                    <span className="inline-block rounded bg-[#0f172a] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.55px] text-white">
                      Menyusut
                    </span>
                  ) : (
                    <span className="inline-block rounded border border-[#94a3b8] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.55px] text-[#1e293b]">
                      Tetap
                    </span>
                  )}
                </Field>

                <Field label="Satuan Dasar">{baseUnit || '—'}</Field>

                <Field label="Satuan Pembelian Default">
                  {purchaseUnit
                    ? `${purchaseUnit}${
                        detail.defaultQtyPerPackage
                          ? ` (${formatQty(detail.defaultQtyPerPackage)} ${baseUnit})`
                          : ''
                      }`
                    : '—'}
                </Field>

                <Field label="Isi per Kemasan Default">
                  {detail.defaultQtyPerPackage ? `${formatQty(detail.defaultQtyPerPackage)} ${baseUnit}` : '—'}
                </Field>

                <Field label="Harga per Satuan (HPP)">
                  {detail.unitPrice !== null ? `${formatRupiahDetail(detail.unitPrice)} / ${baseUnit}` : '—'}
                </Field>

                <Field label="Stok Saat Ini">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-bold ${isLow ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>
                      {formatQty(detail.currentStock)} {baseUnit}
                    </span>
                    {isLow && (
                      <span className="inline-flex items-center gap-1 rounded border border-[rgba(212,212,216,0.6)] bg-[rgba(226,232,240,0.8)] px-2 py-0.5 text-[10px] font-semibold leading-4 text-[#334155]">
                        <AlertTriangle className="size-3" />
                        Di bawah batas min
                      </span>
                    )}
                  </div>
                </Field>

                <Field label="Alert Stok Minimum">
                  {detail.minStockAlert > 0 ? `${formatQty(detail.minStockAlert)} ${baseUnit}` : '—'}
                </Field>

                <Field label="Status">
                  <span
                    className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold tracking-[0.3px] ${
                      detail.isActive
                        ? 'bg-[#0f172a] text-white'
                        : 'border border-dashed border-[#94a3b8] text-[#475569]'
                    }`}
                  >
                    {detail.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </Field>
              </div>

              {/* Pemakai bahan */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.6px] text-[#334155]">
                    Daftar Produk &amp; Racikan Pemakai
                  </h3>
                  <span className="rounded border border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-medium text-[#64748b]">
                    {usage.length} item terhubung
                  </span>
                </div>

                {usage.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-center text-xs text-[#64748b]">
                    Belum ada produk atau racikan yang memakai bahan ini.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[#e2e8f0] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                    <table className="w-full border-collapse">
                      <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
                        <tr className="text-[11px] font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                          <th className="px-4 py-2.5 text-left">Nama Produk / Racikan</th>
                          <th className="px-4 py-2.5 text-right">Kategori</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.map((item, idx) => (
                          <tr
                            key={`${item.usageType}-${item.itemId}-${item.viaName ?? ''}-${idx}`}
                            className="border-t border-[rgba(226,232,240,0.8)] first:border-t-0"
                          >
                            <td className="px-4 py-2.5">
                              <p className="text-xs font-bold leading-4 text-[#0f172a]">{item.itemName}</p>
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="text-[11px] font-semibold leading-4 text-[#334155]">
                                  {formatQty(item.quantity)} {item.unitName}
                                  {item.usageType === 'produk' ? ' / porsi' : ''}
                                </span>
                                {item.viaName && (
                                  <span className="rounded border border-[rgba(226,232,240,0.8)] bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] leading-4 text-[#475569]">
                                    via {item.viaName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {item.usageType === 'racikan' ? (
                                <span className="inline-block rounded bg-[#0f172a] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.275px] text-white">
                                  Racikan
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-[#475569]">{item.categoryName}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 pb-4 pt-[17px]">
          <button
            onClick={onClose}
            className="rounded border border-[#cbd5e1] bg-white px-5 py-2 text-xs font-semibold text-[#334155] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#f8fafc]"
          >
            Tutup
          </button>
          <button
            onClick={onEdit}
            disabled={!detail}
            className="flex items-center gap-2 rounded bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e293b] disabled:opacity-60"
          >
            <Pencil className="size-3.5" />
            Ubah Data
          </button>
        </div>
      </div>
    </div>
  );
}