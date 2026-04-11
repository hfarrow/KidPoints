package expo.modules.kidpointsnfcsync

private val APDU_STATUS_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())

internal fun buildSelectAidApdu(aidHex: String): ByteArray {
  val aidBytes = aidHex.hexToByteArray()
  return byteArrayOf(
    0x00,
    0xA4.toByte(),
    0x04,
    0x00,
    aidBytes.size.toByte(),
  ) + aidBytes + byteArrayOf(0x00)
}

internal fun isSelectAidApdu(commandApdu: ByteArray, aidHex: String): Boolean {
  val aidBytes = aidHex.hexToByteArray()
  val expectedHeaderLength = 5
  val minimumLength = expectedHeaderLength + aidBytes.size
  val maximumLength = minimumLength + 1

  if (commandApdu.size != minimumLength && commandApdu.size != maximumLength) {
    return false
  }

  if (
    commandApdu[0] != 0x00.toByte() ||
      commandApdu[1] != 0xA4.toByte() ||
      commandApdu[2] != 0x04.toByte() ||
      commandApdu[3] != 0x00.toByte()
  ) {
    return false
  }

  val lc = commandApdu[4].toInt() and 0xFF

  if (lc != aidBytes.size) {
    return false
  }

  return commandApdu.copyOfRange(expectedHeaderLength, minimumLength).contentEquals(aidBytes)
}

internal fun buildAckApduResponse(localDeviceHash: String, localNonce: String): ByteArray {
  val payload = byteArrayOf(0x01) + localDeviceHash.hexToByteArray() + localNonce.hexToByteArray()
  return payload + APDU_STATUS_SUCCESS
}

internal data class ParsedAckApdu(
  val remoteDeviceHash: String,
  val remoteNonce: String,
)

internal fun parseAckApduResponse(responseApdu: ByteArray): ParsedAckApdu? {
  val payload =
    when {
      endsWithSuccessStatusWord(responseApdu) && responseApdu.size == 19 -> {
        responseApdu.copyOfRange(0, responseApdu.size - 2)
      }
      endsWithSuccessStatusWord(responseApdu) &&
        responseApdu.size == 24 &&
        responseApdu[0] == 0x80.toByte() &&
        responseApdu[1] == 0x11.toByte() -> {
        val payloadLength = responseApdu[4].toInt() and 0xFF
        if (payloadLength != 17 || responseApdu.size < 5 + payloadLength + 2) {
          return null
        }
        responseApdu.copyOfRange(5, 5 + payloadLength)
      }
      else -> return null
    }

  if (payload.size != 17 || payload[0].toInt() and 0xFF != 1) {
    return null
  }

  return ParsedAckApdu(
    remoteDeviceHash = payload.copyOfRange(1, 9).toHexString(),
    remoteNonce = payload.copyOfRange(9, 17).toHexString(),
  )
}

private fun endsWithSuccessStatusWord(bytes: ByteArray): Boolean {
  return bytes.size >= 2 &&
    bytes[bytes.size - 2] == APDU_STATUS_SUCCESS[0] &&
    bytes[bytes.size - 1] == APDU_STATUS_SUCCESS[1]
}
