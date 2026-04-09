package expo.modules.kidpointsnotifications

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class KidPointsNotificationsModule : Module() {
  companion object {
    var instance: KidPointsNotificationsModule? = null
  }

  override fun definition() = ModuleDefinition {
    Name("KidPointsNotifications")

    Events(
      "KidPointsNotificationsStateChanged",
      "KidPointsNotificationsLaunchAction",
      "KidPointsNotificationsLog",
    )

    OnCreate {
      instance = this@KidPointsNotificationsModule
    }

    OnStartObserving {
      NotificationNativeLogRelay.setJsObservationEnabled(true)
    }

    OnStopObserving {
      NotificationNativeLogRelay.setJsObservationEnabled(false)
    }

    OnDestroy {
      if (instance === this@KidPointsNotificationsModule) {
        instance = null
      }
      NotificationNativeLogRelay.setJsObservationEnabled(false)
    }

    Function("getBufferedLogs") { afterSequence: Double ->
      NotificationNativeLogRelay.getBufferedLogs(afterSequence.toLong())
    }

    Function("getBufferedLogs") { afterSequence: Double ->
      NotificationNativeLogRelay.getBufferedLogs(afterSequence.toLong())
    }

    AsyncFunction("getDocument") {
      KidPointsNotificationsEngine.getStoredDocument(appContext.reactContext ?: return@AsyncFunction null)
    }

    AsyncFunction("getPendingLaunchAction") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      KidPointsNotificationsEngine.getPendingLaunchAction(context)
    }

    AsyncFunction("consumePendingLaunchAction") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      KidPointsNotificationsEngine.consumePendingLaunchAction(context)
    }

    AsyncFunction("saveDocument") { documentJson: String ->
      KidPointsNotificationsEngine.saveDocument(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("syncDocument") { documentJson: String ->
      KidPointsNotificationsEngine.syncDocument(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("startTimer") { documentJson: String ->
      KidPointsNotificationsEngine.startTimer(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("pauseTimer") { documentJson: String ->
      KidPointsNotificationsEngine.pauseTimer(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("resetTimer") { documentJson: String ->
      KidPointsNotificationsEngine.resetTimer(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("getRuntimeStatus") {
      val context = appContext.reactContext ?: return@AsyncFunction JSONObject().toString()
      val status = KidPointsNotificationsEngine.getRuntimeStatus(context)

      JSONObject().apply {
        put(
          "countdownNotificationChannelImportance",
          status.countdownNotificationChannelImportance ?: JSONObject.NULL,
        )
        put(
          "countdownNotificationHasPromotableCharacteristics",
          status.countdownNotificationHasPromotableCharacteristics,
        )
        put(
          "countdownNotificationIsOngoing",
          status.countdownNotificationIsOngoing,
        )
        put(
          "countdownNotificationRequestedPromoted",
          status.countdownNotificationRequestedPromoted,
        )
        put(
          "countdownNotificationUsesChronometer",
          status.countdownNotificationUsesChronometer,
        )
        put(
          "countdownNotificationWhen",
          status.countdownNotificationWhen ?: JSONObject.NULL,
        )
        put("exactAlarmPermissionGranted", status.exactAlarmPermissionGranted)
        put(
          "expiredNotificationCategory",
          status.expiredNotificationCategory ?: JSONObject.NULL,
        )
        put(
          "expiredNotificationChannelImportance",
          status.expiredNotificationChannelImportance ?: JSONObject.NULL,
        )
        put(
          "expiredNotificationHasCustomHeadsUp",
          status.expiredNotificationHasCustomHeadsUp,
        )
        put(
          "expiredNotificationHasFullScreenIntent",
          status.expiredNotificationHasFullScreenIntent,
        )
        put(
          "fullScreenIntentPermissionGranted",
          status.fullScreenIntentPermissionGranted,
        )
        put(
          "fullScreenIntentSettingsResolvable",
          status.fullScreenIntentSettingsResolvable,
        )
        put("isAppInForeground", status.isAppInForeground)
        put("isRunning", status.isRunning)
        put("lastTriggeredAt", status.lastTriggeredAt ?: JSONObject.NULL)
        put("nextTriggerAt", status.nextTriggerAt ?: JSONObject.NULL)
        put("notificationPermissionGranted", status.notificationPermissionGranted)
        put(
          "promotedNotificationSettingsResolvable",
          status.promotedNotificationSettingsResolvable,
        )
        put(
          "promotedNotificationPermissionGranted",
          status.promotedNotificationPermissionGranted,
        )
        put("sessionId", status.sessionId ?: JSONObject.NULL)
      }.toString()
    }

    AsyncFunction("canScheduleExactAlarms") {
      KidPointsNotificationsEngine.canScheduleExactAlarms(
        appContext.reactContext ?: return@AsyncFunction false,
      )
    }

    AsyncFunction("openExactAlarmSettings") {
      appContext.reactContext?.let {
        KidPointsNotificationsEngine.openExactAlarmSettings(it)
      }
    }

    AsyncFunction("openNotificationSettings") {
      appContext.reactContext?.let {
        KidPointsNotificationsEngine.openNotificationSettings(it)
      }
    }

    AsyncFunction("openPromotedNotificationSettings") {
      appContext.reactContext?.let {
        KidPointsNotificationsEngine.openPromotedNotificationSettings(it)
      }
    }

    AsyncFunction("openFullScreenIntentSettings") {
      appContext.reactContext?.let {
        KidPointsNotificationsEngine.openFullScreenIntentSettings(it)
      }
    }

    AsyncFunction("stopExpiredAlarmPlayback") {
      KidPointsNotificationsEngine.stopExpiredAlarmPlayback()
    }
  }

  fun emitState(
    document: JSONObject,
    reason: String,
    runtimeStatus: NotificationRuntimeStatusPayload,
  ) {
    sendEvent(
      "KidPointsNotificationsStateChanged",
      mapOf(
        "documentJson" to document.toString(),
        "reason" to reason,
        "runtimeStatusJson" to JSONObject().apply {
          put(
            "countdownNotificationChannelImportance",
            runtimeStatus.countdownNotificationChannelImportance ?: JSONObject.NULL,
          )
          put(
            "countdownNotificationHasPromotableCharacteristics",
            runtimeStatus.countdownNotificationHasPromotableCharacteristics,
          )
          put(
            "countdownNotificationIsOngoing",
            runtimeStatus.countdownNotificationIsOngoing,
          )
          put(
            "countdownNotificationRequestedPromoted",
            runtimeStatus.countdownNotificationRequestedPromoted,
          )
          put(
            "countdownNotificationUsesChronometer",
            runtimeStatus.countdownNotificationUsesChronometer,
          )
          put(
            "countdownNotificationWhen",
            runtimeStatus.countdownNotificationWhen ?: JSONObject.NULL,
          )
          put("exactAlarmPermissionGranted", runtimeStatus.exactAlarmPermissionGranted)
          put(
            "expiredNotificationCategory",
            runtimeStatus.expiredNotificationCategory ?: JSONObject.NULL,
          )
          put(
            "expiredNotificationChannelImportance",
            runtimeStatus.expiredNotificationChannelImportance ?: JSONObject.NULL,
          )
          put(
            "expiredNotificationHasCustomHeadsUp",
            runtimeStatus.expiredNotificationHasCustomHeadsUp,
          )
          put(
            "expiredNotificationHasFullScreenIntent",
            runtimeStatus.expiredNotificationHasFullScreenIntent,
          )
          put(
            "fullScreenIntentPermissionGranted",
            runtimeStatus.fullScreenIntentPermissionGranted,
          )
          put(
            "fullScreenIntentSettingsResolvable",
            runtimeStatus.fullScreenIntentSettingsResolvable,
          )
          put("isAppInForeground", runtimeStatus.isAppInForeground)
          put("isRunning", runtimeStatus.isRunning)
          put("lastTriggeredAt", runtimeStatus.lastTriggeredAt ?: JSONObject.NULL)
          put("nextTriggerAt", runtimeStatus.nextTriggerAt ?: JSONObject.NULL)
          put("notificationPermissionGranted", runtimeStatus.notificationPermissionGranted)
          put(
            "promotedNotificationSettingsResolvable",
            runtimeStatus.promotedNotificationSettingsResolvable,
          )
          put(
            "promotedNotificationPermissionGranted",
            runtimeStatus.promotedNotificationPermissionGranted,
          )
          put("sessionId", runtimeStatus.sessionId ?: JSONObject.NULL)
        }.toString(),
      ),
    )
  }

  fun emitLaunchAction(actionJson: String) {
    sendEvent(
      "KidPointsNotificationsLaunchAction",
      mapOf("actionJson" to actionJson),
    )
  }

  fun emitLog(entry: NotificationNativeLogEntryPayload) {
    sendEvent("KidPointsNotificationsLog", entry.toEventPayload())
  }
}
