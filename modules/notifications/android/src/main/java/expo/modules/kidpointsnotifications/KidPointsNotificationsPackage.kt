package expo.modules.kidpointsnotifications

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class KidPointsNotificationsPackage : Package {
  override fun createReactActivityLifecycleListeners(
    activityContext: Context?,
  ): List<ReactActivityLifecycleListener> {
    return listOf(KidPointsNotificationsActivityLifecycleListener())
  }
}
