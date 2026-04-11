import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SingleSelectList } from '../../components/SingleSelectList';
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
    case 'hosting':
      return 'Hosting';
    case 'discovering':
      return 'Discovering';
    case 'connecting':
      return 'Connecting';
    case 'pairing':
      return 'Pairing';
    case 'transferring':
      return 'Transferring';
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
    case 'pairing':
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

export function SyncScreenContent({
  session,
}: {
  session: NearbySyncSessionController;
}) {
  const styles = useThemedStyles(createStyles);
  const [isDevicePickerVisible, setDevicePickerVisible] = useState(false);
  const { state } = session;

  useEffect(() => {
    if (state.phase === 'discovering') {
      setDevicePickerVisible(true);
      return;
    }

    if (
      state.phase !== 'connecting' &&
      state.phase !== 'pairing' &&
      state.phase !== 'transferring'
    ) {
      setDevicePickerVisible(false);
    }
  }, [state.phase]);

  const availabilityLabel = state.availability.isReady
    ? 'Nearby Ready'
    : state.availability.reason === 'play-services-missing'
      ? 'Play Services Missing'
      : state.availability.reason === 'play-services-error'
        ? 'Play Services Error'
        : 'Unavailable';
  const hasRollbackAvailable = state.phase === 'success';

  return (
    <>
      <SyncNearbyStatusTile
        availabilityLabel={availabilityLabel}
        availabilityReady={state.availability.isReady}
        permissionsReady={state.permissions.allGranted}
        phase={state.phase}
      />

      <SyncStartTile
        onHost={() => {
          void session.startHostFlow();
        }}
        onJoin={() => {
          void session.startJoinFlow();
        }}
      />

      <SyncSessionTile
        onOpenDevicePicker={() => setDevicePickerVisible(true)}
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

      <SingleSelectList
        emptyState={
          <Text style={styles.helper}>
            No nearby KidPoints host was found yet. Keep the host screen open
            and wait a moment, then try again.
          </Text>
        }
        getItemDescription={(item) =>
          `Tap to connect to ${item.endpointName} and verify the shared code.`
        }
        getItemLabel={(item) => item.endpointName}
        items={state.discoveredEndpoints}
        keyExtractor={(item) => item.endpointId}
        onRequestClose={() => setDevicePickerVisible(false)}
        onSelect={(item) => {
          setDevicePickerVisible(false);
          void session.connectToEndpoint(item);
        }}
        selectedItemId={state.connectedEndpoint?.endpointId ?? null}
        subtitle="Choose the nearby parent device you want to sync with."
        title="Nearby Devices"
        visible={isDevicePickerVisible}
      />

      <SyncPairingOverlay
        authToken={state.authToken}
        onAccept={() => {
          void session.acceptPairingCode();
        }}
        onReject={() => {
          void session.rejectPairingCode();
        }}
        visible={state.phase === 'pairing' && Boolean(state.authToken)}
      />
    </>
  );
}

function SyncNearbyStatusTile({
  availabilityLabel,
  availabilityReady,
  permissionsReady,
  phase,
}: {
  availabilityLabel: string;
  availabilityReady: boolean;
  permissionsReady: boolean;
  phase: NearbySyncSessionController['state']['phase'];
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Tile
      accessory={
        <StatusBadge
          label={getSyncPhaseLabel(phase)}
          tone={getSyncPhaseTone(phase)}
        />
      }
      title="Nearby Status"
    >
      <Text style={styles.body}>
        This flow syncs child-ledger state directly between two nearby parent
        devices without a server.
      </Text>
      <ActionPillRow>
        <ActionPill
          accessibilityLabel="Nearby transport availability"
          disableLogging
          label={availabilityLabel}
          tone={availabilityReady ? 'primary' : 'critical'}
        />
        <ActionPill
          accessibilityLabel="Nearby permissions status"
          disableLogging
          label={permissionsReady ? 'Permissions Ready' : 'Permissions Needed'}
          tone={permissionsReady ? 'primary' : 'critical'}
        />
      </ActionPillRow>
      {!availabilityReady ? (
        <Text style={styles.helper}>
          Google Play services must be available on both devices for Nearby
          Connections to work in this build.
        </Text>
      ) : null}
    </Tile>
  );
}

function SyncStartTile({
  onHost,
  onJoin,
}: {
  onHost: () => void;
  onJoin: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Tile title="Start Sync">
      <Text style={styles.body}>
        Choose one parent to host and the other to join. Both parents will
        confirm the same pairing code and the same merge summary before commit.
      </Text>
      <ActionPillRow>
        <ActionPill label="Host Sync" onPress={onHost} tone="primary" />
        <ActionPill label="Join Sync" onPress={onJoin} tone="neutral" />
      </ActionPillRow>
    </Tile>
  );
}

function SyncSessionTile({
  onOpenDevicePicker,
  state,
}: {
  onOpenDevicePicker: () => void;
  state: NearbySyncSessionController['state'];
}) {
  const styles = useThemedStyles(createStyles);

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
        <Text style={styles.body}>
          Hosting as <Text style={styles.emphasis}>{state.sessionLabel}</Text>
        </Text>
      ) : null}
      {state.phase === 'discovering' ? (
        <>
          <Text style={styles.body}>
            Searching for nearby KidPoints sessions on this local network and
            radio range.
          </Text>
          <ActionPillRow>
            <ActionPill
              label={`Pick Device (${state.discoveredEndpoints.length})`}
              onPress={onOpenDevicePicker}
              tone="primary"
            />
          </ActionPillRow>
        </>
      ) : null}
      {state.phase === 'hosting' ? (
        <Text style={styles.body}>
          Waiting for another parent device to discover this session and request
          a connection.
        </Text>
      ) : null}
      {state.phase === 'connecting' || state.phase === 'pairing' ? (
        <Text style={styles.body}>
          {state.connectedEndpoint
            ? `Working with ${state.connectedEndpoint.endpointName}.`
            : 'Preparing the nearby connection.'}
        </Text>
      ) : null}
      {state.phase === 'transferring' ? (
        <Text style={styles.body}>
          Exchanging sync summaries, history exports, and bundle hashes.
        </Text>
      ) : null}
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
        Both parents must confirm the same merged result before the host can
        issue commit.
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

function SyncPairingOverlay({
  authToken,
  onAccept,
  onReject,
  visible,
}: {
  authToken: string | null;
  onAccept: () => void;
  onReject: () => void;
  visible: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  if (!visible || !authToken) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={styles.modalScrim}>
        <View style={styles.authCard}>
          <Text style={styles.authEyebrow}>Verify Pairing Code</Text>
          <Text style={styles.authTitle}>Both screens must match</Text>
          <Text style={styles.body}>
            Confirm the same code is visible on both parent devices before
            accepting the connection.
          </Text>
          <View style={styles.authTokenRow}>
            {buildAuthTokenCells(authToken).map(({ character, key }) => (
              <View key={key} style={styles.authTokenCell}>
                <Text style={styles.authTokenValue}>{character}</Text>
              </View>
            ))}
          </View>
          <ActionPillRow>
            <ActionPill label="Reject" onPress={onReject} tone="critical" />
            <ActionPill
              label="Confirm Match"
              onPress={onAccept}
              tone="primary"
            />
          </ActionPillRow>
        </View>
      </View>
    </View>
  );
}

function buildAuthTokenCells(authToken: string) {
  const countsByCharacter = new Map<string, number>();

  return authToken.split('').map((character) => {
    const nextCount = countsByCharacter.get(character) ?? 0;

    countsByCharacter.set(character, nextCount + 1);

    return {
      character,
      key: `${authToken}-${character}-${nextCount}`,
    };
  });
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    authCard: {
      backgroundColor: tokens.modalSurface,
      borderColor: tokens.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 12,
      maxWidth: 380,
      paddingHorizontal: 18,
      paddingVertical: 18,
      width: '92%',
    },
    authEyebrow: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    authTitle: {
      color: tokens.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
    authTokenCell: {
      alignItems: 'center',
      backgroundColor: tokens.inputSurface,
      borderColor: tokens.accent,
      borderRadius: 16,
      borderWidth: 2,
      flex: 1,
      justifyContent: 'center',
      minHeight: 66,
    },
    authTokenRow: {
      flexDirection: 'row',
      gap: 10,
    },
    authTokenValue: {
      color: tokens.textPrimary,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 1,
    },
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    emphasis: {
      color: tokens.textPrimary,
      fontWeight: '800',
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
    modalScrim: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      backgroundColor: tokens.modalBackdrop,
      justifyContent: 'center',
      paddingHorizontal: 16,
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
