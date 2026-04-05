package expo.modules.kidpointsalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      ACTION_PAUSE_TIMER -> {
        KidPointsAlarmEngine.pauseTimerFromNotification(context)
      }

      ACTION_STOP_TIMER -> {
        KidPointsAlarmEngine.stopTimerFromNotification(context)
      }
    }
  }
}
