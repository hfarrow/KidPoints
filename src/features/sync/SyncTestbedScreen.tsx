import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StateStorage } from 'zustand/middleware';

import { ListScaffold } from '../../components/ListScaffold';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  ActionPill,
  ActionPillRow,
  CompactSurface,
  SectionLabel,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import {
  cloneSharedDocument,
  SharedStoreProvider,
  useSharedStore,
  useSharedStoreApi,
} from '../../state/sharedStore';
import type { SharedDocument } from '../../state/sharedTypes';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { TransactionsScreenContent } from '../transactions/TransactionsScreenContent';
import { SyncBaseTransactionSelectorModal } from './SyncBaseTransactionSelectorModal';
import {
  getSyncPhaseLabel,
  getSyncPhaseTone,
  SyncScreenContent,
} from './SyncScreenContent';
import { SyncRuntimeProvider } from './syncRuntimeContext';
import type {
  SyncSimulatorController,
  SyncTestbedScenarioId,
} from './syncSimulatorRuntime';
import { createSimulatorNearbySyncRuntime } from './syncSimulatorRuntime';
import {
  createSyncTestbedLocalSeedDocument,
  deriveSyncTestbedCommonBaseOptions,
  pickDefaultSyncTestbedCommonBaseTransactionId,
  type SyncTestbedCommonBaseOption,
  type SyncTestbedFixtureStrategyId,
} from './syncTestbedFixtures';
import { useNearbySyncSession } from './useNearbySyncSession';

const log = createModuleLogger('sync-testbed-screen');
const SYNC_TESTBED_WIDE_BREAKPOINT = 900;

const SCENARIO_ITEMS: {
  id: SyncTestbedScenarioId;
  label: string;
}[] = [
  { id: 'happy-path-review', label: 'Happy Review' },
  { id: 'happy-path-success', label: 'Happy Success' },
  { id: 'availability-unavailable', label: 'Unavailable' },
  { id: 'nfc-unsupported', label: 'No NFC' },
  { id: 'nfc-bootstrap-timeout', label: 'NFC Timeout' },
  { id: 'permissions-denied', label: 'Permissions' },
  { id: 'connection-rejected', label: 'Rejected' },
  { id: 'payload-transfer-failed', label: 'Payload Fail' },
  { id: 'unreadable-remote-projection', label: 'Unreadable File' },
  { id: 'merged-head-mismatch', label: 'Head Mismatch' },
  { id: 'bundle-hash-mismatch', label: 'Bundle Mismatch' },
  { id: 'sync-response-rejected', label: 'Response Reject' },
  { id: 'commit-ack-bundle-mismatch', label: 'Ack Mismatch' },
  { id: 'disconnect-during-transfer', label: 'Disconnect' },
  { id: 'wrong-peer-bootstrap-token', label: 'Wrong Peer' },
];

const FIXTURE_STRATEGIES: {
  id: SyncTestbedFixtureStrategyId;
  label: string;
}[] = [
  { id: 'bootstrap-left-to-right', label: 'Left Bootstrap' },
  { id: 'bootstrap-right-to-left', label: 'Right Bootstrap' },
  { id: 'shared-base', label: 'Shared Base' },
  { id: 'independent-lineages', label: 'Independent' },
];

export function SyncTestbedScreen() {
  const liveDocument = useSharedStore((state) => state.document);
  const commonBaseOptions = useMemo(
    () => deriveSyncTestbedCommonBaseOptions(liveDocument),
    [liveDocument],
  );
  const [fixtureStrategyId, setFixtureStrategyId] =
    useState<SyncTestbedFixtureStrategyId>(() =>
      resolveDefaultFixtureStrategyId(liveDocument),
    );
  const [commonBaseTransactionId, setCommonBaseTransactionId] = useState<
    string | null
  >(() => pickDefaultSyncTestbedCommonBaseTransactionId(commonBaseOptions));
  const previewSeedDocument = useMemo(
    () =>
      createSyncTestbedLocalSeedDocument({
        sourceDocument: liveDocument,
        strategyId: fixtureStrategyId,
      }),
    [fixtureStrategyId, liveDocument],
  );
  const previewStorage = useMemo(() => createMemoryStorage(), []);

  useEffect(() => {
    if (fixtureStrategyId !== 'shared-base') {
      return;
    }

    const hasSelectedOption = commonBaseOptions.some(
      (option) => option.id === commonBaseTransactionId && option.isMergeSafe,
    );

    if (hasSelectedOption) {
      return;
    }

    setCommonBaseTransactionId(
      pickDefaultSyncTestbedCommonBaseTransactionId(commonBaseOptions),
    );
  }, [commonBaseOptions, commonBaseTransactionId, fixtureStrategyId]);

  return (
    <SharedStoreProvider
      initialDocument={previewSeedDocument}
      storage={previewStorage}
    >
      <SyncTestbedSandbox
        commonBaseOptions={commonBaseOptions}
        commonBaseTransactionId={commonBaseTransactionId}
        fixtureStrategyId={fixtureStrategyId}
        previewSeedDocument={previewSeedDocument}
        setCommonBaseTransactionId={setCommonBaseTransactionId}
        setFixtureStrategyId={setFixtureStrategyId}
      />
    </SharedStoreProvider>
  );
}

function SyncTestbedSandbox({
  commonBaseOptions,
  commonBaseTransactionId,
  fixtureStrategyId,
  previewSeedDocument,
  setCommonBaseTransactionId,
  setFixtureStrategyId,
}: {
  commonBaseOptions: SyncTestbedCommonBaseOption[];
  commonBaseTransactionId: string | null;
  fixtureStrategyId: SyncTestbedFixtureStrategyId;
  previewSeedDocument: SharedDocument;
  setCommonBaseTransactionId: (transactionId: string | null) => void;
  setFixtureStrategyId: (strategyId: SyncTestbedFixtureStrategyId) => void;
}) {
  const previewStore = useSharedStoreApi();
  const simulator = useMemo(
    () =>
      createSimulatorNearbySyncRuntime({
        getLocalDocument: () => previewStore.getState().document,
      }),
    [previewStore],
  );

  return (
    <SyncRuntimeProvider runtime={simulator.runtime}>
      <SyncTestbedScene
        commonBaseOptions={commonBaseOptions}
        commonBaseTransactionId={commonBaseTransactionId}
        controller={simulator.controller}
        fixtureStrategyId={fixtureStrategyId}
        previewSeedDocument={previewSeedDocument}
        setCommonBaseTransactionId={setCommonBaseTransactionId}
        setFixtureStrategyId={setFixtureStrategyId}
      />
    </SyncRuntimeProvider>
  );
}

function SyncTestbedScene({
  commonBaseOptions,
  commonBaseTransactionId,
  controller,
  fixtureStrategyId,
  previewSeedDocument,
  setCommonBaseTransactionId,
  setFixtureStrategyId,
}: {
  commonBaseOptions: SyncTestbedCommonBaseOption[];
  commonBaseTransactionId: string | null;
  controller: SyncSimulatorController;
  fixtureStrategyId: SyncTestbedFixtureStrategyId;
  previewSeedDocument: SharedDocument;
  setCommonBaseTransactionId: (transactionId: string | null) => void;
  setFixtureStrategyId: (strategyId: SyncTestbedFixtureStrategyId) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { getScreenSurface } = useAppTheme();
  const { isParentUnlocked } = useParentSession();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = windowWidth >= SYNC_TESTBED_WIDE_BREAKPOINT;
  const previewStore = useSharedStoreApi();
  const session = useNearbySyncSession();
  const sessionStateRef = useRef(session.state);
  const previousFixtureRef = useRef<{
    commonBaseTransactionId: string | null;
    fixtureStrategyId: SyncTestbedFixtureStrategyId;
    previewSeedSignature: string;
  } | null>(null);
  const [simulatorState, setSimulatorState] = useState(
    controller.getSnapshot(),
  );
  const [isBaseSelectorVisible, setBaseSelectorVisible] = useState(false);
  const [isPreviewHistoryVisible, setPreviewHistoryVisible] = useState(false);
  const [isRunningScenario, setIsRunningScenario] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to simulate.');

  useEffect(() => {
    log.info('Sync testbed initialized');
  }, []);

  useEffect(() => {
    sessionStateRef.current = session.state;
  }, [session.state]);

  useEffect(() => {
    return controller.subscribe(() => {
      setSimulatorState(controller.getSnapshot());
    });
  }, [controller]);

  useEffect(() => {
    controller.setFixtureStrategy(fixtureStrategyId);
    controller.setCommonBaseTransactionId(commonBaseTransactionId);
  }, [commonBaseTransactionId, controller, fixtureStrategyId]);

  useEffect(() => {
    const previewSeedSignature = buildPreviewSeedSignature(previewSeedDocument);
    const previousFixture = previousFixtureRef.current;

    previousFixtureRef.current = {
      commonBaseTransactionId,
      fixtureStrategyId,
      previewSeedSignature,
    };

    if (!previousFixture) {
      return;
    }

    if (
      previousFixture.commonBaseTransactionId === commonBaseTransactionId &&
      previousFixture.fixtureStrategyId === fixtureStrategyId &&
      previousFixture.previewSeedSignature === previewSeedSignature
    ) {
      return;
    }

    void resetPreviewToSeed(
      previewStore,
      session,
      controller,
      previewSeedDocument,
      setStatusMessage,
      'Preview reloaded for the updated fixture.',
    );
  }, [
    commonBaseTransactionId,
    controller,
    fixtureStrategyId,
    previewSeedDocument,
    previewStore,
    session,
  ]);

  const selectedCommonBaseOption =
    commonBaseOptions.find((option) => option.id === commonBaseTransactionId) ??
    null;

  async function resetPreview() {
    await resetPreviewToSeed(
      previewStore,
      session,
      controller,
      previewSeedDocument,
      setStatusMessage,
      'Preview reset.',
    );
  }

  async function startCurrentMode() {
    await session.startSyncFlow();
    setStatusMessage(
      'Local preview started with the same one-button NFC flow used in production.',
    );
  }

  async function runScenario(scenarioId: SyncTestbedScenarioId) {
    setIsRunningScenario(true);
    setStatusMessage(`Running ${scenarioId}...`);

    try {
      await resetPreviewToSeed(
        previewStore,
        session,
        controller,
        previewSeedDocument,
        setStatusMessage,
        'Preview reset for scenario playback.',
      );
      controller.applyScenario(scenarioId);

      if (
        scenarioId === 'availability-unavailable' ||
        scenarioId === 'permissions-denied' ||
        scenarioId === 'nfc-unsupported'
      ) {
        await startModeForScenario(session);
        setStatusMessage('Reached startup validation error state.');
        return;
      }

      await startModeForScenario(session);

      if (scenarioId === 'nfc-bootstrap-timeout') {
        await waitForCondition(() => sessionStateRef.current.phase === 'error');
        setStatusMessage('Reached NFC timeout state.');
        return;
      }

      if (
        scenarioId === 'connection-rejected' ||
        scenarioId === 'wrong-peer-bootstrap-token'
      ) {
        await waitForCondition(() => sessionStateRef.current.phase === 'error');
        setStatusMessage('Reached connection validation error state.');
        return;
      }

      if (scenarioId === 'disconnect-during-transfer') {
        await waitForCondition(() => sessionStateRef.current.phase === 'error');
        setStatusMessage('Reached transfer disconnect state.');
        return;
      }

      if (
        scenarioId === 'payload-transfer-failed' ||
        scenarioId === 'unreadable-remote-projection' ||
        scenarioId === 'merged-head-mismatch' ||
        scenarioId === 'bundle-hash-mismatch' ||
        scenarioId === 'sync-response-rejected'
      ) {
        await waitForCondition(() => sessionStateRef.current.phase === 'error');
        setStatusMessage('Reached remote error state.');
        return;
      }

      await waitForCondition(() => sessionStateRef.current.phase === 'review');

      if (scenarioId === 'happy-path-review') {
        setStatusMessage('Reached review state.');
        return;
      }

      await session.confirmMergeAndPrepareCommit();
      await waitForCondition(
        () =>
          sessionStateRef.current.phase === 'success' ||
          sessionStateRef.current.phase === 'error',
      );

      setStatusMessage(
        sessionStateRef.current.phase === 'success'
          ? 'Reached success state.'
          : 'Reached commit error state.',
      );
    } catch (error) {
      setStatusMessage(
        `Scenario failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsRunningScenario(false);
    }
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: getScreenSurface(isParentUnlocked) },
      ]}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <ScreenHeader title="Sync Testbed" />

        <View
          style={[
            styles.splitBody,
            isWideLayout ? styles.splitBodyWide : styles.splitBodyNarrow,
          ]}
          testID="sync-testbed-split-body"
        >
          <View
            style={styles.layoutModeMarker}
            testID={
              isWideLayout
                ? 'sync-testbed-layout-wide'
                : 'sync-testbed-layout-narrow'
            }
          />
          <View style={styles.pane}>
            <ScrollView
              contentContainerStyle={styles.controlsScrollContent}
              showsVerticalScrollIndicator={false}
              style={styles.scrollPane}
              testID="sync-testbed-controls-scroll"
            >
              <Tile
                accessory={
                  <StatusBadge
                    label={getSyncPhaseLabel(session.state.phase)}
                    tone={getSyncPhaseTone(session.state.phase)}
                  />
                }
                title="Testbed Controls"
              >
                <Text style={styles.body}>
                  Use the simulator controls to drive the live sync preview
                  below without needing a second device.
                </Text>
                <CompactSurface>
                  <SectionLabel>Fixture</SectionLabel>
                  <ActionPillRow>
                    {FIXTURE_STRATEGIES.map((strategy) => (
                      <ActionPill
                        key={strategy.id}
                        label={strategy.label}
                        onPress={() => {
                          setFixtureStrategyId(strategy.id);
                          setStatusMessage(
                            `Fixture strategy set to ${strategy.label.toLowerCase()}.`,
                          );
                        }}
                        tone={
                          fixtureStrategyId === strategy.id
                            ? 'primary'
                            : 'neutral'
                        }
                      />
                    ))}
                  </ActionPillRow>
                  <Text style={styles.helper}>
                    Left bootstrap uses local preview history with an empty
                    remote. Right bootstrap uses an empty local preview with
                    seeded remote history. Shared base branches both sides from
                    a selected syncable transaction.
                  </Text>
                  <Text style={styles.helper}>
                    The simulator keeps the hidden host and join work internal
                    and derives it from the selected fixture.
                  </Text>
                  {fixtureStrategyId === 'shared-base' ? (
                    <>
                      <ActionPillRow>
                        <ActionPill
                          label={
                            selectedCommonBaseOption
                              ? 'Choose Shared Base'
                              : 'No Shared Base'
                          }
                          onPress={() => {
                            if (commonBaseOptions.length === 0) {
                              return;
                            }

                            setBaseSelectorVisible(true);
                          }}
                          tone={
                            selectedCommonBaseOption ? 'primary' : 'neutral'
                          }
                        />
                      </ActionPillRow>
                      <Text style={styles.helper}>
                        {selectedCommonBaseOption
                          ? `Selected base: ${selectedCommonBaseOption.summaryText}`
                          : 'No merge-safe shared base is currently available from the local syncable history.'}
                      </Text>
                    </>
                  ) : null}
                </CompactSurface>
                <CompactSurface>
                  <SectionLabel>Session</SectionLabel>
                  <ActionPillRow>
                    <ActionPill
                      label="Sync Now"
                      onPress={() => {
                        void startCurrentMode();
                      }}
                      tone="primary"
                    />
                    <ActionPill
                      label="Confirm Merge"
                      onPress={() => {
                        void session.confirmMergeAndPrepareCommit();
                      }}
                    />
                    <ActionPill
                      label="Cancel Session"
                      onPress={() => {
                        void session.cancelSession();
                      }}
                      tone="critical"
                    />
                    <ActionPill
                      label="Reset Preview"
                      onPress={() => {
                        void resetPreview();
                      }}
                    />
                  </ActionPillRow>
                </CompactSurface>
                <CompactSurface>
                  <SectionLabel>Inspect</SectionLabel>
                  <ActionPillRow>
                    <ActionPill
                      label="View Preview History"
                      onPress={() => {
                        setPreviewHistoryVisible(true);
                      }}
                    />
                  </ActionPillRow>
                  <Text style={styles.helper}>
                    Opens the sandboxed transaction log so you can review the
                    simulated merge result without leaving the testbed.
                  </Text>
                </CompactSurface>
                <Text style={styles.helper}>
                  Fixture: {fixtureStrategyId}. Scenario:{' '}
                  {simulatorState.scenarioId ?? 'manual'}.
                </Text>
                <Text style={styles.helper}>{statusMessage}</Text>
              </Tile>

              <Tile collapsible initiallyCollapsed title="Scenario Presets">
                <Text style={styles.body}>
                  Each preset runs the live session and simulated remote
                  responses until the target state is visible in the preview.
                </Text>
                <ActionPillRow>
                  {SCENARIO_ITEMS.map((item) => (
                    <ActionPill
                      key={item.id}
                      label={item.label}
                      onPress={() => {
                        void runScenario(item.id);
                      }}
                      tone={
                        simulatorState.scenarioId === item.id
                          ? 'primary'
                          : 'neutral'
                      }
                    />
                  ))}
                </ActionPillRow>
                {isRunningScenario ? (
                  <Text style={styles.helper}>
                    Running preset automation...
                  </Text>
                ) : null}
              </Tile>

              <Tile collapsible initiallyCollapsed title="Manual Remote Steps">
                <ActionPillRow>
                  <ActionPill
                    label="Show Discovery"
                    onPress={() => {
                      controller.emitDiscoveryUpdated();
                      setStatusMessage('Discovery list emitted.');
                    }}
                  />
                  <ActionPill
                    label="Incoming Pair"
                    onPress={() => {
                      controller.emitConnectionRequested();
                      setStatusMessage('Incoming pairing request emitted.');
                    }}
                  />
                  <ActionPill
                    label="Remote Hello"
                    onPress={() => {
                      controller.emitRemoteHello();
                      setStatusMessage('Remote hello emitted.');
                    }}
                  />
                  <ActionPill
                    label="Remote Summary"
                    onPress={() => {
                      controller.emitRemoteSummary();
                      setStatusMessage('Remote summary emitted.');
                    }}
                  />
                  <ActionPill
                    label="Remote History"
                    onPress={() => {
                      controller.emitRemoteHistoryTransfer();
                      setStatusMessage('Remote file transfer emitted.');
                    }}
                  />
                  <ActionPill
                    label="Unreadable File"
                    onPress={() => {
                      controller.emitRemoteHistoryTransfer({
                        invalidFile: true,
                      });
                      setStatusMessage('Unreadable file emitted.');
                    }}
                    tone="critical"
                  />
                  <ActionPill
                    label="Remote Merge"
                    onPress={() => {
                      controller.emitRemoteMergeResult();
                      setStatusMessage('Remote merge result emitted.');
                    }}
                  />
                  <ActionPill
                    label="Peer Confirm"
                    onPress={() => {
                      controller.emitRemotePrepareAck();
                      setStatusMessage('Peer confirmation emitted.');
                    }}
                  />
                  <ActionPill
                    label="Remote Commit"
                    onPress={() => {
                      controller.emitRemoteCommit();
                      setStatusMessage('Remote commit emitted.');
                    }}
                  />
                  <ActionPill
                    label="Commit Ack"
                    onPress={() => {
                      controller.emitRemoteCommitAck();
                      setStatusMessage('Commit ack emitted.');
                    }}
                  />
                  <ActionPill
                    label="Ack Mismatch"
                    onPress={() => {
                      controller.emitRemoteCommitAck({
                        bundleHash: 'sim-manual-mismatch',
                      });
                      setStatusMessage('Mismatched commit ack emitted.');
                    }}
                    tone="critical"
                  />
                  <ActionPill
                    label="Reject Response"
                    onPress={() => {
                      controller.emitRemoteSyncResponse({
                        accepted: false,
                        reason: 'Manual simulated rejection.',
                      });
                      setStatusMessage('Rejected sync response emitted.');
                    }}
                    tone="critical"
                  />
                  <ActionPill
                    label="Disconnect"
                    onPress={() => {
                      controller.emitDisconnect('Manual simulated disconnect.');
                      setStatusMessage('Disconnect emitted.');
                    }}
                    tone="critical"
                  />
                  <ActionPill
                    label="Remote Error"
                    onPress={() => {
                      controller.emitRemoteError(
                        'manual-simulated-error',
                        'Manual simulated remote error.',
                      );
                      setStatusMessage('Remote error emitted.');
                    }}
                    tone="critical"
                  />
                </ActionPillRow>
              </Tile>
            </ScrollView>
          </View>

          <View
            style={[
              styles.splitDivider,
              isWideLayout
                ? styles.splitDividerWide
                : styles.splitDividerNarrow,
            ]}
          />

          <View style={styles.pane}>
            <View style={styles.previewColumn}>
              <SectionLabel>Live Preview</SectionLabel>
              <View style={styles.previewSurface}>
                <ScrollView
                  contentContainerStyle={styles.previewScrollContent}
                  showsVerticalScrollIndicator={false}
                  style={styles.scrollPane}
                  testID="sync-testbed-preview-scroll"
                >
                  <SyncScreenContent session={session} />
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 10,
          },
        ]}
      >
        <ScreenBackFooter />
      </View>

      <SyncBaseTransactionSelectorModal
        onRequestClose={() => setBaseSelectorVisible(false)}
        onSelectTransaction={(transactionId) => {
          setCommonBaseTransactionId(transactionId);
          setBaseSelectorVisible(false);
          setStatusMessage('Shared base transaction updated.');
        }}
        options={commonBaseOptions}
        selectedTransactionId={commonBaseTransactionId}
        visible={isBaseSelectorVisible}
      />
      <ListScaffold
        closeButtonPlacement="footer"
        onRequestClose={() => setPreviewHistoryVisible(false)}
        subtitle="Showing the transaction ledger inside the sync testbed sandbox."
        title="Preview Transactions"
        visible={isPreviewHistoryVisible}
      >
        <TransactionsScreenContent />
      </ListScaffold>
    </View>
  );
}

async function resetPreviewToSeed(
  previewStore: ReturnType<typeof useSharedStoreApi>,
  session: ReturnType<typeof useNearbySyncSession>,
  controller: SyncSimulatorController,
  previewSeedDocument: SharedDocument,
  setStatusMessage: (message: string) => void,
  message: string,
) {
  await session.cancelSession();

  previewStore.setState((state) => ({
    ...state,
    document: cloneSharedDocument(previewSeedDocument),
  }));
  controller.reset();
  setStatusMessage(message);
}

async function startModeForScenario(
  session: ReturnType<typeof useNearbySyncSession>,
) {
  await session.startSyncFlow();
}

async function waitForCondition(
  condition: () => boolean,
  timeoutMs = 1500,
  intervalMs = 30,
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (condition()) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error('Timed out waiting for the simulated sync state.');
}

function createMemoryStorage(): StateStorage {
  const data = new Map<string, string>();

  return {
    getItem: async (name) => data.get(name) ?? null,
    removeItem: async (name) => {
      data.delete(name);
    },
    setItem: async (name, value) => {
      data.set(name, value);
    },
  };
}

function resolveDefaultFixtureStrategyId(
  document: SharedDocument,
): SyncTestbedFixtureStrategyId {
  return document.transactions.length === 0
    ? 'bootstrap-right-to-left'
    : 'bootstrap-left-to-right';
}

function buildPreviewSeedSignature(document: SharedDocument) {
  return [
    document.currentHeadTransactionId ?? 'none',
    document.transactions.length,
    document.events.length,
    document.head.activeChildIds.join('|'),
    document.head.archivedChildIds.join('|'),
  ].join(':');
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    body: {
      color: tokens.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    content: {
      flex: 1,
      gap: 10,
      paddingBottom: 16,
      paddingHorizontal: 12,
    },
    controlsScrollContent: {
      gap: 10,
      paddingBottom: 4,
    },
    footer: {
      backgroundColor: tokens.tabBarBackground,
      borderTopColor: tokens.border,
      borderTopWidth: 1,
      paddingHorizontal: 14,
      paddingTop: 10,
    },
    helper: {
      color: tokens.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    layoutModeMarker: {
      height: 0,
      position: 'absolute',
      width: 0,
    },
    pane: {
      flex: 1,
      minHeight: 0,
    },
    previewColumn: {
      flex: 1,
      gap: 8,
      minHeight: 0,
    },
    previewSurface: {
      borderColor: tokens.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      minHeight: 0,
      padding: 10,
      position: 'relative',
    },
    previewScrollContent: {
      gap: 10,
      paddingBottom: 4,
    },
    screen: {
      flex: 1,
    },
    scrollPane: {
      flex: 1,
    },
    splitDivider: {
      backgroundColor: tokens.border,
      opacity: 0.9,
    },
    splitDividerNarrow: {
      height: 1,
      width: '100%',
    },
    splitDividerWide: {
      height: '100%',
      width: 1,
    },
    splitBody: {
      flex: 1,
      gap: 12,
      minHeight: 0,
      position: 'relative',
    },
    splitBodyNarrow: {
      flexDirection: 'column',
    },
    splitBodyWide: {
      flexDirection: 'row',
    },
  });
