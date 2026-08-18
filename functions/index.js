/**
 * Platemate — daily "log your workout" reminder.
 *
 * Runs once a day. For every user with reminders enabled, checks whether
 * they've already logged a workout "today" (in TIMEZONE, below); if not,
 * sends them a push notification via Firebase Cloud Messaging.
 *
 * Deploy with:  firebase deploy --only functions:workoutReminder
 * Requires the Blaze (pay-as-you-go) plan — free at this scale, since Cloud
 * Scheduler's free tier covers 3 jobs and this uses one.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ── Configuration ────────────────────────────────────────────────────────────
// Cron: "minute hour * * *" — this fires once a day at 18:00 (6:00 PM) in TIMEZONE.
// Change the hour here to change when everyone gets reminded.
const SCHEDULE = '0 18 * * *';
const TIMEZONE = 'America/Chicago';

// Returns today's date as YYYY-MM-DD in TIMEZONE, matching the date-key format
// the app itself uses for workout documents (users/{uid}/workouts/{YYYY-MM-DD}).
function todayKey() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA formats as YYYY-MM-DD
}

exports.workoutReminder = onSchedule(
  { schedule: SCHEDULE, timeZone: TIMEZONE },
  async () => {
    const dateKey = todayKey();
    const userDocs = await db.collection('users').listDocuments();

    let sent = 0, skipped = 0, cleaned = 0;

    for (const userRef of userDocs) {
      const uid = userRef.id;

      const notifSnap = await userRef.collection('settings').doc('notifications').get();
      if (!notifSnap.exists) { skipped++; continue; }
      const notif = notifSnap.data();
      if (!notif.enabled || !notif.fcmToken) { skipped++; continue; }

      const workoutSnap = await userRef.collection('workouts').doc(dateKey).get();
      const exercises = workoutSnap.exists ? (workoutSnap.data().exercises || []) : [];
      if (exercises.length > 0) { skipped++; continue; } // already logged today

      try {
        await messaging.send({
          token: notif.fcmToken,
          notification: {
            title: 'Platemate',
            body: "You haven't logged a workout today — tap to log one 💪",
          },
          webpush: {
            fcmOptions: { link: '/' },
            notification: { icon: '/icon-192x192.png' },
          },
        });
        sent++;
      } catch (err) {
        // Token is stale/invalid (uninstalled, permission revoked, etc.) — turn
        // reminders off for this user so we stop retrying a dead token.
        if (
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token'
        ) {
          await userRef.collection('settings').doc('notifications').set(
            { enabled: false, fcmToken: null },
            { merge: true }
          );
          cleaned++;
        } else {
          console.error(`Failed to send reminder to ${uid}:`, err);
        }
      }
    }

    console.log(`workoutReminder: sent=${sent} skipped=${skipped} cleanedTokens=${cleaned}`);
  }
);
