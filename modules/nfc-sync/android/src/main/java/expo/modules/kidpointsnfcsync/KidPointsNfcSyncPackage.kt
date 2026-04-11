package expo.modules.kidpointsnfcsync

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class KidPointsNfcSyncPackage : Package {
  override fun createReactActivityLifecycleListeners(
    activityContext: Context?,
  ): List<ReactActivityLifecycleListener> {
    return listOf(KidPointsNfcSyncActivityLifecycleListener())
  }
}
