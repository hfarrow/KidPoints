import { StyleSheet, Text, View } from 'react-native';

import {
  ActionPill,
  ActionPillRow,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import type { useAppTheme } from '../theme/appTheme';
import { useThemedStyles } from '../theme/appTheme';
import type { NearbySyncSessionController } from './useNearbySyncSession';

export function getSyncPhaseLabel(
  phase: NearbySyncSessionController['state']['phase'],
) {
  switch (phase) {
    case 'bootstrapping':
      return 'Tap Phones';
    case 'hosting':
    case 'discovering':
    case 'connecting':
      return 'Connecting';
    case 'pairing':
      return 'Connecting';
    case 'transferring':
      return 'Exchanging Data';
    case 'review':
      return 'Ready To Confirm';
    case 'committing':
      return 'Applying Sync';
    case 'success':
      return 'Synced';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

export function getSyncPhaseTone(
  phase: NearbySyncSessionController['state']['phase'],
): 'good' | 'neutral' | 'warning' {
  switch (phase) {
    case 'success':
      return 'good';
    case 'error':
    case 'review':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function canStartNewSyncSession(
  phase: NearbySyncSessionController['state']['phase'],
) {
  return phase === 'idle' || phase === 'error' || phase === 'success';
}

function getNearbyAvailabilityLabel(
  state: NearbySyncSessionController['state'],
) {
  if (state.availability.isReady) {
    return 'Nearby Ready';
  }

  if (state.availability.reason === 'play-services-missing') {
    return 'Play Services Missing';
  }

  if (state.availability.reason === 'play-services-error') {
    return 'Play Services Error';
  }

  return 'Nearby Unavailable';
}

function getNfcAvailabilityLabel(state: NearbySyncSessionController['state']) {
  if (state.nfcAvailability.isReady) {
    return 'NFC Ready';
  }

  switch (state.nfcAvailability.reason) {
    case 'nfc-disabled':
      return 'NFC Off';
    case 'hce-unsupported':
      return 'HCE Unsupported';
    case 'reader-mode-unsupported':
      return 'Reader Unsupported';
    case 'nfc-unavailable':
      return 'No NFC';
    default:
      return 'NFC Unavailable';
  }
}

function getSessionBody(state: NearbySyncSessionController['state']) {
  switch (state.phase) {
    case 'bootstrapping':
      return (
        state.nfcBootstrap.message ??
        'Hold both phones together while KidPoints confirms the tap and prepares a private nearby session.'
      );
    case 'connecting':
    case 'hosting':
    case 'discovering':
    case 'pairing':
      return state.connectedEndpoint
        ? `Phones matched. Connecting with ${state.connectedEndpoint.endpointName}.`
        : 'Phones matched. KidPoints is establishing a nearby link and skipping the old host and join steps for you.';
    case 'transferring':
      return 'The two phones are exchanging sync summaries, history exports, and merge proofs.';
    case 'review':
      return 'The merge result is ready. Review it on both phones and confirm to continue.';
    case 'committing':
      return 'Both phones agreed on the same merge result and are now applying it.';
    case 'success':
      return 'This phone applied the agreed sync bundle successfully.';
    case 'error':
      return (
        state.errorMessage ??
        'Sync stopped before completion. Review the status above and try again.'
      );
    default:
      return 'Both parents should open this screen, tap Sync Now, and hold their phones together until the review appears.';
  }
}

export function SyncScreenContent({
  session,
}: {
  session: NearbySyncSessionController;
}) {
  const { state } = session;
  const hasRollbackAvailable = state.phase === 'success';

  return (
    <>
      <SyncStatusTile state={state} />

      <SyncStartTile
        canStart={canStartNewSyncSession(state.phase)}
        onCancel={() => {
          void session.cancelSession();
        }}
        onStart={() => {
          void session.startSyncFlow();
        }}
        phase={state.phase}
      />

      <SyncSessionTile
        onCancel={() => {
          void session.cancelSession();
        }}
        onRetry={() => {
          void session.startSyncFlow();
        }}
        state={state}
      />

      {state.review ? (
        <SyncReviewTile
          isAwaitingPeerPrepare={state.isAwaitingPeerPrepare}
          localPrepareConfirmed={state.localPrepareConfirmed}
          onConfirm={() => {
            if (!state.localPrepareConfirmed) {
              void session.confirmMergeAndPrepareCommit();
            }
          }}
          review={state.review}
        />
      ) : null}

      {state.phase === 'success' ? (
        <SyncSuccessTile
          hasRollbackAvailable={hasRollbackAvailable}
          onRestart={() => {
            void session.cancelSession();
          }}
          onRevert={() => {
            void session.revertLastAppliedSync();
          }}
        />
      ) : null}
    </>
  );
}

function SyncStatusTile({
  state,
}: {
  state: NearbySyncSessionController['state'];
}) {
  const styles = useThemedStyles(createStyles);
  const nearbyReady = state.availability.isReady;
  const nfcReady = state.nfcAvailability.isReady;
  const permissionsReady = state.permissions.allGranted;

  return (
    <Tile
      accessory={
        <StatusBadge
          label={getSyncPhaseLabel(state.phase)}
          tone={getSyncPhaseTone(state.phase)}
        />
      }
      title="Sync Status"
    >
      <Text style={styles.body}>
        KidPoints uses NFC to bootstrap a private nearby connection, then keeps
        the existing review and confirm steps before commit.
      </Text>
      <ActionPillRow>
        <ActionPill
          accessibilityLabel="Nearby transport availability"
          disableLogging
          label={getNearbyAvailabilityLabel(state)}
          tone={nearbyReady ? 'primary' : 'critical'}
        />
        <ActionPill
          accessibilityLabel="NFC bootstrap availability"
          disableLogging
          label={getNfcAvailabilityLabel(state)}
          tone={nfcReady ? 'primary' : 'critical'}
        />
        <ActionPill
          accessibilityLabel="Nearby permissions status"
          disableLogging
          label={permissionsReady ? 'Permissions Ready' : 'Permissions Needed'}
          tone={permissionsReady ? 'primary' : 'critical'}
        />
      </ActionPillRow>
      {!nearbyReady ? (
        <Text style={styles.helper}>
          Google Play services must be available on both devices for the nearby
          transport to work.
        </Text>
      ) : null}
      {!nfcReady ? (
        <Text style={styles.helper}>
          Both phones need Android NFC support, host card emulation, and NFC
          turned on before the tap step can succeed.
        </Text>
      ) : null}
    </Tile>
  );
}

function SyncStartTile({
  canStart,
  onCancel,
  onStart,
  phase,
}: {
  canStart: boolean;
  onCancel: () => void;
  onStart: () => void;
  phase: NearbySyncSessionController['state']['phase'];
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Tile title="Start Sync">
      <Text style={styles.body}>
        Both parents open this screen, tap the same button, then hold the phones
        together. KidPoints handles the hidden host and join work behind the
        scenes.
      </Text>
      <ActionPillRow>
        {canStart ? (
          <ActionPill label="Sync Now" onPress={onStart} tone="primary" />
        ) : (
          <ActionPill label="Cancel Sync" onPress={onCancel} tone="critical" />
        )}
      </ActionPillRow>
      {phase === 'error' ? (
        <Text style={styles.helper}>
          Retry from here after fixing the NFC or Nearby issue shown below.
        </Text>
      ) : null}
    </Tile>
  );
}

function SyncSessionTile({
  onCancel,
  onRetry,
  state,
}: {
  onCancel: () => void;
  onRetry: () => void;
  state: NearbySyncSessionController['state'];
}) {
  const styles = useThemedStyles(createStyles);
  const isBootstrapError =
    state.phase === 'error' && state.nfcBootstrap.phase === 'error';

  return (
    <Tile
      accessory={
        state.connectedEndpoint ? (
          <StatusBadge
            label={state.connectedEndpoint.endpointName}
            tone="neutral"
          />
        ) : null
      }
      title="Session"
    >
      {state.sessionLabel ? (
        <Text style={styles.helper}>
          Hidden session label: {state.sessionLabel}
        </Text>
      ) : null}
      <Text style={styles.body}>{getSessionBody(state)}</Text>
      {state.transferProgress.payloadId != null ? (
        <Text style={styles.helper}>
          Payload {state.transferProgress.payloadId} is{' '}
          {state.transferProgress.status}.
          {state.transferProgress.totalBytes != null
            ? ` ${state.transferProgress.bytesTransferred ?? 0}/${state.transferProgress.totalBytes} bytes`
            : ''}
        </Text>
      ) : null}
      {state.errorMessage ? (
        <Text style={styles.error}>{state.errorMessage}</Text>
      ) : null}
      {isBootstrapError ? (
        <ActionPillRow>
          <ActionPill label="Retry Tap" onPress={onRetry} tone="primary" />
          <ActionPill label="Cancel" onPress={onCancel} tone="critical" />
        </ActionPillRow>
      ) : null}
    </Tile>
  );
}

function SyncReviewTile({
  isAwaitingPeerPrepare,
  localPrepareConfirmed,
  onConfirm,
  review,
}: {
  isAwaitingPeerPrepare: boolean;
  localPrepareConfirmed: boolean;
  onConfirm: () => void;
  review: NonNullable<NearbySyncSessionController['state']['review']>;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Tile
      accessory={<StatusBadge label={review.mode} tone="warning" />}
      title="Merge Summary"
    >
      <Text style={styles.body}>
        Both parents must confirm the same merged result before commit.
      </Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Affected Children</Text>
          <Text style={styles.summaryValue}>{review.mergedChildCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Reconciliations</Text>
          <Text style={styles.summaryValue}>
            {review.childReconciliationCount}
          </Text>
        </View>
      </View>
      <Text style={styles.helper}>
        Bundle: {review.bundleHash.slice(0, 14)}
      </Text>
      <Text style={styles.helper}>
        Head: {review.mergedHeadSyncHash.slice(0, 14)}
      </Text>
      <ActionPillRow>
        <ActionPill
          label={
            localPrepareConfirmed
              ? isAwaitingPeerPrepare
                ? 'Waiting For Peer'
                : 'Confirmed'
              : 'Confirm Sync'
          }
          onPress={onConfirm}
          tone="primary"
        />
      </ActionPillRow>
    </Tile>
  );
}

function SyncSuccessTile({
  hasRollbackAvailable,
  onRestart,
  onRevert,
}: {
  hasRollbackAvailable: boolean;
  onRestart: () => void;
  onRevert: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Tile
      accessory={<StatusBadge label="Applied" tone="good" />}
      title="Sync Complete"
    >
      <Text style={styles.body}>
        This device applied the agreed sync bundle. If the result looks wrong,
        revert the last sync before starting another session.
      </Text>
      <ActionPillRow>
        <ActionPill
          label="Start Another Sync"
          onPress={onRestart}
          tone="primary"
        />
        {hasRollbackAvailable ? (
          <ActionPill
            label="Revert Last Sync"
            onPress={onRevert}
            tone="critical"
          />
        ) : null}
      </ActionPillRow>
    </Tile>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    error: {
      color: tokens.critical,
      fontSize: 13,
      fontWeight: '700',
    },
    helper: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    summaryCard: {
      backgroundColor: tokens.controlSurface,
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      minHeight: 86,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    summaryGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    summaryLabel: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    summaryValue: {
      color: tokens.textPrimary,
      fontSize: 26,
      fontWeight: '900',
    },
  });
