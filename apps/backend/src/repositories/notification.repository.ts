import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications, type NewNotification, type Notification } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

/** Data access for `notifications`. */
export const notificationRepository = {
  async createMany(rows: NewNotification[]): Promise<Notification[]> {
    if (rows.length === 0) return [];
    try {
      return await db.insert(notifications).values(rows).returning();
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listForRecipient(
    recipientCode: string,
    opts: { limit?: number; sinceDays?: number } = {},
  ): Promise<Notification[]> {
    const limit = opts.limit ?? 50;
    const sinceDays = opts.sinceDays ?? 21;
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    try {
      return await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientCode, recipientCode),
            gte(notifications.createdAt, since),
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async unreadCount(recipientCode: string): Promise<number> {
    try {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(eq(notifications.recipientCode, recipientCode), isNull(notifications.readAt)),
        );
      return row?.n ?? 0;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async markRead(recipientCode: string, id: string): Promise<Notification | null> {
    try {
      const [row] = await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.recipientCode, recipientCode),
            isNull(notifications.readAt),
          ),
        )
        .returning();
      return row ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async markAllRead(recipientCode: string): Promise<number> {
    try {
      const rows = await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(eq(notifications.recipientCode, recipientCode), isNull(notifications.readAt)),
        )
        .returning({ id: notifications.id });
      return rows.length;
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type NotificationRepository = typeof notificationRepository;
