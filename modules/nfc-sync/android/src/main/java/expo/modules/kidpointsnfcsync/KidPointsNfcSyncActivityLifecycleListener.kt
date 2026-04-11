package expo.modules.kidpointsnfcsync

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class KidPointsNfcSyncActivityLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    KidPointsNfcSyncEngine.onActivityCreated(activity)
  }

  override fun onResume(activity: Activity?) {
    KidPointsNfcSyncEngine.onActivityResumed(activity)
  }

  override fun onPause(activity: Activity?) {
    KidPointsNfcSyncEngine.onActivityPaused(activity)
  }

  override fun onDestroy(activity: Activity?) {
    KidPointsNfcSyncEngine.onActivityDestroyed(activity)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    return false
  }
}
