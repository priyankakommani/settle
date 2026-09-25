import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, type AppNotification } from '../api/endpoints.js';
import { ApiError } from '../api/client.js';
import { Icon } from './icons.js';
import { cx } from './primitives.js';
import { isToday, relativeTime } from '../lib/format.js';

const TYPE_ICON: Record<string, (p: { size?: number }) => JSX.Element> = {
  approval_pending: Icon.Approvals,
  finance_pending: Icon.Wallet,
  claim_returned: Icon.Alert,
  claim_rejected: Icon.Alert,
  claim_verified: Icon.Check,
  payment_released: Icon.Wallet,
};

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = q.data?.items ?? [];
  const unread = q.data?.unreadCount ?? 0;
  const { today, earlier } = useMemo(() => {
    const t: AppNotification[] = [];
    const e: AppNotification[] = [];
    for (const n of items) (isToday(n.createdAt) ? t : e).push(n);
    return { today: t, earlier: e };
  }, [items]);

  const openItem = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="notif" ref={rootRef}>
      <button
        className="notif__trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon.Bell size={18} />
        {unread > 0 ? <span className="notif__badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="notif__pop" role="menu">
          <div className="notif__head">
            <span className="notif__head-title">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                className="notif__markall"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="notif__scroll">
            {q.isLoading ? (
              <div className="notif__empty">Loading…</div>
            ) : q.error ? (
              <div className="notif__empty">
                {q.error instanceof ApiError ? q.error.message : "Couldn't load notifications."}
              </div>
            ) : items.length === 0 ? (
              <div className="notif__empty">You&rsquo;re all caught up.</div>
            ) : (
              <>
                {today.length > 0 ? (
                  <Group label="Today" items={today} onOpen={openItem} />
                ) : null}
                {earlier.length > 0 ? (
                  <Group label="Earlier" items={earlier} onOpen={openItem} />
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Group({
  label,
  items,
  onOpen,
}: {
  label: string;
  items: AppNotification[];
  onOpen: (n: AppNotification) => void;
}) {
  return (
    <div className="notif__group">
      <div className="notif__group-label">{label}</div>
      {items.map((n) => {
        const IconEl = TYPE_ICON[n.type] ?? Icon.Bell;
        return (
          <button
            key={n.id}
            type="button"
            role="menuitem"
            className={cx('notif__item', !n.read && 'notif__item--unread')}
            onClick={() => onOpen(n)}
          >
            <span className="notif__item-icon">
              <IconEl size={16} />
            </span>
            <span className="notif__item-body">
              <span className="notif__item-title">{n.title}</span>
              {n.body ? <span className="notif__item-text">{n.body}</span> : null}
              <span className="notif__item-time">{relativeTime(n.createdAt)}</span>
            </span>
            {!n.read ? <span className="notif__dot" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
