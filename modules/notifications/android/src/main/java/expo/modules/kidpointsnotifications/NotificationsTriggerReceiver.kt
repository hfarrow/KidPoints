package expo.modules.kidpointsnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationsTriggerReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    KidPointsNotificationsEngine.handleTrigger(
      context,
      intent?.getLongExtra(EXTRA_TRIGGER_AT, System.currentTimeMillis())
        ?: System.currentTimeMillis(),
    )
  }
}
