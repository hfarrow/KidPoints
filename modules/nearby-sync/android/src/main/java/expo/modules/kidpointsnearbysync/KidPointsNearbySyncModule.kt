package expo.modules.kidpointsnearbysync

import android.content.Context
import android.net.Uri
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import com.google.android.gms.tasks.Tasks
import expo.modules.kidpointsnativelogsync.NativeLogEntryPayload
import expo.modules.kidpointsnativelogsync.NativeLogRelay
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File

class KidPointsNearbySyncModule : Module() {
  companion object {
    var instance: KidPointsNearbySyncModule? = null
    private const val TAG = "KidPointsNearbySync"
    val nativeLogRelay =
      NativeLogRelay { entry ->
        instance?.emitLog(entry)
      }
  }

  private val discoveredEndpoints = linkedMapOf<String, String>()
  private val endpointNamesById = mutableMapOf<String, String>()
  private val pendingConnectionsById = mutableMapOf<String, ConnectionInfo>()
  private val incomingFilePayloads = mutableMapOf<Long, Payload>()
  private var advertisedSessionLabel: String? = null
  private var localEndpointName: String = "KidPoints"

  private fun serviceId(context: Context): String = "${context.packageName}.kidpoints.sync"

  private fun connectionsClient(context: Context): ConnectionsClient =
    Nearby.getConnectionsClient(context)

  override fun definition() = ModuleDefinition {
    Name("KidPointsNearbySync")

    Events(
      "KidPointsNearbySyncAuthTokenReady",
      "KidPointsNearbySyncAvailabilityChanged",
      "KidPointsNearbySyncConnectionRequested",
      "KidPointsNearbySyncConnectionStateChanged",
      "KidPointsNearbySyncDiscoveryUpdated",
      "KidPointsNearbySyncEnvelopeReceived",
      "KidPointsNearbySyncError",
      "KidPointsNearbySyncLog",
      "KidPointsNearbySyncPayloadProgress",
    )

    OnCreate {
      instance = this@KidPointsNearbySyncModule
    }

    OnStartObserving {
      nativeLogRelay.setJsObservationEnabled(true)
      appContext.reactContext?.let { emitAvailabilityChanged(it) }
    }

    OnStopObserving {
      nativeLogRelay.setJsObservationEnabled(false)
    }

    OnDestroy {
      if (instance === this@KidPointsNearbySyncModule) {
        instance = null
      }

      nativeLogRelay.setJsObservationEnabled(false)
      appContext.reactContext?.let {
        stopAllInternal(it)
      }
    }

    Function("getBufferedLogs") { afterSequence: Double ->
      nativeLogRelay.getBufferedLogs(afterSequence.toLong())
    }

    AsyncFunction("getAvailabilityStatus") {
      buildAvailabilityPayload(appContext.reactContext)
    }

    AsyncFunction("startHosting") { sessionLabel: String, nextLocalEndpointName: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      stopAllInternal(context)
      advertisedSessionLabel = sessionLabel
      localEndpointName = nextLocalEndpointName

      nativeLogRelay.info(
        TAG,
        "Starting advertising",
        buildContextJson(
          "localEndpointName" to localEndpointName,
          "sessionLabel" to sessionLabel,
        ),
      )

      val options = AdvertisingOptions.Builder()
        .setStrategy(Strategy.P2P_POINT_TO_POINT)
        .build()

      Tasks.await(
        connectionsClient(context).startAdvertising(
          sessionLabel,
          serviceId(context),
          connectionLifecycleCallback,
          options,
        ),
      )
      emitAvailabilityChanged(context)
    }

    AsyncFunction("startDiscovery") { nextLocalEndpointName: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      stopAllInternal(context)
      localEndpointName = nextLocalEndpointName

      nativeLogRelay.info(
        TAG,
        "Starting discovery",
        buildContextJson(
          "localEndpointName" to localEndpointName,
        ),
      )

      val options = DiscoveryOptions.Builder()
        .setStrategy(Strategy.P2P_POINT_TO_POINT)
        .build()

      Tasks.await(
        connectionsClient(context).startDiscovery(
          serviceId(context),
          endpointDiscoveryCallback,
          options,
        ),
      )
      emitAvailabilityChanged(context)
    }

    AsyncFunction("requestConnection") { endpointId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      nativeLogRelay.info(
        TAG,
        "Requesting connection",
        buildContextJson(
          "endpointId" to endpointId,
          "localEndpointName" to localEndpointName,
        ),
      )

      Tasks.await(
        connectionsClient(context).requestConnection(
          localEndpointName,
          endpointId,
          connectionLifecycleCallback,
        ),
      )
      emitConnectionStateChanged(
        endpointId = endpointId,
        endpointName = endpointNamesById[endpointId] ?: discoveredEndpoints[endpointId] ?: "",
        state = "connecting",
        reason = null,
      )
    }

    AsyncFunction("acceptConnection") { endpointId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      nativeLogRelay.info(
        TAG,
        "Accepting connection",
        buildContextJson("endpointId" to endpointId),
      )
      Tasks.await(
        connectionsClient(context).acceptConnection(endpointId, payloadCallback),
      )
    }

    AsyncFunction("rejectConnection") { endpointId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      nativeLogRelay.info(
        TAG,
        "Rejecting connection",
        buildContextJson("endpointId" to endpointId),
      )
      Tasks.await(connectionsClient(context).rejectConnection(endpointId))
      emitConnectionStateChanged(
        endpointId = endpointId,
        endpointName = endpointNamesById[endpointId] ?: "",
        state = "rejected",
        reason = "local-reject",
      )
    }

    AsyncFunction("sendEnvelope") { endpointId: String, envelopeJson: String ->
      val context = appContext.reactContext ?: return@AsyncFunction (-1).toDouble()
      val payload = Payload.fromBytes(envelopeJson.toByteArray(Charsets.UTF_8))

      nativeLogRelay.debug(
        TAG,
        "Sending bytes payload",
        buildContextJson(
          "endpointId" to endpointId,
          "payloadId" to payload.id,
        ),
      )

      Tasks.await(connectionsClient(context).sendPayload(endpointId, payload))
      payload.id.toDouble()
    }

    AsyncFunction("sendFile") { endpointId: String, fileUri: String ->
      val context = appContext.reactContext ?: return@AsyncFunction (-1).toDouble()
      val filePayload = Payload.fromFile(resolveFile(fileUri))

      nativeLogRelay.info(
        TAG,
        "Sending file payload",
        buildContextJson(
          "endpointId" to endpointId,
          "fileUri" to fileUri,
          "payloadId" to filePayload.id,
        ),
      )

      Tasks.await(connectionsClient(context).sendPayload(endpointId, filePayload))
      filePayload.id.toDouble()
    }

    AsyncFunction("disconnect") { endpointId: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction

      if (endpointId.isNullOrBlank()) {
        nativeLogRelay.info(TAG, "Disconnecting all endpoints")
        connectionsClient(context).stopAllEndpoints()
        return@AsyncFunction
      }

      nativeLogRelay.info(
        TAG,
        "Disconnecting endpoint",
        buildContextJson("endpointId" to endpointId),
      )
      connectionsClient(context).disconnectFromEndpoint(endpointId)
    }

    AsyncFunction("stopAll") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      stopAllInternal(context)
      emitAvailabilityChanged(context)
      null
    }
  }

  private val endpointDiscoveryCallback =
    object : EndpointDiscoveryCallback() {
      override fun onEndpointFound(
        endpointId: String,
        discoveredEndpointInfo: DiscoveredEndpointInfo,
      ) {
        discoveredEndpoints[endpointId] = discoveredEndpointInfo.endpointName
        endpointNamesById[endpointId] = discoveredEndpointInfo.endpointName
        nativeLogRelay.info(
          TAG,
          "Endpoint discovered",
          buildContextJson(
            "endpointId" to endpointId,
            "endpointName" to discoveredEndpointInfo.endpointName,
          ),
        )
        emitDiscoveryUpdated()
      }

      override fun onEndpointLost(endpointId: String) {
        val endpointName = discoveredEndpoints.remove(endpointId)
        endpointNamesById.remove(endpointId)
        nativeLogRelay.warn(
          TAG,
          "Endpoint lost",
          buildContextJson(
            "endpointId" to endpointId,
            "endpointName" to endpointName,
          ),
        )
        emitDiscoveryUpdated()
      }
    }

  private val connectionLifecycleCallback =
    object : ConnectionLifecycleCallback() {
      override fun onConnectionInitiated(endpointId: String, connectionInfo: ConnectionInfo) {
        endpointNamesById[endpointId] = connectionInfo.endpointName
        pendingConnectionsById[endpointId] = connectionInfo
        nativeLogRelay.info(
          TAG,
          "Connection initiated",
          buildContextJson(
            "authToken" to connectionInfo.authenticationToken,
            "endpointId" to endpointId,
            "endpointName" to connectionInfo.endpointName,
            "incoming" to connectionInfo.isIncomingConnection,
          ),
        )

        emitConnectionRequested(endpointId, connectionInfo.endpointName)
        emitAuthTokenReady(
          endpointId = endpointId,
          endpointName = connectionInfo.endpointName,
          authToken = connectionInfo.authenticationToken,
          isIncomingConnection = connectionInfo.isIncomingConnection,
        )
        emitConnectionStateChanged(
          endpointId = endpointId,
          endpointName = connectionInfo.endpointName,
          state = "requested",
          reason = null,
        )
      }

      override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
        val statusCode = result.status.statusCode
        val endpointName = endpointNamesById[endpointId] ?: pendingConnectionsById[endpointId]?.endpointName ?: ""
        pendingConnectionsById.remove(endpointId)

        if (statusCode == ConnectionsStatusCodes.STATUS_OK) {
          nativeLogRelay.info(
            TAG,
            "Connection established",
            buildContextJson(
              "endpointId" to endpointId,
              "endpointName" to endpointName,
            ),
          )
          emitConnectionStateChanged(
            endpointId = endpointId,
            endpointName = endpointName,
            state = "connected",
            reason = null,
          )
          return
        }

        val reason =
          when (statusCode) {
            ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> "rejected"
            ConnectionsStatusCodes.STATUS_ALREADY_CONNECTED_TO_ENDPOINT -> "already-connected"
            ConnectionsStatusCodes.STATUS_ENDPOINT_IO_ERROR -> "io-error"
            ConnectionsStatusCodes.STATUS_ERROR -> "error"
            else -> "status-$statusCode"
          }

        nativeLogRelay.warn(
          TAG,
          "Connection result was not successful",
          buildContextJson(
            "endpointId" to endpointId,
            "endpointName" to endpointName,
            "reason" to reason,
            "statusCode" to statusCode,
          ),
        )
        emitConnectionStateChanged(
          endpointId = endpointId,
          endpointName = endpointName,
          state = "rejected",
          reason = reason,
        )
      }

      override fun onDisconnected(endpointId: String) {
        val endpointName = endpointNamesById[endpointId] ?: ""
        nativeLogRelay.warn(
          TAG,
          "Endpoint disconnected",
          buildContextJson(
            "endpointId" to endpointId,
            "endpointName" to endpointName,
          ),
        )
        emitConnectionStateChanged(
          endpointId = endpointId,
          endpointName = endpointName,
          state = "disconnected",
          reason = "remote-disconnect",
        )
      }
    }

  private val payloadCallback =
    object : PayloadCallback() {
      override fun onPayloadReceived(endpointId: String, payload: Payload) {
        when (payload.type) {
          Payload.Type.BYTES -> {
            val envelopeJson = payload.asBytes()?.toString(Charsets.UTF_8) ?: ""
            nativeLogRelay.debug(
              TAG,
              "Received bytes payload",
              buildContextJson(
                "endpointId" to endpointId,
                "payloadId" to payload.id,
              ),
            )
            emitEnvelopeReceived(endpointId, payload.id, envelopeJson)
            emitPayloadProgress(
              endpointId = endpointId,
              payloadId = payload.id,
              payloadKind = "bytes",
              status = "success",
              bytesTransferred = payload.asBytes()?.size?.toLong(),
              totalBytes = payload.asBytes()?.size?.toLong(),
              fileUri = null,
            )
          }
          Payload.Type.FILE -> {
            incomingFilePayloads[payload.id] = payload
            nativeLogRelay.info(
              TAG,
              "Received file payload handle",
              buildContextJson(
                "endpointId" to endpointId,
                "payloadId" to payload.id,
              ),
            )
            emitPayloadProgress(
              endpointId = endpointId,
              payloadId = payload.id,
              payloadKind = "file",
              status = "in-progress",
              bytesTransferred = null,
              totalBytes = null,
              fileUri = null,
            )
          }
          else -> {
            nativeLogRelay.warn(
              TAG,
              "Ignoring unsupported stream payload",
              buildContextJson(
                "endpointId" to endpointId,
                "payloadId" to payload.id,
              ),
            )
            emitPayloadProgress(
              endpointId = endpointId,
              payloadId = payload.id,
              payloadKind = "stream",
              status = "failure",
              bytesTransferred = null,
              totalBytes = null,
              fileUri = null,
            )
          }
        }
      }

      override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
        val status =
          when (update.status) {
            PayloadTransferUpdate.Status.SUCCESS -> "success"
            PayloadTransferUpdate.Status.FAILURE -> "failure"
            PayloadTransferUpdate.Status.CANCELED -> "canceled"
            else -> "in-progress"
          }
        val payloadKind =
          when {
            incomingFilePayloads.containsKey(update.payloadId) -> "file"
            else -> "bytes"
          }
        val fileUri =
          if (status == "success" && payloadKind == "file") {
            incomingFilePayloads.remove(update.payloadId)?.asFile()?.asJavaFile()?.let { file ->
              Uri.fromFile(file).toString()
            }
          } else {
            null
          }

        nativeLogRelay.debug(
          TAG,
          "Payload transfer update",
          buildContextJson(
            "bytesTransferred" to update.bytesTransferred,
            "endpointId" to endpointId,
            "payloadId" to update.payloadId,
            "status" to status,
            "totalBytes" to update.totalBytes,
          ),
        )

        emitPayloadProgress(
          endpointId = endpointId,
          payloadId = update.payloadId,
          payloadKind = payloadKind,
          status = status,
          bytesTransferred = update.bytesTransferred,
          totalBytes = update.totalBytes,
          fileUri = fileUri,
        )
      }
    }

  private fun resolveFile(fileUri: String): File {
    if (fileUri.startsWith("file:/")) {
      return File(requireNotNull(Uri.parse(fileUri).path))
    }

    return File(fileUri)
  }

  private fun stopAllInternal(context: Context) {
    nativeLogRelay.info(
      TAG,
      "Stopping all nearby sync activity",
      buildContextJson(
        "sessionLabel" to advertisedSessionLabel,
      ),
    )

    runCatching { connectionsClient(context).stopAdvertising() }
    runCatching { connectionsClient(context).stopDiscovery() }
    runCatching { connectionsClient(context).stopAllEndpoints() }
    advertisedSessionLabel = null
    discoveredEndpoints.clear()
    endpointNamesById.clear()
    pendingConnectionsById.clear()
    incomingFilePayloads.clear()
    emitDiscoveryUpdated()
  }

  private fun buildAvailabilityPayload(context: Context?): Map<String, Any?> {
    if (context == null) {
      return mapOf(
        "isReady" to false,
        "isSupported" to false,
        "playServicesStatus" to null,
        "reason" to "module-unavailable",
      )
    }

    val statusCode = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)
    val isReady = statusCode == ConnectionResult.SUCCESS

    return mapOf(
      "isReady" to isReady,
      "isSupported" to isReady,
      "playServicesStatus" to statusCode.toDouble(),
      "reason" to if (isReady) "ready" else if (statusCode == ConnectionResult.SERVICE_MISSING) "play-services-missing" else "play-services-error",
    )
  }

  private fun emitAvailabilityChanged(context: Context) {
    sendEvent(
      "KidPointsNearbySyncAvailabilityChanged",
      buildAvailabilityPayload(context),
    )
  }

  private fun emitDiscoveryUpdated() {
    sendEvent(
      "KidPointsNearbySyncDiscoveryUpdated",
      mapOf(
        "endpoints" to discoveredEndpoints.map { (endpointId, endpointName) ->
          mapOf(
            "endpointId" to endpointId,
            "endpointName" to endpointName,
          )
        },
      ),
    )
  }

  private fun emitConnectionRequested(endpointId: String, endpointName: String) {
    sendEvent(
      "KidPointsNearbySyncConnectionRequested",
      mapOf(
        "endpointId" to endpointId,
        "endpointName" to endpointName,
      ),
    )
  }

  private fun emitAuthTokenReady(
    endpointId: String,
    endpointName: String,
    authToken: String,
    isIncomingConnection: Boolean,
  ) {
    sendEvent(
      "KidPointsNearbySyncAuthTokenReady",
      mapOf(
        "authToken" to authToken,
        "endpointId" to endpointId,
        "endpointName" to endpointName,
        "isIncomingConnection" to isIncomingConnection,
      ),
    )
  }

  private fun emitConnectionStateChanged(
    endpointId: String,
    endpointName: String,
    state: String,
    reason: String?,
  ) {
    sendEvent(
      "KidPointsNearbySyncConnectionStateChanged",
      mapOf(
        "endpointId" to endpointId,
        "endpointName" to endpointName,
        "reason" to reason,
        "state" to state,
      ),
    )
  }

  private fun emitPayloadProgress(
    endpointId: String,
    payloadId: Long,
    payloadKind: String,
    status: String,
    bytesTransferred: Long?,
    totalBytes: Long?,
    fileUri: String?,
  ) {
    sendEvent(
      "KidPointsNearbySyncPayloadProgress",
      mapOf(
        "bytesTransferred" to bytesTransferred?.toDouble(),
        "endpointId" to endpointId,
        "fileUri" to fileUri,
        "payloadId" to payloadId.toDouble(),
        "payloadKind" to payloadKind,
        "status" to status,
        "totalBytes" to totalBytes?.toDouble(),
      ),
    )
  }

  private fun emitEnvelopeReceived(endpointId: String, payloadId: Long, envelopeJson: String) {
    sendEvent(
      "KidPointsNearbySyncEnvelopeReceived",
      mapOf(
        "endpointId" to endpointId,
        "envelopeJson" to envelopeJson,
        "payloadId" to payloadId.toDouble(),
      ),
    )
  }

  fun emitLog(entry: NativeLogEntryPayload) {
    sendEvent("KidPointsNearbySyncLog", entry.toEventPayload())
  }

  private fun buildContextJson(vararg pairs: Pair<String, Any?>): String {
    return JSONObject().apply {
      pairs.forEach { (key, value) ->
        put(key, value ?: JSONObject.NULL)
      }
    }.toString()
  }
}
