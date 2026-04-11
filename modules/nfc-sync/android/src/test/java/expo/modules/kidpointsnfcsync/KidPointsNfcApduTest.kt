package expo.modules.kidpointsnfcsync

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class KidPointsNfcApduTest {
  @Test
  fun `select AID matcher accepts command with trailing le byte`() {
    val command = buildSelectAidApdu(KidPointsNfcSyncEngine.KIDPOINTS_SYNC_AID)

    assertTrue(isSelectAidApdu(command, KidPointsNfcSyncEngine.KIDPOINTS_SYNC_AID))
  }

  @Test
  fun `select AID matcher accepts command without trailing le byte`() {
    val commandWithLe = buildSelectAidApdu(KidPointsNfcSyncEngine.KIDPOINTS_SYNC_AID)
    val commandWithoutLe = commandWithLe.copyOf(commandWithLe.size - 1)

    assertTrue(isSelectAidApdu(commandWithoutLe, KidPointsNfcSyncEngine.KIDPOINTS_SYNC_AID))
  }

  @Test
  fun `select AID matcher rejects wrong aid`() {
    val command = buildSelectAidApdu(KidPointsNfcSyncEngine.KIDPOINTS_SYNC_AID)

    assertFalse(isSelectAidApdu(command, "A0000002471001"))
  }

  @Test
  fun `ack parser accepts proper response apdu`() {
    val response = buildAckApduResponse("997efb49af0a6154", "4e8f41732664412c")

    val parsed = parseAckApduResponse(response)

    assertNotNull(parsed)
    assertEquals("997efb49af0a6154", parsed?.remoteDeviceHash)
    assertEquals("4e8f41732664412c", parsed?.remoteNonce)
  }

  @Test
  fun `ack parser accepts legacy command-shaped response`() {
    val legacyResponse =
      "801100001101997efb49af0a61544e8f41732664412c9000".hexToByteArray()

    val parsed = parseAckApduResponse(legacyResponse)

    assertNotNull(parsed)
    assertEquals("997efb49af0a6154", parsed?.remoteDeviceHash)
    assertEquals("4e8f41732664412c", parsed?.remoteNonce)
  }
}
