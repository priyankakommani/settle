import type { Context } from 'hono';
import { ok } from '../lib/response.js';
import { valid } from '../middleware/validate.js';
import { uuidParam } from '../validators/common.validators.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import type { Notification } from '../db/schema/index.js';

function toDto(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    tripId: n.tripId,
    read: n.readAt !== null,
    createdAt: n.createdAt,
  };
}

export const notificationsController = {
  async list(c: Context) {
    const user = c.get('currentUser');
    const [items, unreadCount] = await Promise.all([
      notificationRepository.listForRecipient(user.empCode, { limit: 50 }),
      notificationRepository.unreadCount(user.empCode),
    ]);
    return ok(c, { items: items.map(toDto), unreadCount });
  },

  async markRead(c: Context) {
    const user = c.get('currentUser');
    const { id } = valid(c, 'param', uuidParam);
    await notificationRepository.markRead(user.empCode, id);
    return ok(c, { ok: true });
  },

  async markAllRead(c: Context) {
    const user = c.get('currentUser');
    const marked = await notificationRepository.markAllRead(user.empCode);
    return ok(c, { marked });
  },
};
