package expo.modules.kidpointsnotifications

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class KidPointsNotificationsActivityLifecycleListener(
  initialAppContext: Context? = null,
) : ReactActivityLifecycleListener {
  private var appContext: Context? = initialAppContext

  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    if (activity == null) {
      return
    }

    appContext = activity.applicationContext
    KidPointsNotificationsEngine.setAppInForeground(true)
    KidPointsNotificationsEngine.handleActivityIntent(activity, activity.intent)
  }

  override fun onResume(activity: Activity?) {
    if (activity != null) {
      appContext = activity.applicationContext
    }
    KidPointsNotificationsEngine.setAppInForeground(true)
  }

  override fun onPause(activity: Activity?) {
    KidPointsNotificationsEngine.setAppInForeground(false)
  }

  override fun onDestroy(activity: Activity?) {
    KidPointsNotificationsEngine.setAppInForeground(false)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    val context = appContext ?: KidPointsNotificationsModule.instance?.appContext?.reactContext
    if (context != null) {
      KidPointsNotificationsEngine.handleActivityIntent(context, intent)
    }

    return false
  }
}
