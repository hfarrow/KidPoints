package expo.modules.kidpointsnfcsync

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

class KidPointsNfcSyncBootstrapService : HostApduService() {
  override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
    return KidPointsNfcSyncEngine.processCommandApdu(commandApdu)
  }

  override fun onDeactivated(reason: Int) {
    KidPointsNfcSyncEngine.onReaderDeselected(reason)
  }
}
