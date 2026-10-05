import { supabase } from './supabase';
import { toTs } from './salesReports';
import type {
  CategorySalesReport,
  ProductFilters,
  ProductSalesReport,
} from '../types/productReport';

const num = (v: unknown) => Number(v ?? 0);

export async function fetchProductSales(f: ProductFilters): Promise<ProductSalesReport> {
  const ts = toTs(f.start, f.end);
  const { data, error } = await supabase.rpc('report_product_sales', {
    p_start: ts.start,
    p_end: ts.end,
    p_category_id: f.categoryId ?? null,
    p_channel: f.channel ?? null,
    p_order_type: f.orderType ?? null,
  });
  if (error) throw error;
  const d: any = data ?? {};
  return {
    products: (d.products ?? []).map((r: any) => ({
      productId: r.product_id,
      name: r.name,
      categoryName: r.category_name,
      quantity: num(r.quantity),
      sales: num(r.sales),
      hpp: num(r.hpp),
      grossProfit: num(r.sales) - num(r.hpp),
      missingCost: Boolean(r.missing_cost),
    })),
    series: (d.series ?? []).map((r: any) => ({
      date: r.date,
      productId: r.product_id,
      sales: num(r.sales),
      quantity: num(r.quantity),
    })),
  };
}

export async function fetchCategorySales(
  f: Pick<ProductFilters, 'start' | 'end' | 'channel'>,
  group: 'day' | 'month'
): Promise<CategorySalesReport> {
  const ts = toTs(f.start, f.end);
  const { data, error } = await supabase.rpc('report_category_sales', {
    p_start: ts.start,
    p_end: ts.end,
    p_channel: f.channel ?? null,
    p_group: group,
  });
  if (error) throw error;
  const d: any = data ?? {};
  return {
    categories: (d.categories ?? []).map((r: any) => ({
      categoryId: r.category_id,
      name: r.name,
      productCount: num(r.product_count),
      quantity: num(r.quantity),
      sales: num(r.sales),
      hpp: num(r.hpp),
      missingCost: Boolean(r.missing_cost),
    })),
    series: (d.series ?? []).map((r: any) => ({
      period: r.period,
      categoryId: r.category_id,
      sales: num(r.sales),
      quantity: num(r.quantity),
    })),
  };
}
