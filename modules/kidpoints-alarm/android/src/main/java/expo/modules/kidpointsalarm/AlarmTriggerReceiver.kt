package expo.modules.kidpointsalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmTriggerReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    KidPointsAlarmEngine.handleTrigger(
      context,
      intent?.getLongExtra(EXTRA_TRIGGER_AT, System.currentTimeMillis())
        ?: System.currentTimeMillis(),
    )
  }
}
