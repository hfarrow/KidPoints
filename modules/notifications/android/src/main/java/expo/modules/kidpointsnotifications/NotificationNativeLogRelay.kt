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

  fun getBufferedLogs(afterSequence: Long = -1L): String {
    val entries = getBufferedEntries(afterSequence)

    return JSONArray().apply {
      entries.forEach { entry ->
        put(entry.toJsonObject())
      }
    }.toString()
  }

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

  fun temp(
    tag: String,
    message: String,
    contextJson: String? = null,
  ) {
    log("temp", tag, message, contextJson)
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

    logToLogcat(entry)
    emitToJavaScript(entry)
  }

  private fun emitToJavaScript(entry: NotificationNativeLogEntryPayload) {
    if (!isJsObservationEnabled) {
      return
    }

    mainHandler.post {
      val moduleInstance = KidPointsNotificationsModule.instance

      if (!isJsObservationEnabled) {
        return@post
      }

      if (moduleInstance == null) {
        return@post
      }

      moduleInstance.emitLog(entry)
    }
  }

  private fun getBufferedEntries(afterSequence: Long): List<NotificationNativeLogEntryPayload> =
    synchronized(lock) {
      buffer.filter { entry -> entry.sequence > afterSequence }
    }

  private fun logToLogcat(entry: NotificationNativeLogEntryPayload) {
    val renderedMessage =
      entry.contextJson?.let { contextJson ->
        "${entry.message} context=$contextJson"
      } ?: entry.message

    when (entry.level) {
      "error" -> Log.e(entry.tag, renderedMessage)
      "info" -> Log.i(entry.tag, renderedMessage)
      "temp" -> Log.d(entry.tag, "[TEMP] $renderedMessage")
      "warn" -> Log.w(entry.tag, renderedMessage)
      else -> Log.d(entry.tag, renderedMessage)
    }
  }

  private fun normalizeLevel(level: String): String =
    when (level) {
      "error", "info", "temp", "warn" -> level
      else -> "debug"
    }
}
