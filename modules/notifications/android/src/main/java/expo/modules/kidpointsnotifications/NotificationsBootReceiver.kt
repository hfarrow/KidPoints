package expo.modules.kidpointsnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationsBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
      KidPointsNotificationsEngine.restoreAfterBoot(context)
    }
  }
}
