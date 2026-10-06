import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ModalShell } from '../../components/ModalShell';
import { fetchProductList } from '../../services/products';
import { formatRupiah } from '../../utils/format';
import type { Category } from '../../types/category';
import type { ProductListItem } from '../../types/product';

type Props = {
  category: Category | null;
  onClose: () => void;
};

export default function CategoryProductsModal({ category, onClose }: Props) {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const categoryId = category?.id;

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // ponytail: ambil semua produk lalu saring per kategori, ganti ke query .eq('category_id') kalau katalog membesar
    fetchProductList()
      .then((data) => !cancelled && setProducts(data.filter((p) => p.categoryId === categoryId)))
      .catch((err) => !cancelled && setError(err?.message ?? 'Gagal memuat produk.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  useEffect(() => {
    if (!categoryId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [categoryId, onClose]);

  return (
    <ModalShell open={!!category} onBackdropClick={onClose} panelClassName="max-w-lg" labelledBy="category-products-title">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="category-products-title" className="text-base font-bold leading-6 text-[#0f172a]">
              {category?.name}
            </h2>
            <span className="rounded-md border border-[#cbd5e1] bg-[#f1f5f9] px-2 py-0.5 font-mono text-xs font-bold leading-4 text-[#334155]">
              {category?.productCount} produk terdaftar
            </span>
          </div>
          <p className="text-xs leading-4 text-[#64748b]">Daftar item produk dalam kategori</p>
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-10 text-center text-sm text-[#94a3b8]">Memuat produk...</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600">{error}</p>
        ) : products.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#94a3b8]">Belum ada produk di kategori ini.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead className="border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.75)]">
              <tr>
                <th className="py-3 pl-6 text-left text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Nama Produk
                </th>
                <th className="py-3 pr-6 text-right text-xs font-bold uppercase leading-4 tracking-[0.55px] text-[#64748b]">
                  Harga Jual
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-[#f1f5f9] first:border-t-0">
                  <td className={`py-3 pl-6 text-sm leading-5 ${p.isActive ? 'text-[#0f172a]' : 'text-[#94a3b8]'}`}>
                    <div className="flex items-center gap-2">
                      {p.name}
                      {!p.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#94a3b8] bg-[#f1f5f9] px-2 py-px text-xs font-medium leading-4 text-[#475569]">
                          <span className="size-1.5 rounded-full border border-[#64748b]" />
                          Nonaktif
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`py-3 pr-6 text-right font-mono text-sm leading-5 ${p.isActive ? 'text-[#334155]' : 'text-[#94a3b8]'}`}
                  >
                    {p.sellingPrice ? formatRupiah(p.sellingPrice) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ModalShell>
  );
}
