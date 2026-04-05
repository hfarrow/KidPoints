package expo.modules.kidpointsalarm

import android.app.Service
import android.content.Intent
import android.os.IBinder

class AlarmForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    KidPointsAlarmEngine.logService("onStartCommand action=${intent?.action} startId=$startId")

    if (intent?.action == ACTION_TRIGGER) {
      KidPointsAlarmEngine.handleTrigger(
        this,
        intent.getLongExtra(EXTRA_TRIGGER_AT, System.currentTimeMillis()),
      )
    }

    val runtimeStatus = KidPointsAlarmEngine.getRuntimeStatus(this)
    if (!runtimeStatus.isRunning) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      KidPointsAlarmEngine.logService("Stopping self because runtime is not running")
      return START_NOT_STICKY
    }

    startForeground(
      COUNTDOWN_NOTIFICATION_ID,
      KidPointsAlarmEngine.createCountdownNotification(this),
    )
    KidPointsAlarmEngine.logService("Foreground notification posted")

    return START_STICKY
  }
}
