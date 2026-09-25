import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { employees } from './employees.js';
import { trips } from './trips.js';

/**
 * Per-recipient inbox items raised on workflow transitions (claim submitted,
 * approval decided, finance verified/returned/paid). `link` is the in-app path
 * the frontend navigates to when the item is opened. `readAt` null = unread.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientCode: text('recipient_code')
      .notNull()
      .references(() => employees.empCode, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'cascade' }),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    recipientIdx: index('notifications_recipient_idx').on(t.recipientCode, t.createdAt),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(employees, {
    fields: [notifications.recipientCode],
    references: [employees.empCode],
  }),
  trip: one(trips, { fields: [notifications.tripId], references: [trips.id] }),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
