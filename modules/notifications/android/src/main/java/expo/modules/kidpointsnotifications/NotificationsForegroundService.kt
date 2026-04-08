package expo.modules.kidpointsnotifications

import android.app.Service
import android.content.Intent
import android.os.IBinder

class NotificationsForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    KidPointsNotificationsEngine.logService("onStartCommand action=${intent?.action} startId=$startId")

    if (intent?.action == ACTION_TRIGGER) {
      KidPointsNotificationsEngine.handleTrigger(
        this,
        intent.getLongExtra(EXTRA_TRIGGER_AT, System.currentTimeMillis()),
      )
    }

    val runtimeStatus = KidPointsNotificationsEngine.getRuntimeStatus(this)
    if (!runtimeStatus.isRunning) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      KidPointsNotificationsEngine.logService("Stopping self because runtime is not running")
      return START_NOT_STICKY
    }

    startForeground(
      COUNTDOWN_NOTIFICATION_ID,
      KidPointsNotificationsEngine.createCountdownNotification(this),
    )
    KidPointsNotificationsEngine.logService("Foreground notification posted")

    return START_STICKY
  }
}
