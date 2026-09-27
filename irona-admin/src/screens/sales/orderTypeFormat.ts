import type { RuleScope } from '../../types/orderType';

export const SCOPE_LABELS: Record<RuleScope, string> = {
  take_away: 'Take Away',
  online: 'Online',
  keduanya: 'Keduanya',
};

/** 1.000 → "1", 0.5 → "0,5" */
export function formatQty(value: number): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}
