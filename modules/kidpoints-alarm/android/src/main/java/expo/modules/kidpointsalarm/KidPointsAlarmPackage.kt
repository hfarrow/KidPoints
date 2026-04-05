package expo.modules.kidpointsalarm

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class KidPointsAlarmPackage : Package {
  override fun createReactActivityLifecycleListeners(
    activityContext: Context?,
  ): List<ReactActivityLifecycleListener> {
    return listOf(KidPointsAlarmActivityLifecycleListener())
  }
}
