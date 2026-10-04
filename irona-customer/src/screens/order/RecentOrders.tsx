import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchOnlineOrder } from '@/services/onlineOrder';
import type { OnlineOrder } from '@/types/onlineOrder';
import { formatRupiah } from '@/utils/format';
import { isActive, RECENT_ORDER_HOURS, STATUS_LABEL, type RecentOrder } from './orderLogic';

const focusClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';

/** Pesanan yang dibuat dari browser ini dalam 24 jam terakhir, untuk pantau status */
export default function RecentOrders({ recent }: { recent: RecentOrder[] }) {
  const [orders, setOrders] = useState<OnlineOrder[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // TODO(backend): satu query by ids, bukan satu request per pesanan
    Promise.all(recent.map((o) => fetchOnlineOrder(o.id).catch(() => null))).then(
      (list) => !cancelled && setOrders(list.filter((o): o is OnlineOrder => o !== null))
    );
    return () => {
      cancelled = true;
    };
  }, [recent]);

  if (orders?.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-title"
      className="rounded-[4px] border border-foreground bg-card"
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h2 id="recent-title" className="text-sm font-semibold">
          Pesanan barusan
        </h2>
        <p className="text-[11px] text-muted-foreground">Tersimpan {RECENT_ORDER_HOURS} jam</p>
      </div>
      {!orders ? (
        <div className="m-4 h-14 animate-pulse rounded-[4px] bg-muted" />
      ) : (
        <ul className="divide-y divide-border px-4 pb-1">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/pesanan/${o.id}`}
                className={cn('flex items-center gap-3 py-3 hover:opacity-75', focusClass)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {o.code}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {new Date(o.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                  </p>
                </div>
                <div className="grid shrink-0 justify-items-end gap-1">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                      o.status === 'menunggu_pembayaran'
                        ? 'bg-primary text-primary-foreground'
                        : isActive(o.status)
                          ? 'border border-foreground'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {formatRupiah(o.total)}
                  </span>
                </div>
                <ChevronRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
