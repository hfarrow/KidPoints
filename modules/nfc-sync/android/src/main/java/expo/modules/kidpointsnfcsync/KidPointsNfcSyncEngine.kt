package expo.modules.kidpointsnfcsync

import android.app.Activity
import android.content.Context
import android.nfc.cardemulation.CardEmulation
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.AppContext
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.Executors

private const val TAG = "KidPointsNfcSync"
private const val HCE_WINDOW_MS = 1500L
private const val READER_WINDOW_MS = 700L
private const val DEFAULT_TIMEOUT_MS = 30_000L
private const val ISO_DEP_TIMEOUT_MS = 2_000
private const val MIN_TIMEOUT_MS = 1_000L
private const val SWEEP_TICK_MS = 100L

object KidPointsNfcSyncEngine {
  const val KIDPOINTS_SYNC_AID = "F04B4944504F494E545301"

  private val secureRandom = SecureRandom()
  private val backgroundExecutor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())

  private var module: KidPointsNfcSyncModule? = null
  private var currentActivity: Activity? = null
  private var activeBootstrap: ActiveBootstrap? = null

  private val sweepRunnable =
    object : Runnable {
      override fun run() {
        refreshSweep()
      }
    }

  private val timeoutRunnable =
    Runnable {
      failActiveBootstrap("timeout", "Keep both phones together and try again.")
    }

  fun attachModule(module: KidPointsNfcSyncModule) {
    this.module = module
    KidPointsNfcSyncModule.nativeLogRelay.debug(TAG, "NFC sync module attached")
  }

  fun detachModule(module: KidPointsNfcSyncModule) {
    if (this.module === module) {
      this.module = null
    }
    KidPointsNfcSyncModule.nativeLogRelay.debug(TAG, "NFC sync module detached")
  }

  fun onActivityCreated(activity: Activity?) {
    currentActivity = activity
    KidPointsNfcSyncModule.nativeLogRelay.debug(
      TAG,
      "NFC activity created",
      buildContextJson(
        "activity" to activity?.javaClass?.simpleName,
      ),
    )
  }

  fun onActivityResumed(activity: Activity?) {
    currentActivity = activity
    KidPointsNfcSyncModule.nativeLogRelay.debug(
      TAG,
      "NFC activity resumed",
      buildContextJson(
        "activity" to activity?.javaClass?.simpleName,
      ),
    )

    if (activeBootstrap != null) {
      refreshSweep()
    }
  }

  fun onActivityPaused(activity: Activity?) {
    if (currentActivity === activity && activity != null) {
      KidPointsNfcSyncModule.nativeLogRelay.debug(
        TAG,
        "NFC activity paused",
        buildContextJson(
          "activity" to activity.javaClass.simpleName,
        ),
      )
      disableReaderMode(activity)
    }
  }

  fun onActivityDestroyed(activity: Activity?) {
    if (currentActivity === activity && activity != null) {
      KidPointsNfcSyncModule.nativeLogRelay.debug(
        TAG,
        "NFC activity destroyed",
        buildContextJson(
          "activity" to activity.javaClass.simpleName,
        ),
      )
      disableReaderMode(activity)
      currentActivity = null
    }
  }

  fun buildAvailabilityPayload(context: Context?): Map<String, Any?> {
    if (context == null) {
      return mapOf(
        "hasAdapter" to false,
        "isEnabled" to false,
        "isReady" to false,
        "reason" to "activity-unavailable",
        "supportsHce" to false,
        "supportsReaderMode" to false,
      )
    }

    val packageManager = context.packageManager
    val adapter = NfcAdapter.getDefaultAdapter(context)
    val hasAdapter = adapter != null
    val isEnabled = adapter?.isEnabled == true
    val supportsHce =
      packageManager.hasSystemFeature("android.hardware.nfc.hce") ||
        packageManager.hasSystemFeature("android.hardware.nfc.hcef")
    val supportsReaderMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
    val reason =
      when {
        !hasAdapter -> "nfc-unavailable"
        !isEnabled -> "nfc-disabled"
        !supportsHce -> "hce-unsupported"
        !supportsReaderMode -> "reader-mode-unsupported"
        else -> "ready"
      }

    return mapOf(
      "hasAdapter" to hasAdapter,
      "isEnabled" to isEnabled,
      "isReady" to (reason == "ready"),
      "reason" to reason,
      "supportsHce" to supportsHce,
      "supportsReaderMode" to supportsReaderMode,
    )
  }

  fun beginBootstrap(appContext: AppContext, localDeviceId: String, timeoutMs: Long) {
    val activity = appContext.currentActivity ?: currentActivity
    if (activity != null) {
      currentActivity = activity
    }
    val context = activity?.applicationContext ?: appContext.reactContext ?: currentActivity?.applicationContext
    val availability = buildAvailabilityPayload(context)

    if (availability["isReady"] != true) {
      KidPointsNfcSyncModule.nativeLogRelay.warn(
        TAG,
        "NFC bootstrap rejected by availability check",
        buildContextJson(
          "activityPresent" to (activity != null),
          "reason" to availability["reason"],
        ),
      )
      emitBootstrapState(
        attemptId = null,
        failureReason = availability["reason"] as String,
        message = "NFC bootstrap is not ready on this device.",
        phase = "error",
        role = null,
      )
      return
    }

    cancelBootstrap(appContext)

    val effectiveTimeoutMs = timeoutMs.coerceAtLeast(MIN_TIMEOUT_MS)
    val attemptId = "nfc-${java.lang.Long.toString(SystemClock.elapsedRealtime(), 36)}"
    val localDeviceHash = hashHex(localDeviceId, 8)
    val localNonce = randomHex(8)
    val cycleMs = HCE_WINDOW_MS + READER_WINDOW_MS
    val phaseOffsetMs = hashHex(localDeviceId, 2).toInt(16).toLong() % cycleMs

    activeBootstrap =
      ActiveBootstrap(
        attemptId = attemptId,
        localDeviceHash = localDeviceHash,
        localNonce = localNonce,
        phaseOffsetMs = phaseOffsetMs,
        startedAtElapsedMs = SystemClock.elapsedRealtime(),
        timeoutMs = effectiveTimeoutMs,
      )

    KidPointsNfcSyncModule.nativeLogRelay.info(
      TAG,
      "NFC bootstrap started",
      buildContextJson(
        "attemptId" to attemptId,
        "activityPresent" to (activity != null),
        "localDeviceHash" to localDeviceHash,
        "timeoutMs" to effectiveTimeoutMs,
      ),
    )

    emitBootstrapState(
      attemptId = attemptId,
      failureReason = null,
      message = "Hold both phones together to start sync.",
      phase = "starting",
      role = null,
    )

    mainHandler.removeCallbacks(timeoutRunnable)
    mainHandler.postDelayed(timeoutRunnable, effectiveTimeoutMs)
    refreshSweep()
  }

  fun cancelBootstrap(appContext: AppContext) {
    val context =
      appContext.currentActivity?.applicationContext ?: appContext.reactContext ?: currentActivity?.applicationContext
    val bootstrap = activeBootstrap ?: return

    activeBootstrap = null
    mainHandler.removeCallbacks(timeoutRunnable)
    mainHandler.removeCallbacks(sweepRunnable)
    currentActivity?.let { disableReaderMode(it) }

    KidPointsNfcSyncModule.nativeLogRelay.info(
      TAG,
      "NFC bootstrap canceled",
      buildContextJson("attemptId" to bootstrap.attemptId),
    )

    if (context != null) {
      emitBootstrapState(
        attemptId = bootstrap.attemptId,
        failureReason = "canceled",
        message = "NFC bootstrap canceled.",
        phase = "idle",
        role = null,
      )
    }
  }

  fun onReaderDeselected(reason: Int) {
    val bootstrap = activeBootstrap ?: return

    KidPointsNfcSyncModule.nativeLogRelay.debug(
      TAG,
      "NFC reader deselected",
      buildContextJson(
        "attemptId" to bootstrap.attemptId,
        "reason" to reason,
      ),
    )
  }

  fun processCommandApdu(commandApdu: ByteArray?): ByteArray {
    val bootstrap = activeBootstrap ?: return STATUS_FILE_NOT_FOUND
    val bytes = commandApdu ?: return STATUS_WRONG_LENGTH

    if (isSelectAidApdu(bytes)) {
      KidPointsNfcSyncModule.nativeLogRelay.debug(
        TAG,
        "Received NFC AID select",
        buildContextJson("attemptId" to bootstrap.attemptId),
      )
      return STATUS_SUCCESS
    }

    val initCommand = parseInitCommand(bytes) ?: return STATUS_COMMAND_NOT_ALLOWED

    KidPointsNfcSyncModule.nativeLogRelay.info(
      TAG,
      "Received NFC bootstrap init command",
      buildContextJson(
        "attemptId" to bootstrap.attemptId,
        "remoteDeviceHash" to initCommand.remoteDeviceHash,
      ),
    )

    if (initCommand.protocolVersion != 1) {
      return STATUS_COMMAND_NOT_ALLOWED
    }

    val bootstrapToken =
      deriveBootstrapToken(
        bootstrap.localDeviceHash,
        bootstrap.localNonce,
        initCommand.remoteDeviceHash,
        initCommand.remoteNonce,
      )

    completeActiveBootstrap(
      bootstrap = bootstrap,
      bootstrapToken = bootstrapToken,
      peerDeviceHash = initCommand.remoteDeviceHash,
      role = "host",
    )

    return buildAckApdu(
      localDeviceHash = bootstrap.localDeviceHash,
      localNonce = bootstrap.localNonce,
    )
  }

  private fun refreshSweep() {
    val bootstrap = activeBootstrap ?: return
    val activity = currentActivity

    if (activity == null) {
      KidPointsNfcSyncModule.nativeLogRelay.debug(
        TAG,
        "NFC sweep waiting for a foreground activity",
        buildContextJson("attemptId" to bootstrap.attemptId),
      )
      emitBootstrapState(
        attemptId = bootstrap.attemptId,
        failureReason = null,
        message = "Keep the sync screen open while NFC arms itself.",
        phase = "waiting-for-activity",
        role = null,
      )
      mainHandler.postDelayed(sweepRunnable, SWEEP_TICK_MS)
      return
    }

    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: run {
      failActiveBootstrap("nfc-unavailable", "This device cannot use NFC sync.")
      return
    }

    KidPointsNfcSyncModule.nativeLogRelay.debug(
      TAG,
      "Refreshing NFC sweep",
      buildContextJson(
        "attemptId" to bootstrap.attemptId,
        "adapterEnabled" to adapter.isEnabled,
        "mode" to bootstrap.mode,
      ),
    )

    if (!adapter.isEnabled) {
      failActiveBootstrap("nfc-disabled", "Turn on NFC and try again.")
      return
    }

    val cycleMs = HCE_WINDOW_MS + READER_WINDOW_MS
    val elapsedMs =
      (SystemClock.elapsedRealtime() - bootstrap.startedAtElapsedMs + bootstrap.phaseOffsetMs) % cycleMs

    if (elapsedMs < HCE_WINDOW_MS) {
      if (bootstrap.mode != BootstrapMode.HCE) {
        disableReaderMode(activity)
        setPreferredService(activity)
        activeBootstrap = bootstrap.copy(mode = BootstrapMode.HCE)
        KidPointsNfcSyncModule.nativeLogRelay.info(
          TAG,
          "NFC sweep entered HCE window",
          buildContextJson("attemptId" to bootstrap.attemptId),
        )
        emitBootstrapState(
          attemptId = bootstrap.attemptId,
          failureReason = null,
          message = "Hold both phones together while KidPoints listens for a tap.",
          phase = "hce-active",
          role = null,
        )
      }
      mainHandler.postDelayed(sweepRunnable, (HCE_WINDOW_MS - elapsedMs).coerceAtLeast(SWEEP_TICK_MS))
      return
    }

    if (bootstrap.mode != BootstrapMode.READER) {
      enableReaderMode(activity)
      activeBootstrap = bootstrap.copy(mode = BootstrapMode.READER)
      KidPointsNfcSyncModule.nativeLogRelay.info(
        TAG,
        "NFC sweep entered reader window",
        buildContextJson("attemptId" to bootstrap.attemptId),
      )
      emitBootstrapState(
        attemptId = bootstrap.attemptId,
        failureReason = null,
        message = "Hold both phones together while KidPoints scans for its partner.",
        phase = "reader-active",
        role = null,
      )
    }
    mainHandler.postDelayed(
      sweepRunnable,
      (cycleMs - elapsedMs).coerceAtLeast(SWEEP_TICK_MS),
    )
  }

  private fun enableReaderMode(activity: Activity) {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return
    val flags =
      NfcAdapter.FLAG_READER_NFC_A or
        NfcAdapter.FLAG_READER_NFC_B or
        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
        NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS

    activity.runOnUiThread {
      runCatching {
        adapter.enableReaderMode(
          activity,
          { tag -> handleTagDiscovered(tag) },
          flags,
          null,
        )
        KidPointsNfcSyncModule.nativeLogRelay.debug(
          TAG,
          "NFC reader mode enabled",
          buildContextJson(
            "activity" to activity.javaClass.simpleName,
            "flags" to flags,
          ),
        )
      }.onFailure { error ->
        KidPointsNfcSyncModule.nativeLogRelay.warn(
          TAG,
          "Failed to enable NFC reader mode",
          buildContextJson(
            "activity" to activity.javaClass.simpleName,
            "error" to error.message,
          ),
        )
      }
    }
  }

  private fun disableReaderMode(activity: Activity) {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return

    activity.runOnUiThread {
      runCatching {
        adapter.disableReaderMode(activity)
        clearPreferredService(activity)
        KidPointsNfcSyncModule.nativeLogRelay.debug(
          TAG,
          "NFC reader mode disabled",
          buildContextJson("activity" to activity.javaClass.simpleName),
        )
      }.onFailure { error ->
        KidPointsNfcSyncModule.nativeLogRelay.debug(
          TAG,
          "Failed to disable NFC reader mode cleanly",
          buildContextJson(
            "activity" to activity.javaClass.simpleName,
            "error" to error.message,
          ),
        )
      }
    }
  }

  private fun setPreferredService(activity: Activity) {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return
    val cardEmulation =
      runCatching {
        CardEmulation.getInstance(adapter)
      }.getOrNull() ?: return
    val componentName =
      android.content.ComponentName(
        activity,
        KidPointsNfcSyncBootstrapService::class.java,
      )

    runCatching {
      cardEmulation.setPreferredService(activity, componentName)
      KidPointsNfcSyncModule.nativeLogRelay.debug(
        TAG,
        "Preferred HCE service set for foreground activity",
        buildContextJson(
          "activity" to activity.javaClass.simpleName,
          "component" to componentName.className,
        ),
      )
    }.onFailure { error ->
      KidPointsNfcSyncModule.nativeLogRelay.debug(
        TAG,
        "Unable to set preferred HCE service",
        buildContextJson(
          "activity" to activity.javaClass.simpleName,
          "error" to error.message,
        ),
      )
    }
  }

  private fun clearPreferredService(activity: Activity) {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return
    val cardEmulation =
      runCatching {
        CardEmulation.getInstance(adapter)
      }.getOrNull() ?: return

    runCatching {
      cardEmulation.unsetPreferredService(activity)
    }
  }

  private fun handleTagDiscovered(tag: Tag) {
    val bootstrap = activeBootstrap ?: return

    KidPointsNfcSyncModule.nativeLogRelay.info(
      TAG,
      "NFC tag discovered during reader window",
      buildContextJson(
        "attemptId" to bootstrap.attemptId,
        "techList" to tag.techList.joinToString("|"),
      ),
    )

    backgroundExecutor.execute {
      val isoDep = IsoDep.get(tag)

      if (isoDep == null) {
        KidPointsNfcSyncModule.nativeLogRelay.debug(
          TAG,
          "Ignoring unsupported NFC tag technology",
          buildContextJson("attemptId" to bootstrap.attemptId),
        )
        return@execute
      }

      try {
        isoDep.connect()
        isoDep.timeout = ISO_DEP_TIMEOUT_MS

        KidPointsNfcSyncModule.nativeLogRelay.info(
          TAG,
          "NFC reader connected to ISO-DEP tag",
          buildContextJson(
            "attemptId" to bootstrap.attemptId,
            "timeoutMs" to ISO_DEP_TIMEOUT_MS,
          ),
        )

        val selectResponse = isoDep.transceive(buildSelectAidApdu())

        if (!endsWithSuccessStatus(selectResponse)) {
          KidPointsNfcSyncModule.nativeLogRelay.warn(
            TAG,
            "NFC partner did not accept KidPoints AID selection",
            buildContextJson(
              "attemptId" to bootstrap.attemptId,
              "statusWord" to selectResponse.toHexString(),
            ),
          )
          return@execute
        }

        KidPointsNfcSyncModule.nativeLogRelay.info(
          TAG,
          "NFC partner accepted KidPoints AID selection",
          buildContextJson(
            "attemptId" to bootstrap.attemptId,
            "statusWord" to selectResponse.toHexString(),
          ),
        )

        val ackResponse =
          isoDep.transceive(
            buildInitApdu(
              localDeviceHash = bootstrap.localDeviceHash,
              localNonce = bootstrap.localNonce,
            ),
          )
        KidPointsNfcSyncModule.nativeLogRelay.info(
          TAG,
          "NFC bootstrap ack response received",
          buildContextJson(
            "ackResponse" to ackResponse.toHexString(),
            "attemptId" to bootstrap.attemptId,
          ),
        )

        val ack =
          parseAckApdu(ackResponse) ?: run {
            KidPointsNfcSyncModule.nativeLogRelay.warn(
              TAG,
              "NFC bootstrap ack response could not be parsed",
              buildContextJson(
                "ackResponse" to ackResponse.toHexString(),
                "attemptId" to bootstrap.attemptId,
              ),
            )
            return@execute
          }
        val bootstrapToken =
          deriveBootstrapToken(
            bootstrap.localDeviceHash,
            bootstrap.localNonce,
            ack.remoteDeviceHash,
            ack.remoteNonce,
          )

        completeActiveBootstrap(
          bootstrap = bootstrap,
          bootstrapToken = bootstrapToken,
          peerDeviceHash = ack.remoteDeviceHash,
          role = "join",
        )
      } catch (error: Exception) {
        KidPointsNfcSyncModule.nativeLogRelay.warn(
          TAG,
          "NFC reader attempt failed",
          buildContextJson(
            "attemptId" to bootstrap.attemptId,
            "errorType" to error.javaClass.simpleName,
            "error" to error.message,
          ),
        )
      } finally {
        runCatching {
          isoDep.close()
        }
      }
    }
  }

  private fun completeActiveBootstrap(
    bootstrap: ActiveBootstrap,
    bootstrapToken: String,
    peerDeviceHash: String,
    role: String,
  ) {
    val active = activeBootstrap ?: return

    if (active.attemptId != bootstrap.attemptId || active.completed) {
      return
    }

    activeBootstrap = active.copy(completed = true)
    mainHandler.removeCallbacks(timeoutRunnable)
    mainHandler.removeCallbacks(sweepRunnable)
    currentActivity?.let { disableReaderMode(it) }

    KidPointsNfcSyncModule.nativeLogRelay.info(
      TAG,
      "NFC bootstrap completed",
      buildContextJson(
        "attemptId" to bootstrap.attemptId,
        "bootstrapTokenPrefix" to bootstrapToken.take(14),
        "peerDeviceHash" to peerDeviceHash,
        "role" to role,
      ),
    )

    emitBootstrapState(
      attemptId = bootstrap.attemptId,
      failureReason = null,
      message = "Phones matched. Starting nearby sync.",
      phase = "completed",
      role = role,
    )
    module?.emitBootstrapCompleted(
      mapOf(
        "attemptId" to bootstrap.attemptId,
        "bootstrapToken" to bootstrapToken,
        "peerDeviceHash" to peerDeviceHash,
        "role" to role,
      ),
    )

    activeBootstrap = null
  }

  private fun failActiveBootstrap(reason: String, message: String) {
    val bootstrap = activeBootstrap ?: return

    activeBootstrap = null
    mainHandler.removeCallbacks(timeoutRunnable)
    mainHandler.removeCallbacks(sweepRunnable)
    currentActivity?.let { disableReaderMode(it) }

    KidPointsNfcSyncModule.nativeLogRelay.warn(
      TAG,
      "NFC bootstrap failed",
      buildContextJson(
        "attemptId" to bootstrap.attemptId,
        "reason" to reason,
      ),
    )

    emitBootstrapState(
      attemptId = bootstrap.attemptId,
      failureReason = reason,
      message = message,
      phase = "error",
      role = null,
    )
  }

  private fun emitBootstrapState(
    attemptId: String?,
    failureReason: String?,
    message: String,
    phase: String,
    role: String?,
  ) {
    module?.emitBootstrapStateChanged(
      mapOf(
        "attemptId" to attemptId,
        "failureReason" to failureReason,
        "message" to message,
        "phase" to phase,
        "role" to role,
      ),
    )
  }

  private fun buildSelectAidApdu(): ByteArray {
    return buildSelectAidApdu(KIDPOINTS_SYNC_AID)
  }

  private fun buildInitApdu(localDeviceHash: String, localNonce: String): ByteArray {
    val payload = byteArrayOf(0x01) + localDeviceHash.hexToByteArray() + localNonce.hexToByteArray()

    return byteArrayOf(
      0x80.toByte(),
      0x10,
      0x00,
      0x00,
      payload.size.toByte(),
    ) + payload
  }

  private fun buildAckApdu(localDeviceHash: String, localNonce: String): ByteArray {
    return buildAckApduResponse(localDeviceHash, localNonce)
  }

  private fun parseInitCommand(commandApdu: ByteArray): InitCommand? {
    if (commandApdu.size < 5 || commandApdu[0] != 0x80.toByte() || commandApdu[1] != 0x10.toByte()) {
      return null
    }

    val payloadLength = commandApdu[4].toInt() and 0xFF

    if (commandApdu.size < 5 + payloadLength || payloadLength != 17) {
      return null
    }

    val payload = commandApdu.copyOfRange(5, 5 + payloadLength)

    return InitCommand(
      protocolVersion = payload[0].toInt() and 0xFF,
      remoteDeviceHash = payload.copyOfRange(1, 9).toHexString(),
      remoteNonce = payload.copyOfRange(9, 17).toHexString(),
    )
  }

  private fun parseAckApdu(responseApdu: ByteArray): AckCommand? {
    val parsed = parseAckApduResponse(responseApdu) ?: return null
    return AckCommand(
      remoteDeviceHash = parsed.remoteDeviceHash,
      remoteNonce = parsed.remoteNonce,
    )
  }

  private fun isSelectAidApdu(commandApdu: ByteArray): Boolean {
    return expo.modules.kidpointsnfcsync.isSelectAidApdu(commandApdu, KIDPOINTS_SYNC_AID)
  }

  private fun endsWithSuccessStatus(bytes: ByteArray): Boolean {
    return bytes.size >= 2 &&
      bytes[bytes.size - 2] == STATUS_SUCCESS[0] &&
      bytes[bytes.size - 1] == STATUS_SUCCESS[1]
  }

  private fun deriveBootstrapToken(
    localDeviceHash: String,
    localNonce: String,
    remoteDeviceHash: String,
    remoteNonce: String,
  ): String {
    val left = "$localDeviceHash:$localNonce"
    val right = "$remoteDeviceHash:$remoteNonce"
    val ordered = listOf(left, right).sorted().joinToString("|")
    return hashHex("kidpoints-nfc|$ordered", 16)
  }

  private fun hashHex(value: String, byteCount: Int): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return digest.copyOfRange(0, byteCount).toHexString()
  }

  private fun randomHex(byteCount: Int): String {
    val bytes = ByteArray(byteCount)
    secureRandom.nextBytes(bytes)
    return bytes.toHexString()
  }

  private fun buildContextJson(vararg pairs: Pair<String, Any?>): String {
    return buildString {
      append("{")
      pairs.forEachIndexed { index, pair ->
        if (index > 0) {
          append(",")
        }
        append("\"")
        append(pair.first)
        append("\":\"")
        append(pair.second?.toString()?.replace("\"", "\\\"") ?: "null")
        append("\"")
      }
      append("}")
    }
  }
}

private data class ActiveBootstrap(
  val attemptId: String,
  val completed: Boolean = false,
  val localDeviceHash: String,
  val localNonce: String,
  val mode: BootstrapMode = BootstrapMode.IDLE,
  val phaseOffsetMs: Long,
  val startedAtElapsedMs: Long,
  val timeoutMs: Long,
)

private enum class BootstrapMode {
  HCE,
  IDLE,
  READER,
}

private data class InitCommand(
  val protocolVersion: Int,
  val remoteDeviceHash: String,
  val remoteNonce: String,
)

private data class AckCommand(
  val remoteDeviceHash: String,
  val remoteNonce: String,
)

private val STATUS_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())
private val STATUS_FILE_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
private val STATUS_COMMAND_NOT_ALLOWED = byteArrayOf(0x69.toByte(), 0x86.toByte())
private val STATUS_WRONG_LENGTH = byteArrayOf(0x67.toByte(), 0x00.toByte())
