import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import {
  ActionPill,
  ActionPillRow,
  CompactSurface,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { useLocalSettingsStore } from '../../state/localSettingsStore';
import { triggerSuccessHaptic } from '../haptics/appHaptics';
import type { useAppTheme } from '../theme/appTheme';
import { useThemedStyles } from '../theme/appTheme';
import type { NearbySyncSessionController } from './useNearbySyncSession';

const SEARCHING_PHASES = new Set<NearbySyncSessionController['state']['phase']>(
  ['bootstrapping', 'connecting', 'discovering', 'hosting', 'idle', 'pairing'],
);

export function getSyncPhaseLabel(
  phase: NearbySyncSessionController['state']['phase'],
) {
  switch (phase) {
    case 'bootstrapping':
    case 'hosting':
    case 'discovering':
    case 'connecting':
    case 'pairing':
      return 'Searching';
    case 'transferring':
      return 'Preparing';
    case 'review':
      return 'Review';
    case 'committing':
      return 'Finishing';
    case 'success':
      return 'Done';
    case 'error':
      return 'Error';
    default:
      return 'Ready';
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

function isSearchingPhase(
  phase: NearbySyncSessionController['state']['phase'],
) {
  return SEARCHING_PHASES.has(phase);
}

function getSyncingBody(state: NearbySyncSessionController['state']) {
  switch (state.phase) {
    case 'bootstrapping':
      return 'Keep both phones back-to-back while KidPoints finds the matching device.';
    case 'hosting':
    case 'discovering':
    case 'connecting':
    case 'pairing':
      return 'KidPoints found the other phone and is opening a private connection.';
    case 'transferring':
      return 'KidPoints is comparing both histories and getting the review ready.';
    case 'committing':
      return 'Applying the approved sync on both phones now.';
    default:
      return 'Open this screen on both phones and hold them together.';
  }
}

function getFriendlyErrorBody(state: NearbySyncSessionController['state']) {
  if (state.nfcBootstrap.failureReason === 'timeout') {
    return 'The phones did not connect in time. Keep them back-to-back and KidPoints can try again.';
  }

  switch (state.errorCode) {
    case 'nfc-disabled':
      return 'Turn on NFC on both phones, then try again.';
    case 'permissions-denied':
      return 'Nearby permissions are needed on this phone before syncing can start.';
    case 'connection-disconnected':
    case 'payload-transfer-failed':
      return 'The phones lost their connection before syncing finished. Hold them together and try again.';
    case 'bootstrap-token-mismatch':
    case 'bootstrap-session-mismatch':
      return 'KidPoints found the wrong phone for this tap. Hold the two syncing phones together and try again.';
    default:
      return (
        state.errorMessage ??
        'Sync could not finish this time. Keep the phones together and try again.'
      );
  }
}

function getReviewStatusCopy(state: NearbySyncSessionController['state']) {
  if (state.phase === 'success') {
    return 'Both phones finished applying the same sync.';
  }

  if (state.localPrepareConfirmed) {
    return state.isAwaitingPeerPrepare
      ? 'This phone is ready. Confirm on the other phone to finish syncing.'
      : 'This phone is ready. Waiting for the final step to finish.';
  }

  return 'Review the updated history, then confirm on both phones to finish syncing.';
}

function formatChildPointsContribution(args: {
  basePoints: number;
  localNewContributionPoints: number;
  points: number;
  remoteNewContributionPoints: number;
}) {
  const {
    basePoints,
    localNewContributionPoints,
    points,
    remoteNewContributionPoints,
  } = args;
  const localOperator = localNewContributionPoints < 0 ? '-' : '+';
  const remoteOperator = remoteNewContributionPoints < 0 ? '-' : '+';

  return `${basePoints} (base) ${localOperator} ${Math.abs(localNewContributionPoints)} (yours) ${remoteOperator} ${Math.abs(remoteNewContributionPoints)} (theirs) = ${points}`;
}

function SyncTileActionRail({
  isApplied,
  isAwaitingPeerPrepare,
  localPrepareConfirmed,
  onCancel,
  onConfirm,
}: {
  isApplied: boolean;
  isAwaitingPeerPrepare: boolean;
  localPrepareConfirmed: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (isApplied) {
    return null;
  }

  return (
    <ActionPillRow>
      {localPrepareConfirmed ? (
        <StatusBadge
          label={
            isAwaitingPeerPrepare ? 'Waiting For Other Phone' : 'Confirmed'
          }
          tone="warning"
        />
      ) : (
        <ActionPill label="Confirm Sync" onPress={onConfirm} tone="primary" />
      )}
      <ActionPill label="Cancel" onPress={onCancel} tone="critical" />
    </ActionPillRow>
  );
}

function SyncInstructionsDiagram() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.diagramRow}>
      <View style={styles.phonePair}>
        <View style={styles.phoneBackAligned} />
        <View style={styles.phoneFrontAligned}>
          <View style={styles.phoneCamera} />
        </View>
      </View>
    </View>
  );
}

function SyncInstructionsTile() {
  const styles = useThemedStyles(createStyles);

  return (
    <Tile title="Instructions">
      <Text style={styles.primaryCopy}>
        Hold your phones together back-to-back.
      </Text>
      <Text style={styles.body}>
        Keep both screens open and let KidPoints handle the connection for you.
      </Text>
      <SyncInstructionsDiagram />
    </Tile>
  );
}

function SyncingTile({
  celebrationTick,
  state,
}: {
  celebrationTick: number;
  state: NearbySyncSessionController['state'];
}) {
  const styles = useThemedStyles(createStyles);
  const pulse = useRef(new Animated.Value(0)).current;
  const [searchingDots, setSearchingDots] = useState('');
  const searching = isSearchingPhase(state.phase);

  useEffect(() => {
    if (!searching) {
      setSearchingDots('');
      return;
    }

    const intervalId = setInterval(() => {
      setSearchingDots((currentDots) =>
        currentDots.length >= 3 ? '' : `${currentDots}.`,
      );
    }, 420);

    return () => clearInterval(intervalId);
  }, [searching]);

  useEffect(() => {
    if (celebrationTick === 0) {
      return;
    }

    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(520),
      Animated.timing(pulse, {
        duration: 180,
        easing: Easing.in(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [celebrationTick, pulse]);

  return (
    <Tile
      accessory={
        <StatusBadge label={getSyncPhaseLabel(state.phase)} tone="neutral" />
      }
      title="Syncing"
    >
      <View style={styles.syncingHeader}>
        <Text style={styles.syncHeadline}>
          {searching
            ? `Searching${searchingDots}`
            : getSyncPhaseLabel(state.phase)}
        </Text>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.connectionCelebration,
            {
              opacity: pulse,
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.72, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Feather
            color={styles.connectionCelebrationIcon.color}
            name="check"
            size={16}
          />
        </Animated.View>
      </View>
      <Text style={styles.body}>{getSyncingBody(state)}</Text>
    </Tile>
  );
}

function SyncErrorTile({
  onCancel,
  onRetry,
  state,
}: {
  onCancel: () => void;
  onRetry: () => void;
  state: NearbySyncSessionController['state'];
}) {
  const styles = useThemedStyles(createStyles);
  const isTimeout = state.nfcBootstrap.failureReason === 'timeout';

  return (
    <Tile
      accessory={<StatusBadge label="Try Again" tone="warning" />}
      title="Syncing"
    >
      <Text style={styles.primaryCopy}>
        We couldn&apos;t finish syncing yet.
      </Text>
      <Text style={styles.body}>{getFriendlyErrorBody(state)}</Text>
      {isTimeout ? (
        <Text style={styles.helper}>
          KidPoints will keep retrying while this screen stays open.
        </Text>
      ) : null}
      <ActionPillRow>
        <ActionPill
          label={isTimeout ? 'Retry Now' : 'Try Again'}
          onPress={onRetry}
          tone="primary"
        />
        <ActionPill label="Cancel" onPress={onCancel} tone="critical" />
      </ActionPillRow>
    </Tile>
  );
}

function SyncReviewTile({
  onCancel,
  onConfirm,
  state,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  state: NearbySyncSessionController['state'];
}) {
  const styles = useThemedStyles(createStyles);
  const review = state.review;

  if (!review) {
    return null;
  }

  const isApplied = state.phase === 'success';

  return (
    <Tile
      accessory={
        <StatusBadge
          label={isApplied ? 'Applied' : 'Ready To Confirm'}
          tone={isApplied ? 'good' : 'warning'}
        />
      }
      title={isApplied ? 'Sync Complete' : 'Review Sync'}
    >
      <SyncTileActionRail
        isApplied={isApplied}
        isAwaitingPeerPrepare={state.isAwaitingPeerPrepare}
        localPrepareConfirmed={state.localPrepareConfirmed}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />

      <View style={styles.reviewIntro}>
        <Text style={styles.primaryCopy}>{review.outcomeCopy}</Text>
        <Text style={styles.body}>{getReviewStatusCopy(state)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Children</Text>
        <View style={styles.sectionList}>
          {review.children.map((child) => (
            <CompactSurface key={child.childId} style={styles.childRow}>
              <View style={styles.childRowHeader}>
                <Text style={styles.childName}>{child.childName}</Text>
                {child.change === 'added' ? (
                  <StatusBadge label="+ New" size="mini" tone="good" />
                ) : child.change === 'removed' ? (
                  <StatusBadge label="- Removed" size="mini" tone="warning" />
                ) : null}
              </View>
              <Text style={styles.childPoints}>
                {child.change === 'removed'
                  ? `${child.points} points`
                  : formatChildPointsContribution({
                      basePoints: child.basePoints,
                      localNewContributionPoints:
                        child.localNewContributionPoints,
                      points: child.points,
                      remoteNewContributionPoints:
                        child.remoteNewContributionPoints,
                    })}
              </Text>
            </CompactSurface>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>
          Synced History
        </Text>
        <View style={styles.transactionOriginHeader}>
          <Text
            style={[
              styles.transactionOriginLabel,
              styles.transactionOriginLabelLeft,
            ]}
          >
            Yours
          </Text>
          <Text
            style={[
              styles.transactionOriginLabel,
              styles.transactionOriginLabelRight,
            ]}
          >
            Theirs
          </Text>
        </View>
        {review.transactions.length === 0 ? (
          <Text style={styles.helper}>
            No syncable history changes were needed.
          </Text>
        ) : (
          <View style={styles.transactionColumn}>
            {review.transactions.map((transaction) => {
              const isLocalOrigin = transaction.origin === 'local';
              const isBaseOrigin = transaction.origin === 'base';

              return (
                <View
                  key={transaction.id}
                  style={[
                    styles.reviewTransactionWrap,
                    isBaseOrigin
                      ? styles.reviewTransactionWrapBase
                      : isLocalOrigin
                        ? styles.reviewTransactionWrapLocal
                        : styles.reviewTransactionWrapRemote,
                  ]}
                >
                  {isBaseOrigin ? (
                    <Text style={styles.reviewBaseLabel}>Base</Text>
                  ) : null}
                  <View
                    testID={`review-transaction-${transaction.id}`}
                    style={[
                      styles.reviewTransactionBubble,
                      isBaseOrigin
                        ? styles.reviewTransactionBubbleBase
                        : isLocalOrigin
                          ? styles.reviewTransactionBubbleLocal
                          : styles.reviewTransactionBubbleRemote,
                    ]}
                  >
                    <Text style={styles.reviewTransactionSummary}>
                      {transaction.summaryText}
                    </Text>
                    <Text style={styles.reviewTransactionTime}>
                      {transaction.timestampLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <SyncTileActionRail
        isApplied={isApplied}
        isAwaitingPeerPrepare={state.isAwaitingPeerPrepare}
        localPrepareConfirmed={state.localPrepareConfirmed}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </Tile>
  );
}

export function SyncScreenContent({
  session,
}: {
  session: NearbySyncSessionController;
}) {
  const { state } = session;
  const hapticsEnabled = useLocalSettingsStore(
    (storeState) => storeState.hapticsEnabled,
  );
  const lastConnectedEndpointIdRef = useRef<string | null>(null);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const connectedEndpointId = state.connectedEndpoint?.endpointId ?? null;

  useEffect(() => {
    if (!connectedEndpointId) {
      lastConnectedEndpointIdRef.current = null;
      return;
    }

    if (lastConnectedEndpointIdRef.current === connectedEndpointId) {
      return;
    }

    lastConnectedEndpointIdRef.current = connectedEndpointId;
    triggerSuccessHaptic(hapticsEnabled);
    setCelebrationTick((currentValue) => currentValue + 1);
  }, [connectedEndpointId, hapticsEnabled]);

  const shouldShowInstructions =
    state.phase !== 'review' && state.phase !== 'success';

  return (
    <>
      {shouldShowInstructions ? <SyncInstructionsTile /> : null}

      {state.phase === 'error' ? (
        <SyncErrorTile
          onCancel={() => {
            void session.cancelSession();
          }}
          onRetry={() => {
            void session.startSyncFlow();
          }}
          state={state}
        />
      ) : state.review &&
        (state.phase === 'review' || state.phase === 'success') ? (
        <SyncReviewTile
          onCancel={() => {
            void session.cancelSession();
          }}
          onConfirm={() => {
            if (!state.localPrepareConfirmed) {
              void session.confirmMergeAndPrepareCommit();
            }
          }}
          state={state}
        />
      ) : (
        <SyncingTile celebrationTick={celebrationTick} state={state} />
      )}
    </>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    childName: {
      color: tokens.textPrimary,
      flex: 1,
      fontSize: 13,
      fontWeight: '800',
      minWidth: 0,
    },
    childPoints: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    childRow: {
      gap: 4,
    },
    childRowHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    connectionCelebration: {
      alignItems: 'center',
      backgroundColor: tokens.successSurface,
      borderRadius: 999,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    connectionCelebrationIcon: {
      color: tokens.successText,
    },
    diagramArrow: {
      color: tokens.textMuted,
    },
    diagramArrowWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    diagramRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
      paddingVertical: 4,
    },
    helper: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    phoneBack: {
      backgroundColor: tokens.transactionSyncedSurface,
      borderColor: tokens.tileBorder,
      borderRadius: 14,
      borderWidth: 1,
      height: 72,
      left: 14,
      position: 'absolute',
      top: 6,
      transform: [{ rotate: '7deg' }],
      width: 40,
    },
    phoneBackAligned: {
      backgroundColor: tokens.transactionSyncedSurface,
      borderColor: tokens.tileBorder,
      borderRadius: 14,
      borderWidth: 1,
      height: 72,
      left: 18,
      position: 'absolute',
      top: 6,
      width: 40,
    },
    phoneCamera: {
      backgroundColor: tokens.textMuted,
      borderRadius: 999,
      height: 6,
      width: 6,
    },
    phoneFront: {
      alignItems: 'center',
      backgroundColor: tokens.transactionLocalSurface,
      borderColor: tokens.tileBorder,
      borderRadius: 14,
      borderWidth: 1,
      gap: 6,
      height: 72,
      justifyContent: 'flex-start',
      paddingTop: 10,
      width: 40,
    },
    phoneFrontAligned: {
      alignItems: 'center',
      backgroundColor: tokens.transactionLocalSurface,
      borderColor: tokens.tileBorder,
      borderRadius: 14,
      borderWidth: 1,
      gap: 6,
      height: 72,
      justifyContent: 'flex-start',
      paddingTop: 10,
      transform: [{ rotate: '-7deg' }],
      width: 40,
    },
    phonePair: {
      height: 84,
      position: 'relative',
      width: 64,
    },
    primaryCopy: {
      color: tokens.textPrimary,
      fontSize: 17,
      fontWeight: '900',
      lineHeight: 22,
    },
    reviewIntro: {
      gap: 6,
    },
    reviewTransactionBubble: {
      borderColor: tokens.tileBorder,
      borderRadius: 16,
      borderWidth: 1,
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 7,
      width: '90%',
    },
    reviewTransactionBubbleBase: {
      backgroundColor: tokens.floatingLabelSurface,
      borderColor: tokens.accent,
    },
    reviewTransactionBubbleLocal: {
      backgroundColor: tokens.transactionLocalSurface,
    },
    reviewTransactionBubbleRemote: {
      backgroundColor: tokens.transactionSyncedSurface,
    },
    reviewTransactionSummary: {
      color: tokens.textPrimary,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 17,
    },
    reviewTransactionTime: {
      color: tokens.textMuted,
      fontSize: 11,
      lineHeight: 13,
    },
    reviewTransactionWrap: {
      width: '100%',
    },
    reviewTransactionWrapBase: {
      alignItems: 'center',
    },
    reviewTransactionWrapLocal: {
      alignItems: 'flex-start',
    },
    reviewTransactionWrapRemote: {
      alignItems: 'flex-end',
    },
    section: {
      gap: 8,
    },
    sectionList: {
      gap: 8,
    },
    sectionTitle: {
      color: tokens.textMuted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    sectionTitleCentered: {
      textAlign: 'center',
    },
    syncingHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    syncHeadline: {
      color: tokens.textPrimary,
      flex: 1,
      fontSize: 21,
      fontWeight: '900',
      lineHeight: 26,
    },
    transactionOriginHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    transactionOriginLabel: {
      color: tokens.textMuted,
      flex: 1,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    transactionOriginLabelLeft: {
      textAlign: 'left',
    },
    transactionOriginLabelRight: {
      textAlign: 'right',
    },
    reviewBaseLabel: {
      color: tokens.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    transactionColumn: {
      gap: 8,
    },
  });
