package expo.modules.kidpointsnotifications

import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicLong

private const val NATIVE_LOG_BUFFER_LIMIT = 200

data class NotificationNativeLogEntryPayload(
  val sequence: Long,
  val timestampMs: Long,
  val level: String,
  val tag: String,
  val message: String,
  val contextJson: String?,
) {
  fun toEventPayload(): Map<String, Any?> =
    mapOf(
      "contextJson" to contextJson,
      "level" to level,
      "message" to message,
      "sequence" to sequence.toDouble(),
      "tag" to tag,
      "timestampMs" to timestampMs.toDouble(),
    )

  fun toJsonObject(): JSONObject =
    JSONObject().apply {
      put("contextJson", contextJson ?: JSONObject.NULL)
      put("level", level)
      put("message", message)
      put("sequence", sequence)
      put("tag", tag)
      put("timestampMs", timestampMs)
    }
}

object NotificationNativeLogRelay {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val nextSequence = AtomicLong(0)
  private val lock = Any()
  private val buffer = ArrayDeque<NotificationNativeLogEntryPayload>()

  @Volatile
  private var isJsObservationEnabled = false

  fun setJsObservationEnabled(enabled: Boolean) {
    isJsObservationEnabled = enabled
  }

  fun getBufferedLogs(afterSequence: Long = -1L): String =
    JSONArray().apply {
      getBufferedEntries(afterSequence).forEach { entry ->
        put(entry.toJsonObject())
      }
    }.toString()

  fun debug(
    tag: String,
    message: String,
    contextJson: String? = null,
  ) {
    log("debug", tag, message, contextJson)
  }

  fun info(
    tag: String,
    message: String,
    contextJson: String? = null,
  ) {
    log("info", tag, message, contextJson)
  }

  fun warn(
    tag: String,
    message: String,
    contextJson: String? = null,
  ) {
    log("warn", tag, message, contextJson)
  }

  fun error(
    tag: String,
    message: String,
    contextJson: String? = null,
  ) {
    log("error", tag, message, contextJson)
  }

  fun log(
    level: String,
    tag: String,
    message: String,
    contextJson: String? = null,
  ) {
    val normalizedLevel = normalizeLevel(level)
    val entry =
      synchronized(lock) {
        NotificationNativeLogEntryPayload(
          sequence = nextSequence.incrementAndGet(),
          timestampMs = System.currentTimeMillis(),
          level = normalizedLevel,
          tag = tag,
          message = message,
          contextJson = contextJson,
        ).also { nextEntry ->
          if (buffer.size >= NATIVE_LOG_BUFFER_LIMIT) {
            buffer.removeFirst()
          }
          buffer.addLast(nextEntry)
        }
      }

    if (BuildConfig.DEBUG) {
      logToLogcat(entry)
    }

    emitToJavaScript(entry)
  }

  private fun emitToJavaScript(entry: NotificationNativeLogEntryPayload) {
    if (!isJsObservationEnabled) {
      return
    }

    mainHandler.post {
      if (!isJsObservationEnabled) {
        return@post
      }

      KidPointsNotificationsModule.instance?.emitLog(entry)
    }
  }

  private fun getBufferedEntries(afterSequence: Long): List<NotificationNativeLogEntryPayload> =
    synchronized(lock) {
      buffer.filter { entry -> entry.sequence > afterSequence }
    }

  private fun logToLogcat(entry: NotificationNativeLogEntryPayload) {
    when (entry.level) {
      "error" -> Log.e(entry.tag, entry.message)
      "info" -> Log.i(entry.tag, entry.message)
      "warn" -> Log.w(entry.tag, entry.message)
      else -> Log.d(entry.tag, entry.message)
    }
  }

  private fun normalizeLevel(level: String): String =
    when (level) {
      "error", "info", "warn" -> level
      else -> "debug"
    }
}
