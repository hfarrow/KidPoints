package expo.modules.kidpointsnfcsync

import expo.modules.kidpointsnativelogsync.NativeLogEntryPayload
import expo.modules.kidpointsnativelogsync.NativeLogRelay
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KidPointsNfcSyncModule : Module() {
  companion object {
    var instance: KidPointsNfcSyncModule? = null
    val nativeLogRelay =
      NativeLogRelay { entry ->
        instance?.emitLog(entry)
      }
  }

  override fun definition() = ModuleDefinition {
    Name("KidPointsNfcSync")

    Events(
      "KidPointsNfcSyncBootstrapCompleted",
      "KidPointsNfcSyncBootstrapStateChanged",
      "KidPointsNfcSyncLog",
    )

    OnCreate {
      instance = this@KidPointsNfcSyncModule
      KidPointsNfcSyncEngine.attachModule(this@KidPointsNfcSyncModule)
    }

    OnStartObserving {
      nativeLogRelay.setJsObservationEnabled(true)
    }

    OnStopObserving {
      nativeLogRelay.setJsObservationEnabled(false)
    }

    OnDestroy {
      if (instance === this@KidPointsNfcSyncModule) {
        instance = null
      }
      nativeLogRelay.setJsObservationEnabled(false)
      KidPointsNfcSyncEngine.detachModule(this@KidPointsNfcSyncModule)
    }

    Function("getBufferedLogs") { afterSequence: Double ->
      nativeLogRelay.getBufferedLogs(afterSequence.toLong())
    }

    AsyncFunction("getAvailabilityStatus") {
      KidPointsNfcSyncEngine.buildAvailabilityPayload(appContext.reactContext)
    }

    AsyncFunction("beginBootstrap") { localDeviceId: String, timeoutMs: Double ->
      KidPointsNfcSyncEngine.beginBootstrap(
        appContext,
        localDeviceId,
        timeoutMs.toLong(),
      )
    }

    AsyncFunction("cancelBootstrap") {
      KidPointsNfcSyncEngine.cancelBootstrap(appContext)
    }
  }

  fun emitBootstrapCompleted(payload: Map<String, Any?>) {
    sendEvent("KidPointsNfcSyncBootstrapCompleted", payload)
  }

  fun emitBootstrapStateChanged(payload: Map<String, Any?>) {
    sendEvent("KidPointsNfcSyncBootstrapStateChanged", payload)
  }

  fun emitLog(entry: NativeLogEntryPayload) {
    sendEvent("KidPointsNfcSyncLog", entry.toEventPayload())
  }
}
