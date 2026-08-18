# Workout reminder notifications — setup guide

This adds a daily push notification: "You haven't logged a workout today" —
sent once a day (default **6:00 PM America/Chicago**) to anyone who has
reminders turned on in Profile and hasn't logged a workout yet that day.

It only notifies people who opt in from the Profile tab, so nothing changes
for existing users until they turn it on.

## What changed / was added

| File | What |
|---|---|
| `index.html` | Firebase Messaging wired in; "Workout Reminders" toggle added to Profile tab |
| `firebase-messaging-sw.js` | **New.** Service worker that shows the notification when the app is closed/backgrounded |
| `functions/index.js` | **New.** Scheduled Cloud Function that checks who hasn't logged today and sends the push |
| `functions/package.json` | **New.** Dependencies for the function above |

`manifest.json` and `serviceworker.js` (the offline-cache one) are unchanged.

## 1. Get a VAPID key (5 min)

Web push requires a "Web Push certificate" key pair from your Firebase project.

1. Go to the [Firebase Console](https://console.firebase.google.com/) → your **platemate-f76cc** project
2. Project settings (gear icon) → **Cloud Messaging** tab
3. Under **Web configuration → Web Push certificates**, click **Generate key pair** (skip if one already exists)
4. Copy the key string
5. Open `index.html`, find this line near the top of the Firebase `<script type="module">` block:
   ```js
   const VAPID_KEY = 'PASTE_YOUR_VAPID_KEY_HERE';
   ```
   and paste your key in place of the placeholder.

Reminders won't turn on for anyone until this is set — the app shows a clear
alert if someone taps the toggle before it's configured.

## 2. Deploy the files to hosting

Upload the updated `index.html` and the new `firebase-messaging-sw.js` to
wherever Platemate is hosted (e.g. Firebase Hosting), at the **same root
folder** as the other app files. If you use Firebase Hosting:

```bash
firebase deploy --only hosting
```

`firebase-messaging-sw.js` must sit next to `index.html` (same directory) —
its default scope only covers files in that folder.

## 3. Deploy the Cloud Function

This step needs the **Blaze (pay-as-you-go)** plan on the Firebase project —
free at this scale, since the scheduled job uses 1 of the 3 free Cloud
Scheduler jobs and Cloud Functions has a generous free tier.

If you haven't set up Functions in this project before:

```bash
cd path/to/platemate         # the folder containing functions/
firebase init functions      # choose "Use an existing project" → platemate-f76cc
#   when it asks to overwrite functions/index.js and package.json — decline
#   overwrite, or just re-copy the provided files back in afterward
cd functions
npm install
cd ..
firebase deploy --only functions:workoutReminder
```

If Functions is already set up, just drop `functions/index.js` in (merging
its `firebase-admin`/`firebase-functions` dependencies into your existing
`functions/package.json` if you have other functions already), then:

```bash
firebase deploy --only functions:workoutReminder
```

## 4. Firestore security rules

The app already writes to `users/{uid}/settings/...` for nutrition goals, so
if your existing rules allow an authenticated user to read/write their own
`users/{uid}/**`, no changes are needed. If your rules are narrower, add:

```
match /users/{uid}/settings/notifications {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

The Cloud Function itself reads/writes via the Admin SDK, which bypasses
security rules entirely, so it isn't affected by this either way.

## 5. Test it

1. Open Platemate on your phone (Android/desktop: any browser is fine. **iPhone: must be added to the Home Screen first** — Share → Add to Home Screen — iOS Safari does not support push notifications for sites opened in a regular tab)
2. Profile tab → tap **Workout Reminders** → allow the permission prompt
3. In the Firebase Console, go to **Cloud Messaging** → send yourself a test
   message using the FCM token, or just wait for tomorrow's scheduled run
4. To test the scheduled function immediately without waiting, run it manually
   from the Cloud Console: Cloud Scheduler → find the `workoutReminder` job →
   **Force run**

## Notes / things worth knowing

- **Timing**: everyone gets reminded at the same fixed time (6:00 PM
  Central by default), regardless of their own time zone. To change the
  time, edit `SCHEDULE` and `TIMEZONE` at the top of `functions/index.js`
  and redeploy.
- **"Today" boundary**: the function checks for a logged workout using the
  date in `TIMEZONE`, which may not exactly match a user's local midnight if
  they're in a different time zone — a minor edge case at this scale.
- **Dead tokens**: if a user uninstalls the app, clears data, or revokes
  notification permission, their next reminder attempt will fail; the
  function detects that and automatically turns their reminder setting back
  off so it stops retrying.
- **Cost**: at low user counts this stays well within Firebase's free Spark-tier-equivalent usage even on Blaze (you're billed only for usage beyond the free tier, and one job firing once a day is far under it).
