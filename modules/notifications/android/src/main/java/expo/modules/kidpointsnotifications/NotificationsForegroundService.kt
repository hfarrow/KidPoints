package expo.modules.kidpointsnotifications

import android.app.Service
import android.content.Intent
import android.os.IBinder
import org.json.JSONObject

class NotificationsForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    KidPointsNotificationsEngine.logService(
      "onStartCommand",
      JSONObject().apply {
        put("action", intent?.action ?: JSONObject.NULL)
        put("startId", startId)
      },
    )

    if (intent?.action == ACTION_TRIGGER) {
      KidPointsNotificationsEngine.handleTrigger(
        this,
        intent.getLongExtra(EXTRA_TRIGGER_AT, System.currentTimeMillis()),
      )
    }

    val runtimeStatus = KidPointsNotificationsEngine.getRuntimeStatus(this)
    if (!runtimeStatus.isRunning) {
      KidPointsNotificationsEngine.cancelInProcessTrigger()
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      KidPointsNotificationsEngine.logService(
        "Stopping self because runtime is not running",
      )
      return START_NOT_STICKY
    }

    runtimeStatus.nextTriggerAt?.let { nextTriggerAt ->
      KidPointsNotificationsEngine.ensureInProcessTrigger(this, nextTriggerAt)
    }

    startForeground(
      COUNTDOWN_NOTIFICATION_ID,
      KidPointsNotificationsEngine.createCountdownNotification(this),
    )
    KidPointsNotificationsEngine.logService(
      "Foreground notification posted",
      JSONObject().apply {
        put("notificationId", COUNTDOWN_NOTIFICATION_ID)
      },
    )

    return START_STICKY
  }
}
