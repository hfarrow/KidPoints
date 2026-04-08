package expo.modules.kidpointsnotifications

import android.Manifest
import android.app.AlarmManager
import android.app.ActivityOptions
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.RemoteViews
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date
import kotlin.math.max

private const val PREFS_NAME = "KidPointsNotificationsPrefs"
private const val STORAGE_KEY = "kidpoints.notifications.document.v1"
private const val PENDING_LAUNCH_ACTION_KEY =
  "kidpoints.notifications.pending-launch-action.v1"

const val ACTION_REFRESH = "expo.modules.kidpointsnotifications.action.REFRESH"
const val ACTION_TRIGGER = "expo.modules.kidpointsnotifications.action.TRIGGER"
const val ACTION_STOP_TIMER = "expo.modules.kidpointsnotifications.action.STOP_TIMER"
const val ACTION_PAUSE_TIMER = "expo.modules.kidpointsnotifications.action.PAUSE_TIMER"

const val EXTRA_TRIGGER_AT = "triggerAt"
const val EXTRA_LAUNCH_ACTION_JSON = "launchActionJson"
const val EXTRA_CHILD_COUNT = "childCount"

const val COUNTDOWN_NOTIFICATION_ID = 4100

private const val COUNTDOWN_CHANNEL_ID = "kidpoints.countdown"
private const val EXPIRED_CHANNEL_ID = "kidpoints.expired.alarm.v2"
private const val TRIGGER_REQUEST_CODE = 6001
private const val OPEN_APP_REQUEST_CODE = 7001
private const val PAUSE_TIMER_REQUEST_CODE = 7002
private const val STOP_TIMER_REQUEST_CODE = 7003
private const val CHECK_IN_REQUEST_CODE_BASE = 7100
private const val STOP_EXPIRED_REQUEST_CODE_BASE = 7200
private const val LAUNCH_ACTION_CHECK_IN = "check-in"

private const val LOG_TAG = "KidPointsNotifications"
private const val LOG_NOTIFICATION_TAG = "KidPointsNotificationsNotif"
private const val LOG_INTENT_TAG = "KidPointsNotificationsIntent"
private const val LOG_SERVICE_TAG = "KidPointsNotificationsService"

data class NotificationRuntimeStatusPayload(
  val countdownNotificationChannelImportance: Int?,
  val countdownNotificationHasPromotableCharacteristics: Boolean,
  val countdownNotificationIsOngoing: Boolean,
  val countdownNotificationRequestedPromoted: Boolean,
  val countdownNotificationUsesChronometer: Boolean,
  val countdownNotificationWhen: Long?,
  val exactAlarmPermissionGranted: Boolean,
  val expiredNotificationCategory: String?,
  val expiredNotificationChannelImportance: Int?,
  val expiredNotificationHasCustomHeadsUp: Boolean,
  val expiredNotificationHasFullScreenIntent: Boolean,
  val fullScreenIntentPermissionGranted: Boolean,
  val fullScreenIntentSettingsResolvable: Boolean,
  val isAppInForeground: Boolean,
  val isRunning: Boolean,
  val lastTriggeredAt: Long?,
  val nextTriggerAt: Long?,
  val notificationPermissionGranted: Boolean,
  val promotedNotificationSettingsResolvable: Boolean,
  val promotedNotificationPermissionGranted: Boolean,
  val sessionId: String?,
)

data class PendingNotificationLaunchActionPayload(
  val type: String,
  val intervalId: String?,
  val notificationId: Int?,
  val sessionId: String?,
  val triggeredAt: Long?,
)

object KidPointsNotificationsEngine {
  @Volatile
  private var isAppInForeground = false
  private val alarmPlaybackHandler = Handler(Looper.getMainLooper())
  private var activeAlarmRingtone: Ringtone? = null
  private var stopAlarmPlaybackRunnable: Runnable? = null

  fun getStoredDocument(context: Context): String? =
    prefs(context).getString(STORAGE_KEY, null)

  fun getPendingLaunchAction(context: Context): String? =
    prefs(context).getString(PENDING_LAUNCH_ACTION_KEY, null).also { pendingLaunchAction ->
      logIntent(
        "Read pending launch action",
        createLogContext(
          "hasValue" to (pendingLaunchAction != null),
          "payload" to parseJsonObjectOrRaw(pendingLaunchAction),
        ),
      )
    }

  fun consumePendingLaunchAction(context: Context): String? {
    val pendingLaunchAction = getPendingLaunchAction(context)

    if (pendingLaunchAction != null) {
      prefs(context)
        .edit()
        .remove(PENDING_LAUNCH_ACTION_KEY)
        .apply()
      logIntent(
        "Consumed pending launch action",
        createLogContext("payload" to parseJsonObjectOrRaw(pendingLaunchAction)),
      )
    }

    return pendingLaunchAction
  }

  fun saveDocument(context: Context, documentJson: String): String {
    persistDocument(context, documentJson)
    return documentJson
  }

  fun syncDocument(context: Context, documentJson: String): String {
    persistDocument(context, documentJson)
    return documentJson
  }

  fun startTimer(context: Context, documentJson: String): String {
    stopExpiredAlarmPlayback()
    val document = JSONObject(documentJson)
    val head = getHead(document)
    val timerState = getOrCreateObject(head, "timerState")
    val timerRuntimeState = getOrCreateObject(head, "timerRuntimeState")
    val nextTriggerAt =
      timerState.optLong("cycleStartedAt", System.currentTimeMillis()) + getIntervalMs(head)

    timerRuntimeState.put(
      "sessionId",
      timerRuntimeState.optStringOrNull("sessionId")?.takeIf { it.isNotBlank() }
        ?: "session-${System.currentTimeMillis()}",
    )
    timerRuntimeState.put("nextTriggerAt", nextTriggerAt)
    if (!timerRuntimeState.has("lastTriggeredAt")) {
      timerRuntimeState.put("lastTriggeredAt", JSONObject.NULL)
    }

    persistDocument(context, document.toString())
    ensureChannels(context)
    scheduleExactTrigger(context, nextTriggerAt)
    startForegroundService(context, ACTION_REFRESH)
    logDebug(
      "Started timer",
      createLogContext(
        "nextTriggerAt" to nextTriggerAt,
        "sessionId" to timerRuntimeState.optStringOrNull("sessionId"),
      ),
    )
    emitState(document, "timer-started", context)

    return document.toString()
  }

  fun pauseTimer(context: Context, documentJson: String): String {
    stopExpiredAlarmPlayback()
    val document = JSONObject(documentJson)
    val runtime = getOrCreateObject(getHead(document), "timerRuntimeState")
    runtime.put("nextTriggerAt", JSONObject.NULL)

    persistDocument(context, document.toString())
    cancelExactTrigger(context)
    NotificationManagerCompat.from(context).cancel(COUNTDOWN_NOTIFICATION_ID)
    stopForegroundService(context)
    logDebug(
      "Paused timer from JS",
      createLogContext("sessionId" to runtime.optStringOrNull("sessionId")),
    )
    emitState(document, "timer-paused", context)

    return document.toString()
  }

  fun pauseTimerFromNotification(
    context: Context,
    pausedAt: Long = System.currentTimeMillis(),
  ) {
    stopExpiredAlarmPlayback()
    val rawDocument = getStoredDocument(context) ?: return
    val document = JSONObject(rawDocument)
    val head = getHead(document)
    val timerState = getOrCreateObject(head, "timerState")
    val runtime = getOrCreateObject(head, "timerRuntimeState")

    if (!timerState.optBoolean("isRunning", false)) {
      logDebug("Ignored notification pause because timer is already stopped")
      return
    }

    val cycleStartedAt = timerState.optLongOrNull("cycleStartedAt")
    val pausedRemainingMs =
      if (cycleStartedAt == null) {
        timerState.optLongOrNull("pausedRemainingMs")
      } else {
        val intervalMs = getIntervalMs(head)
        val elapsedMs = max(pausedAt - cycleStartedAt, 0)
        val remainderMs = elapsedMs % intervalMs
        val hasCompletedBoundary = elapsedMs > 0 && remainderMs == 0L

        if (hasCompletedBoundary) {
          intervalMs
        } else {
          intervalMs - remainderMs
        }
      }

    timerState.put("cycleStartedAt", JSONObject.NULL)
    timerState.put("isRunning", false)
    timerState.put("pausedRemainingMs", pausedRemainingMs ?: JSONObject.NULL)
    runtime.put("nextTriggerAt", JSONObject.NULL)

    persistDocument(context, document.toString())
    cancelExactTrigger(context)
    NotificationManagerCompat.from(context).cancel(COUNTDOWN_NOTIFICATION_ID)
    stopForegroundService(context)
    logDebug(
      "Paused timer from notification",
      createLogContext(
        "pausedRemainingMs" to pausedRemainingMs,
        "sessionId" to runtime.optStringOrNull("sessionId"),
      ),
    )
    emitState(document, "timer-paused-notification", context)
  }

  fun resetTimer(context: Context, documentJson: String): String {
    stopExpiredAlarmPlayback()
    val document = JSONObject(documentJson)
    val head = getHead(document)

    getOrCreateObject(head, "timerState").apply {
      put("cycleStartedAt", JSONObject.NULL)
      put("isRunning", false)
      put("pausedRemainingMs", JSONObject.NULL)
    }
    getOrCreateObject(head, "timerRuntimeState").apply {
      put("sessionId", JSONObject.NULL)
      put("nextTriggerAt", JSONObject.NULL)
      put("lastTriggeredAt", JSONObject.NULL)
    }
    head.put("expiredIntervals", JSONArray())

    persistDocument(context, document.toString())
    cancelExactTrigger(context)
    NotificationManagerCompat.from(context).cancelAll()
    stopForegroundService(context)
    logDebug("Reset timer from JS and cleared expired intervals")
    emitState(document, "timer-reset", context)

    return document.toString()
  }

  fun handleTrigger(context: Context, triggerAt: Long = System.currentTimeMillis()) {
    val rawDocument = getStoredDocument(context) ?: return
    val document = JSONObject(rawDocument)
    val head = getHead(document)
    val timerConfig = getOrCreateObject(head, "timerConfig")
    val timerState = getOrCreateObject(head, "timerState")
    val runtime = getOrCreateObject(head, "timerRuntimeState")

    if (!timerState.optBoolean("isRunning", false)) {
      logDebug(
        "Ignored trigger because timer is not running",
        createLogContext("triggerAt" to triggerAt),
      )
      return
    }

    runtime.put("lastTriggeredAt", triggerAt)
    runtime.put("nextTriggerAt", JSONObject.NULL)
    timerState.put("cycleStartedAt", JSONObject.NULL)
    timerState.put("isRunning", false)
    timerState.put("pausedRemainingMs", JSONObject.NULL)

    val expiredInterval = createExpiredInterval(head, runtime, triggerAt)
    val notificationId = expiredInterval?.optIntOrNull("notificationId")
    val pendingLaunchAction = expiredInterval?.let { createCheckInLaunchAction(it) }

    persistDocument(context, document.toString())
    cancelExactTrigger(context)
    NotificationManagerCompat.from(context).cancel(COUNTDOWN_NOTIFICATION_ID)
    stopForegroundService(context)
    ensureChannels(context)
    val shouldPlayAlarm = timerConfig.optBoolean("notificationsEnabled", true)
    val alarmDurationSeconds = max(timerConfig.optInt("alarmDurationSeconds", 20), 1)

    logDebug(
      "Handled interval trigger",
      createLogContext(
        "appInForeground" to isAppInForeground,
        "intervalId" to expiredInterval?.optString("intervalId"),
        "notificationId" to notificationId,
        "sessionId" to runtime.optStringOrNull("sessionId"),
        "triggerAt" to triggerAt,
      ),
    )

    if (shouldPlayAlarm) {
      playExpiredAlarm(context, alarmDurationSeconds)
    }

    if (pendingLaunchAction != null) {
      persistPendingLaunchAction(context, pendingLaunchAction)
    }

    if (
      expiredInterval != null &&
      timerConfig.optBoolean("notificationsEnabled", true) &&
      isNotificationPermissionGranted(context) &&
      notificationId != null
    ) {
      NotificationManagerCompat.from(context).notify(
        notificationId,
        createExpiredNotification(context, expiredInterval),
      )
      logNotification(
        "Posted expired notification",
        createLogContext(
          "appInForeground" to isAppInForeground,
          "intervalId" to expiredInterval.optString("intervalId"),
          "notificationId" to notificationId,
        ),
      )
    }

    emitState(document, "interval-triggered", context)
  }

  fun stopTimerFromNotification(context: Context) {
    stopExpiredAlarmPlayback()
    val rawDocument = getStoredDocument(context) ?: return
    val document = JSONObject(rawDocument)
    val head = getHead(document)

    getOrCreateObject(head, "timerState").apply {
      put("cycleStartedAt", JSONObject.NULL)
      put("isRunning", false)
      put("pausedRemainingMs", JSONObject.NULL)
    }
    getOrCreateObject(head, "timerRuntimeState").apply {
      put("sessionId", JSONObject.NULL)
      put("nextTriggerAt", JSONObject.NULL)
      put("lastTriggeredAt", JSONObject.NULL)
    }

    persistDocument(context, document.toString())
    cancelExactTrigger(context)
    NotificationManagerCompat.from(context).cancelAll()
    stopForegroundService(context)
    logDebug("Stopped timer from notification")
    emitState(document, "timer-stopped", context)
  }

  fun restoreAfterBoot(context: Context) {
    val rawDocument = getStoredDocument(context) ?: return
    val document = JSONObject(rawDocument)
    val nextTriggerAt =
      getOrCreateObject(getHead(document), "timerRuntimeState").optLongOrNull("nextTriggerAt")

    if (nextTriggerAt != null) {
      scheduleExactTrigger(context, nextTriggerAt)
      startForegroundService(context, ACTION_REFRESH)
      logService(
        "Restored after boot",
        createLogContext("nextTriggerAt" to nextTriggerAt),
      )
    }
  }

  fun getRuntimeStatus(context: Context): NotificationRuntimeStatusPayload {
    val rawDocument = getStoredDocument(context)
    val document = rawDocument?.let { JSONObject(it) }
    val head = document?.let { getHead(it) }
    val runtime = head?.optJSONObject("timerRuntimeState")
    val timerState = head?.optJSONObject("timerState")
    val nextTriggerAt = runtime?.optLongOrNull("nextTriggerAt")
    val countdownNotification = buildCountdownNotification(context, nextTriggerAt ?: System.currentTimeMillis())
    val countdownChannel = getCountdownChannel(context)
    val expiredNotification = head
      ?.optJSONArray("expiredIntervals")
      ?.toJsonObjects()
      ?.lastOrNull()
      ?.let { createExpiredNotification(context, it) }
    val expiredChannel = getExpiredChannel(context)

    return NotificationRuntimeStatusPayload(
      countdownNotificationChannelImportance = countdownChannel?.importance,
      countdownNotificationHasPromotableCharacteristics =
        NotificationCompat.hasPromotableCharacteristics(countdownNotification),
      countdownNotificationIsOngoing =
        (countdownNotification.flags and Notification.FLAG_ONGOING_EVENT) != 0,
      countdownNotificationRequestedPromoted =
        NotificationCompat.isRequestPromotedOngoing(countdownNotification),
      countdownNotificationUsesChronometer =
        countdownNotification.extras?.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER, false) == true,
      countdownNotificationWhen = countdownNotification.`when`.takeIf { it > 0L },
      exactAlarmPermissionGranted = canScheduleExactAlarms(context),
      expiredNotificationCategory = expiredNotification?.category,
      expiredNotificationChannelImportance = expiredChannel?.importance,
      expiredNotificationHasCustomHeadsUp = expiredNotification?.headsUpContentView != null,
      expiredNotificationHasFullScreenIntent = expiredNotification?.fullScreenIntent != null,
      fullScreenIntentPermissionGranted = canUseFullScreenIntent(context),
      fullScreenIntentSettingsResolvable = canOpenFullScreenIntentSettings(context),
      isAppInForeground = isAppInForeground,
      isRunning = timerState?.optBoolean("isRunning") == true,
      lastTriggeredAt = runtime?.optLongOrNull("lastTriggeredAt"),
      nextTriggerAt = nextTriggerAt,
      notificationPermissionGranted = isNotificationPermissionGranted(context),
      promotedNotificationSettingsResolvable = canOpenPromotedNotificationSettings(context),
      promotedNotificationPermissionGranted = canPostPromotedNotifications(context),
      sessionId = runtime?.optStringOrNull("sessionId")?.takeIf { it.isNotBlank() },
    )
  }

  fun createCountdownNotification(context: Context): Notification {
    ensureChannels(context)

    val document = JSONObject(getStoredDocument(context) ?: "{}")
    val head = getHead(document)
    val runtime = getOrCreateObject(head, "timerRuntimeState")
    val nextTriggerAt = runtime.optLongOrNull("nextTriggerAt") ?: System.currentTimeMillis()
    val notification = buildCountdownNotification(context, nextTriggerAt)
    val countdownChannel = getCountdownChannel(context)

    logNotification(
      "Built countdown notification",
      createLogContext(
        "canPostPromoted" to canPostPromotedNotifications(context),
        "channelImportance" to countdownChannel?.importance,
        "hasPromotableCharacteristics" to
          NotificationCompat.hasPromotableCharacteristics(notification),
        "isOngoing" to ((notification.flags and Notification.FLAG_ONGOING_EVENT) != 0),
        "nextTriggerAt" to nextTriggerAt,
        "requestedPromoted" to NotificationCompat.isRequestPromotedOngoing(notification),
        "sessionId" to runtime.optStringOrNull("sessionId"),
        "settingsResolvable" to canOpenPromotedNotificationSettings(context),
        "usesChronometer" to
          (notification.extras?.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER, false) == true),
        "when" to notification.`when`,
      ),
    )

    return notification
  }

  private fun buildCountdownNotification(
    context: Context,
    nextTriggerAt: Long,
  ): Notification =
    NotificationCompat.Builder(context, COUNTDOWN_CHANNEL_ID)
      .addAction(
        0,
        "Stop",
        createStopTimerPendingIntent(context),
      )
      .addAction(
        0,
        "Pause",
        createPauseTimerPendingIntent(context),
      )
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setContentText("Ends ${formatTime(nextTriggerAt)}")
        .setContentTitle("KidPoints timer")
        .setContentIntent(createOpenAppPendingIntent(context))
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setRequestPromotedOngoing(true)
        .setShowWhen(true)
        .setSilent(true)
        .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setUsesChronometer(true)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setWhen(nextTriggerAt)
        .setChronometerCountDown(true)
        .build()

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return true
    }

    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return alarmManager.canScheduleExactAlarms()
  }

  fun isNotificationPermissionGranted(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    return ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.POST_NOTIFICATIONS,
    ) == PackageManager.PERMISSION_GRANTED
  }

  fun canPostPromotedNotifications(context: Context): Boolean =
    NotificationManagerCompat.from(context).canPostPromotedNotifications()

  fun canUseFullScreenIntent(context: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      NotificationManagerCompat.from(context).canUseFullScreenIntent()
    } else {
      true
    }

  fun canOpenPromotedNotificationSettings(context: Context): Boolean =
    createPromotedNotificationSettingsIntent(context).resolveActivity(context.packageManager) != null

  fun canOpenFullScreenIntentSettings(context: Context): Boolean =
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      false
    } else {
      createFullScreenIntentSettingsIntent(context).resolveActivity(context.packageManager) != null
    }

  fun openExactAlarmSettings(context: Context) {
    context.startActivity(
      Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        data = android.net.Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      },
    )
  }

  fun openNotificationSettings(context: Context) {
    context.startActivity(
      Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      },
    )
  }

  fun openPromotedNotificationSettings(context: Context) {
    val intent = createPromotedNotificationSettingsIntent(context)

    if (intent.resolveActivity(context.packageManager) == null) {
      logNotification("Promoted notification settings unavailable; falling back to app notification settings")
      openNotificationSettings(context)
      return
    }

    logNotification(
      "Opening promoted notification settings",
      createLogContext("action" to intent.action),
    )
    context.startActivity(intent)
  }

  fun openFullScreenIntentSettings(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      return
    }

    val intent = createFullScreenIntentSettingsIntent(context)

    if (intent.resolveActivity(context.packageManager) == null) {
      logNotification("Full-screen intent settings unavailable")
      return
    }

    logNotification(
      "Opening full-screen intent settings",
      createLogContext("action" to intent.action),
    )
    context.startActivity(intent)
  }

  fun startForegroundService(context: Context, action: String) {
    logService(
      "Starting foreground service",
      createLogContext("action" to action),
    )
    ContextCompat.startForegroundService(
      context,
      Intent(context, NotificationsForegroundService::class.java).apply {
        this.action = action
      },
    )
  }

  fun stopForegroundService(context: Context) {
    logService("Stopping foreground service")
    context.stopService(Intent(context, NotificationsForegroundService::class.java))
  }

  fun handleActivityIntent(context: Context, intent: Intent?) {
    logIntent(
      "Received activity intent",
      createLogContext(
        "intent" to describeIntent(intent),
        "moduleAttached" to (KidPointsNotificationsModule.instance != null),
      ),
    )
    val actionJson = intent?.getStringExtra(EXTRA_LAUNCH_ACTION_JSON)

    if (actionJson == null) {
      logIntent("Ignored activity intent because no launch action payload was present")
      return
    }

    stopExpiredAlarmPlayback()
    persistPendingLaunchAction(context, actionJson)
    KidPointsNotificationsModule.instance?.emitLaunchAction(actionJson)

    val notificationId = JSONObject(actionJson).optIntOrNull("notificationId")
    if (notificationId != null) {
      NotificationManagerCompat.from(context).cancel(notificationId)
      logNotification(
        "Cancelled notification from activity intent",
        createLogContext("notificationId" to notificationId),
      )
    }

    logIntent(
      "Handled activity launch intent",
      createLogContext(
        "emittedEvent" to (KidPointsNotificationsModule.instance != null),
        "notificationId" to notificationId,
        "payload" to parseJsonObjectOrRaw(actionJson),
      ),
    )
  }

  fun stopExpiredAlarmPlayback() {
    stopAlarmPlaybackRunnable?.let(alarmPlaybackHandler::removeCallbacks)
    stopAlarmPlaybackRunnable = null

    activeAlarmRingtone?.stop()
    activeAlarmRingtone = null
    logDebug("Stopped expired alarm playback")
  }

  fun cancelExpiredNotification(context: Context, notificationId: Int?) {
    if (notificationId == null) {
      return
    }

    NotificationManagerCompat.from(context).cancel(notificationId)
    logNotification(
      "Cancelled expired notification",
      createLogContext("notificationId" to notificationId),
    )
  }

  fun createMainAppCheckInIntent(context: Context, actionJson: String): Intent =
    createLaunchIntent(context).apply {
      putExtra(EXTRA_LAUNCH_ACTION_JSON, actionJson)
    }

  fun setAppInForeground(isForeground: Boolean) {
    isAppInForeground = isForeground
  }

  fun logService(message: String, context: JSONObject? = null) {
    log(LOG_SERVICE_TAG, message, context)
  }

  private fun createExpiredNotification(
    context: Context,
    expiredInterval: JSONObject,
  ): Notification {
    val intervalId = expiredInterval.optString("intervalId")
    val notificationId = expiredInterval.optInt("notificationId")
    val triggeredAt = expiredInterval.optLongOrNull("triggeredAt") ?: System.currentTimeMillis()
    val childCount =
      expiredInterval.optJSONArray("childActions")?.length()?.takeIf { it > 0 } ?: 0
    val reviewText =
      if (childCount == 1) {
        "1 child needs check-in"
      } else {
        "$childCount children need check-in"
      }
    val headsUpRemoteViews = createExpiredHeadsUpRemoteViews(context, expiredInterval, reviewText)

    return NotificationCompat.Builder(context, EXPIRED_CHANNEL_ID)
      .addAction(
        0,
        "Check-in",
        createCheckInPendingIntent(context, expiredInterval),
      )
      .addAction(
        0,
        "Stop",
        createExpiredStopPendingIntent(context, expiredInterval),
      )
      .setAutoCancel(false)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setContentText(reviewText)
      .setContentTitle("Time to Check-in!")
      .setContentIntent(createCheckInPendingIntent(context, expiredInterval))
      .setCustomHeadsUpContentView(headsUpRemoteViews)
      .setDeleteIntent(createExpiredStopPendingIntent(context, expiredInterval))
      .setFullScreenIntent(createCheckInPendingIntent(context, expiredInterval), true)
      .setOnlyAlertOnce(false)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setWhen(triggeredAt)
      .build().also {
        val expiredChannel = getExpiredChannel(context)
        logNotification(
          "Built expired notification",
          createLogContext(
            "appInForeground" to isAppInForeground,
            "canUseFullScreenIntent" to canUseFullScreenIntent(context),
            "category" to it.category,
            "channelImportance" to expiredChannel?.importance,
            "hasCustomHeadsUp" to (it.headsUpContentView != null),
            "hasFullScreenIntent" to (it.fullScreenIntent != null),
            "intervalId" to intervalId,
            "notificationId" to notificationId,
            "settingsResolvable" to canOpenFullScreenIntentSettings(context),
            "triggeredAt" to triggeredAt,
          ),
        )
      }
  }

  private fun createExpiredHeadsUpRemoteViews(
    context: Context,
    expiredInterval: JSONObject,
    reviewText: String,
  ): RemoteViews {
    val triggeredAt = expiredInterval.optLongOrNull("triggeredAt") ?: System.currentTimeMillis()
    val remoteViews = RemoteViews(context.packageName, R.layout.notification_expired_compact)

    remoteViews.setTextViewText(R.id.notification_expired_title, "Time to Check-in!")
    remoteViews.setTextViewText(R.id.notification_expired_message, reviewText)
    remoteViews.setTextViewText(R.id.notification_expired_time, formatTime(triggeredAt))
    remoteViews.setOnClickPendingIntent(
      R.id.notification_expired_check_in,
      createCheckInPendingIntent(context, expiredInterval),
    )
    remoteViews.setOnClickPendingIntent(
      R.id.notification_expired_stop,
      createExpiredStopPendingIntent(context, expiredInterval),
    )

    return remoteViews
  }

  private fun playExpiredAlarm(context: Context, durationSeconds: Int) {
    stopExpiredAlarmPlayback()

    val alarmUri =
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        ?: run {
          logDebug("Skipped expired alarm playback because no system alarm URI was available")
          return
        }

    runCatching {
      RingtoneManager.getRingtone(context.applicationContext, alarmUri)?.apply {
        audioAttributes =
          AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          isLooping = true
        }
        play()
        activeAlarmRingtone = this
      }
    }.onSuccess {
      if (activeAlarmRingtone == null) {
        logDebug("Skipped expired alarm playback because no ringtone instance was available")
        return
      }

      val stopRunnable =
        Runnable {
          stopExpiredAlarmPlayback()
        }

      stopAlarmPlaybackRunnable = stopRunnable
      alarmPlaybackHandler.postDelayed(stopRunnable, durationSeconds * 1_000L)
      logDebug(
        "Started expired alarm playback durationSeconds=$durationSeconds uri=$alarmUri",
      )
    }.onFailure { error ->
      activeAlarmRingtone?.stop()
      activeAlarmRingtone = null
      logDebug("Failed to start expired alarm playback error=${error.message}")
    }
  }

  private fun emitState(document: JSONObject, reason: String, context: Context) {
    KidPointsNotificationsModule.instance?.emitState(document, reason, getRuntimeStatus(context))
  }

  private fun persistDocument(context: Context, documentJson: String) {
    val previousNotificationIds = getStoredDocument(context)
      ?.let { extractExpiredNotificationIds(JSONObject(it)) }
      ?: emptySet()
    val nextNotificationIds = extractExpiredNotificationIds(JSONObject(documentJson))

    previousNotificationIds
      .filterNot { nextNotificationIds.contains(it) }
      .forEach { notificationId ->
        NotificationManagerCompat.from(context).cancel(notificationId)
        logNotification(
          "Cancelled stale notification",
          createLogContext("notificationId" to notificationId),
        )
      }

    prefs(context)
      .edit()
      .putString(STORAGE_KEY, documentJson)
      .apply()

    prunePendingLaunchActionIfResolved(context, JSONObject(documentJson))
  }

  private fun prunePendingLaunchActionIfResolved(context: Context, document: JSONObject) {
    val pendingLaunchAction = getPendingLaunchAction(context) ?: return
    val intervalId = JSONObject(pendingLaunchAction).optString("intervalId").takeIf { it.isNotBlank() }
      ?: return

    val hasPendingInterval = getHead(document)
      .optJSONArray("expiredIntervals")
      ?.toJsonObjects()
      ?.any { expiredInterval -> expiredInterval.optString("intervalId") == intervalId }
      ?: false

    if (!hasPendingInterval) {
      prefs(context)
        .edit()
        .remove(PENDING_LAUNCH_ACTION_KEY)
        .apply()
      logIntent(
        "Pruned resolved pending launch action",
        createLogContext("intervalId" to intervalId),
      )
    }
  }

  private fun persistPendingLaunchAction(context: Context, actionJson: String) {
    prefs(context)
      .edit()
      .putString(PENDING_LAUNCH_ACTION_KEY, actionJson)
      .apply()
    logIntent(
      "Persisted pending launch action",
      createLogContext("payload" to parseJsonObjectOrRaw(actionJson)),
    )
  }

  private fun describeIntent(intent: Intent?): String {
    if (intent == null) {
      return "intent=null"
    }

    val launchPayload = intent.getStringExtra(EXTRA_LAUNCH_ACTION_JSON)

    return "intent.action=${intent.action} intent.flags=${intent.flags} hasLaunchPayload=${launchPayload != null} launchPayload=$launchPayload"
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun getHead(document: JSONObject): JSONObject =
    document.optJSONObject("head") ?: document

  private fun getOrCreateObject(parent: JSONObject, key: String): JSONObject {
    val current = parent.optJSONObject(key)
    if (current != null) {
      return current
    }

    val created = JSONObject()
    parent.put(key, created)
    return created
  }

  private fun getIntervalMs(head: JSONObject): Long {
    val config = getOrCreateObject(head, "timerConfig")
    val intervalMinutes = max(config.optInt("intervalMinutes", 15), 0)
    val intervalSeconds = config.optInt("intervalSeconds", 0).coerceIn(0, 59)
    return max(intervalMinutes * 60_000L + intervalSeconds * 1_000L, 1_000L)
  }

  private fun scheduleExactTrigger(context: Context, triggerAt: Long) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent =
      PendingIntent.getBroadcast(
        context,
        TRIGGER_REQUEST_CODE,
        Intent(context, NotificationsTriggerReceiver::class.java).apply {
          action = ACTION_TRIGGER
          putExtra(EXTRA_TRIGGER_AT, triggerAt)
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
      logDebug(
        "Scheduled inexact while-idle",
        createLogContext("triggerAt" to triggerAt),
      )
      return
    }

    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    logDebug("Scheduled exact", createLogContext("triggerAt" to triggerAt))
  }

  private fun cancelExactTrigger(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent =
      PendingIntent.getBroadcast(
        context,
        TRIGGER_REQUEST_CODE,
        Intent(context, NotificationsTriggerReceiver::class.java).apply {
          action = ACTION_TRIGGER
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    alarmManager.cancel(pendingIntent)
    pendingIntent.cancel()
    logDebug("Cancelled exact trigger")
  }

  private fun createOpenAppPendingIntent(context: Context): PendingIntent =
    PendingIntent.getActivity(
      context,
      OPEN_APP_REQUEST_CODE,
      createLaunchIntent(context),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      createBackgroundActivityStartOptionsBundle(),
    )

  private fun createCheckInPendingIntent(
    context: Context,
    expiredInterval: JSONObject,
  ): PendingIntent {
    val notificationId = expiredInterval.optInt("notificationId")
    val requestCode = CHECK_IN_REQUEST_CODE_BASE + (notificationId % 1_000)
    val actionJson = createCheckInLaunchAction(expiredInterval)

    logIntent(
      "Creating check-in pending intent",
      createLogContext(
        "intervalId" to expiredInterval.optString("intervalId"),
        "notificationId" to notificationId,
        "payload" to parseJsonObjectOrRaw(actionJson),
        "requestCode" to requestCode,
      ),
    )

    return PendingIntent.getActivity(
      context,
      requestCode,
      createLaunchIntent(context).apply {
        putExtra(EXTRA_LAUNCH_ACTION_JSON, actionJson)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      createBackgroundActivityStartOptionsBundle(),
    )
  }

  private fun createPauseTimerPendingIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      PAUSE_TIMER_REQUEST_CODE,
      Intent(context, NotificationsActionReceiver::class.java).apply {
        action = ACTION_PAUSE_TIMER
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun createStopTimerPendingIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      STOP_TIMER_REQUEST_CODE,
      Intent(context, NotificationsActionReceiver::class.java).apply {
        action = ACTION_STOP_TIMER
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun createExpiredStopPendingIntent(
    context: Context,
    expiredInterval: JSONObject,
  ): PendingIntent {
    val notificationId = expiredInterval.optInt("notificationId")
    val requestCode = STOP_EXPIRED_REQUEST_CODE_BASE + (notificationId % 1_000)

    return PendingIntent.getBroadcast(
      context,
      requestCode,
      Intent(context, NotificationsActionReceiver::class.java).apply {
        action = ACTION_STOP_TIMER
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun createLaunchIntent(context: Context): Intent =
    (context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_MAIN).apply {
        setPackage(context.packageName)
      }).apply {
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP,
      )
    }

  private fun createPromotedNotificationSettingsIntent(context: Context): Intent =
    Intent(Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS).apply {
      putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

  private fun createFullScreenIntentSettingsIntent(context: Context): Intent =
    Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
      data = android.net.Uri.parse("package:${context.packageName}")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

  private fun createBackgroundActivityStartOptionsBundle() =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ActivityOptions.makeBasic().apply {
        if (Build.VERSION.SDK_INT >= 36) {
          setPendingIntentCreatorBackgroundActivityStartMode(
            ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_ALWAYS,
          )
        } else {
          setPendingIntentCreatorBackgroundActivityStartMode(
            ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED,
          )
        }
      }.toBundle()
    } else {
      null
    }

  private fun ensureChannels(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    manager.createNotificationChannel(
      NotificationChannel(
        COUNTDOWN_CHANNEL_ID,
        "KidPoints countdown",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Shows the active KidPoints timer countdown."
        setShowBadge(false)
      },
    )
    manager.createNotificationChannel(
      NotificationChannel(
        EXPIRED_CHANNEL_ID,
        "KidPoints reminders",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Alerts you when a KidPoints timer needs a parent check-in."
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  private fun getCountdownChannel(context: Context): NotificationChannel? =
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .getNotificationChannel(COUNTDOWN_CHANNEL_ID)

  private fun getExpiredChannel(context: Context): NotificationChannel? =
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .getNotificationChannel(EXPIRED_CHANNEL_ID)

  private fun createExpiredInterval(
    head: JSONObject,
    runtime: JSONObject,
    triggerAt: Long,
  ): JSONObject? {
    val activeChildren = getOrCreateArray(head, "children")
      .toJsonObjects()
      .filterNot { child -> child.optBoolean("isArchived", false) }

    if (activeChildren.isEmpty()) {
      return null
    }

    val notificationId = ((triggerAt / 1000L) % 1_000_000_000L).toInt() + 5_000
    val intervalId =
      "interval-${runtime.optStringOrNull("sessionId").orEmpty().ifBlank { "session" }}-$triggerAt"
    val childActions = JSONArray()

    activeChildren.forEach { child ->
      childActions.put(
        JSONObject().apply {
          put("childId", child.optString("id"))
          put("childName", child.optString("displayName"))
          put("status", "pending")
        },
      )
    }

    val expiredInterval = JSONObject().apply {
      put("childActions", childActions)
      put("intervalId", intervalId)
      put("notificationId", notificationId)
      put("sessionId", runtime.optStringOrNull("sessionId") ?: JSONObject.NULL)
      put("triggeredAt", triggerAt)
    }
    val expiredIntervals = getOrCreateArray(head, "expiredIntervals")
    expiredIntervals.put(expiredInterval)

    return expiredInterval
  }

  private fun createCheckInLaunchAction(expiredInterval: JSONObject): String =
    JSONObject().apply {
      put("type", LAUNCH_ACTION_CHECK_IN)
      put("intervalId", expiredInterval.optString("intervalId"))
      put("notificationId", expiredInterval.optInt("notificationId"))
      put("sessionId", expiredInterval.optStringOrNull("sessionId") ?: JSONObject.NULL)
      put("triggeredAt", expiredInterval.optLongOrNull("triggeredAt") ?: JSONObject.NULL)
    }.toString()

  private fun extractExpiredNotificationIds(document: JSONObject): Set<Int> =
    getHead(document)
      .optJSONArray("expiredIntervals")
      ?.toJsonObjects()
      ?.mapNotNull { interval -> interval.optIntOrNull("notificationId") }
      ?.toSet()
      ?: emptySet()

  private fun getOrCreateArray(parent: JSONObject, key: String): JSONArray {
    val current = parent.optJSONArray(key)
    if (current != null) {
      return current
    }

    val created = JSONArray()
    parent.put(key, created)
    return created
  }

  private fun formatTime(timestamp: Long): String =
    DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(timestamp))

  private fun logDebug(message: String, context: JSONObject? = null) {
    log(LOG_TAG, message, context)
  }

  private fun logNotification(message: String, context: JSONObject? = null) {
    log(LOG_NOTIFICATION_TAG, message, context)
  }

  fun logIntent(message: String, context: JSONObject? = null) {
    log(LOG_INTENT_TAG, message, context)
  }

  private fun log(tag: String, message: String, context: JSONObject? = null) {
    NotificationNativeLogRelay.debug(tag, message, context?.toString())
  }
}

private fun createLogContext(vararg entries: Pair<String, Any?>): JSONObject =
  JSONObject().apply {
    entries.forEach { (key, value) ->
      put(key, value ?: JSONObject.NULL)
    }
  }

private fun parseJsonObjectOrRaw(json: String?): Any? =
  json?.let { rawJson ->
    runCatching { JSONObject(rawJson) }.getOrElse { rawJson }
  }

private fun JSONObject.optLongOrNull(key: String): Long? {
  if (isNull(key) || !has(key)) {
    return null
  }

  return optLong(key)
}

private fun JSONObject.optIntOrNull(key: String): Int? {
  if (isNull(key) || !has(key)) {
    return null
  }

  return optInt(key)
}

private fun JSONObject.optStringOrNull(key: String): String? {
  if (isNull(key) || !has(key)) {
    return null
  }

  return optString(key)
}

private fun JSONArray.toJsonObjects(): List<JSONObject> =
  List(length()) { index ->
    optJSONObject(index) ?: JSONObject()
  }
