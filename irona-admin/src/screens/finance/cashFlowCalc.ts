import type { CashFlowEntry, FinanceSettings, HppMonth, NetProfitMonth } from '../../types/finance';

const sumOf = (entries: CashFlowEntry[], types: string[]) =>
  entries.filter((e) => types.includes(e.entryType)).reduce((sum, e) => sum + e.amount, 0);

/**
 * Panel HPP: batas belanja (80%) & porsi Saldo Mengendap (20%) dari alokasi HPP pada entri yang diberikan.
 * Dipakai Keuangan › Cash Flow dan Laporan Cash Flow supaya angkanya selalu sama.
 */
export function computeHppPanel(
  hppEntries: CashFlowEntry[],
  settings: FinanceSettings,
  periodEnd: string,
  today: string
): HppMonth {
  const allocation = sumOf(hppEntries, ['alokasi', 'reversal_refund']);
  const spent = -sumOf(hppEntries, ['bahan_baku']);
  const budget = Math.round((allocation * settings.hppBudgetPct) / 100);
  return {
    month: periodEnd,
    allocation,
    budget,
    spent,
    remaining: budget - spent,
    reserveShare: allocation - budget,
    movedToReserve: 0,
    reserveTotal: 0,
    isClosed: periodEnd.slice(0, 7) < today.slice(0, 7),
  };
}

/** Panel Net Profit: BEP / Owner / Manager dari net profit & pembelian aset pada entri yang diberikan */
export function computeProfitPanel(
  netProfitEntries: CashFlowEntry[],
  settings: FinanceSettings,
  periodEnd: string
): NetProfitMonth {
  const netProfit = sumOf(netProfitEntries, ['alokasi', 'reversal_refund']);
  const assetSpent = -sumOf(netProfitEntries, ['pembelian_aset']);
  const bepShare = Math.round((netProfit * settings.bepPct) / 100);
  const managerShare = Math.round((netProfit * settings.managerPct) / 100);
  const ownerShare = netProfit - bepShare - managerShare;
  return {
    month: periodEnd,
    netProfit,
    bepShare,
    ownerShare,
    managerShare,
    assetSpent,
    bepBalance: bepShare - assetSpent,
    ownerBalance: ownerShare + bepShare - assetSpent,
    managerBalance: managerShare,
  };
}
