package expo.modules.kidpointsnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationsActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      ACTION_PAUSE_TIMER -> {
        KidPointsNotificationsEngine.pauseTimerFromNotification(context)
      }

      ACTION_STOP_TIMER -> {
        KidPointsNotificationsEngine.stopTimerFromNotification(context)
      }
    }
  }
}
