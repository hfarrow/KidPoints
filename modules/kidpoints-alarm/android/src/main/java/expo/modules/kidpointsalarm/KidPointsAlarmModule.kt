package expo.modules.kidpointsalarm

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class KidPointsAlarmModule : Module() {
  companion object {
    var instance: KidPointsAlarmModule? = null
  }

  override fun definition() = ModuleDefinition {
    Name("KidPointsAlarm")

    Events("KidPointsAlarmStateChanged", "KidPointsAlarmLaunchAction")

    OnCreate {
      instance = this@KidPointsAlarmModule
    }

    OnDestroy {
      if (instance === this@KidPointsAlarmModule) {
        instance = null
      }
    }

    AsyncFunction("getDocument") {
      KidPointsAlarmEngine.getStoredDocument(appContext.reactContext ?: return@AsyncFunction null)
    }

    AsyncFunction("getPendingLaunchAction") {
      KidPointsAlarmEngine.getPendingLaunchAction(
        appContext.reactContext ?: return@AsyncFunction null,
      )
    }

    AsyncFunction("consumePendingLaunchAction") {
      KidPointsAlarmEngine.consumePendingLaunchAction(
        appContext.reactContext ?: return@AsyncFunction null,
      )
    }

    AsyncFunction("saveDocument") { documentJson: String ->
      KidPointsAlarmEngine.saveDocument(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("syncDocument") { documentJson: String ->
      KidPointsAlarmEngine.syncDocument(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("startTimer") { documentJson: String ->
      KidPointsAlarmEngine.startTimer(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("pauseTimer") { documentJson: String ->
      KidPointsAlarmEngine.pauseTimer(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("resetTimer") { documentJson: String ->
      KidPointsAlarmEngine.resetTimer(
        appContext.reactContext ?: return@AsyncFunction documentJson,
        documentJson,
      )
    }

    AsyncFunction("getRuntimeStatus") {
      val context = appContext.reactContext ?: return@AsyncFunction JSONObject().toString()
      val status = KidPointsAlarmEngine.getRuntimeStatus(context)

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
      KidPointsAlarmEngine.canScheduleExactAlarms(
        appContext.reactContext ?: return@AsyncFunction false,
      )
    }

    AsyncFunction("openExactAlarmSettings") {
      appContext.reactContext?.let {
        KidPointsAlarmEngine.openExactAlarmSettings(it)
      }
    }

    AsyncFunction("openNotificationSettings") {
      appContext.reactContext?.let {
        KidPointsAlarmEngine.openNotificationSettings(it)
      }
    }

    AsyncFunction("openPromotedNotificationSettings") {
      appContext.reactContext?.let {
        KidPointsAlarmEngine.openPromotedNotificationSettings(it)
      }
    }

    AsyncFunction("openFullScreenIntentSettings") {
      appContext.reactContext?.let {
        KidPointsAlarmEngine.openFullScreenIntentSettings(it)
      }
    }

    AsyncFunction("stopExpiredAlarmPlayback") {
      KidPointsAlarmEngine.stopExpiredAlarmPlayback()
    }
  }

  fun emitState(
    document: JSONObject,
    reason: String,
    runtimeStatus: AlarmRuntimeStatusPayload,
  ) {
    sendEvent(
      "KidPointsAlarmStateChanged",
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
      "KidPointsAlarmLaunchAction",
      mapOf("actionJson" to actionJson),
    )
  }
}
