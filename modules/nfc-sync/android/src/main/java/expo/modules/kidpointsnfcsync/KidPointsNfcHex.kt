package expo.modules.kidpointsnfcsync

internal fun ByteArray.toHexString(): String = joinToString("") { "%02x".format(it) }

internal fun String.hexToByteArray(): ByteArray {
  val normalized = lowercase()
  return ByteArray(normalized.length / 2) { index ->
    normalized.substring(index * 2, index * 2 + 2).toInt(16).toByte()
  }
}
