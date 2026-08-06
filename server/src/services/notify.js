const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const { TYPES } = Notification;

/**
 * Write a notification.
 *
 * Two rules govern this whole file.
 *
 * It never throws. A notification is a side effect of something the user
 * actually asked for — accepting a teammate, posting a comment — and that
 * request must not fail because the telling-someone part did. Callers are
 * expected to `void notify(...)` and carry on; failures are logged, not
 * surfaced.
 *
 * It never notifies you about your own action. Being told you replied to your
 * own thread is noise, and it is the single most common way a notifications
 * feature becomes something people mute entirely.
 */
async function notify({ recipient, actor = null, type, title, body = '', link = '', dedupeKey = null }) {
  try {
    if (!recipient) return null;

    const category = TYPES[type];
    if (!category) {
      console.warn(`[notify] unknown notification type "${type}" — dropped`);
      return null;
    }

    if (actor && String(actor) === String(recipient)) return null;

    const preference = await NotificationPreference.findOne({ user: recipient }).lean();
    if (preference?.muted?.includes(category)) return null;

    if (dedupeKey) {
      // Upsert-on-insert: a repeat of the same keyed alert is a no-op rather
      // than a duplicate row or a thrown duplicate-key error.
      const result = await Notification.updateOne(
        { recipient, dedupeKey },
        { $setOnInsert: { recipient, actor, type, title, body, link, dedupeKey } },
        { upsert: true }
      );
      return result.upsertedId ? { _id: result.upsertedId } : null;
    }

    return await Notification.create({ recipient, actor, type, title, body, link });
  } catch (error) {
    // Includes the duplicate-key race on dedupeKey, which is a no-op by design.
    if (error?.code !== 11000) {
      console.warn(`[notify] could not write "${type}" notification: ${error.message}`);
    }
    return null;
  }
}

/** Fan out one notification to several people, skipping the actor. */
async function notifyMany(recipients, payload) {
  const unique = [...new Set((recipients ?? []).map(String))];
  await Promise.all(unique.map((recipient) => notify({ ...payload, recipient })));
}

module.exports = { notify, notifyMany };
