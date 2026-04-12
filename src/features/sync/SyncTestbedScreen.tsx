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

type SyncTestbedSession = ReturnType<typeof useNearbySyncSession>;
type SyncTestbedPresetId =
  | 'searching'
  | 'preparing'
  | 'review'
  | 'waiting'
  | 'finishing'
  | 'success'
  | 'unavailable'
  | 'no-nfc'
  | 'permissions'
  | 'nfc-timeout'
  | 'wrong-peer'
  | 'transfer-failed';

type SyncTestbedPresetCheckpoint = {
  run?: (session: SyncTestbedSession) => Promise<void>;
  waitFor: (state: SyncTestbedSession['state']) => boolean;
};

type SyncTestbedPresetConfig = {
  checkpoints: SyncTestbedPresetCheckpoint[];
  id: SyncTestbedPresetId;
  label: string;
  scenarioId: SyncTestbedScenarioId | null;
  shouldStartFlow: boolean;
  successMessage: string;
};

const SYNC_TESTBED_PRESETS: SyncTestbedPresetConfig[] = [
  {
    checkpoints: [],
    id: 'searching',
    label: 'Searching',
    scenarioId: null,
    shouldStartFlow: false,
    successMessage: 'Reached searching state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'transferring',
      },
    ],
    id: 'preparing',
    label: 'Preparing',
    scenarioId: 'pause-before-merge-result',
    shouldStartFlow: true,
    successMessage: 'Reached preparing state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'review',
      },
    ],
    id: 'review',
    label: 'Review',
    scenarioId: null,
    shouldStartFlow: true,
    successMessage: 'Reached review state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'review',
      },
      {
        run: async (session) => {
          await session.confirmMergeAndPrepareCommit();
        },
        waitFor: (state) =>
          state.phase === 'review' &&
          state.localPrepareConfirmed &&
          state.isAwaitingPeerPrepare,
      },
    ],
    id: 'waiting',
    label: 'Waiting',
    scenarioId: 'pause-before-peer-prepare-ack',
    shouldStartFlow: true,
    successMessage: 'Reached waiting-for-other-phone state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'review',
      },
      {
        run: async (session) => {
          await session.confirmMergeAndPrepareCommit();
        },
        waitFor: (state) => state.phase === 'committing',
      },
    ],
    id: 'finishing',
    label: 'Finishing',
    scenarioId: 'pause-before-commit-ack',
    shouldStartFlow: true,
    successMessage: 'Reached finishing state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'review',
      },
      {
        run: async (session) => {
          await session.confirmMergeAndPrepareCommit();
        },
        waitFor: (state) => state.phase === 'success',
      },
    ],
    id: 'success',
    label: 'Success',
    scenarioId: null,
    shouldStartFlow: true,
    successMessage: 'Reached success state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'error',
      },
    ],
    id: 'unavailable',
    label: 'Unavailable',
    scenarioId: 'availability-unavailable',
    shouldStartFlow: true,
    successMessage: 'Reached unavailable error state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'error',
      },
    ],
    id: 'no-nfc',
    label: 'No NFC',
    scenarioId: 'nfc-unsupported',
    shouldStartFlow: true,
    successMessage: 'Reached no-NFC error state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'error',
      },
    ],
    id: 'permissions',
    label: 'Permissions',
    scenarioId: 'permissions-denied',
    shouldStartFlow: true,
    successMessage: 'Reached permissions error state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'error',
      },
    ],
    id: 'nfc-timeout',
    label: 'NFC Timeout',
    scenarioId: 'nfc-bootstrap-timeout',
    shouldStartFlow: true,
    successMessage: 'Reached NFC timeout state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'error',
      },
    ],
    id: 'wrong-peer',
    label: 'Wrong Peer',
    scenarioId: 'wrong-peer-bootstrap-token',
    shouldStartFlow: true,
    successMessage: 'Reached wrong-peer error state.',
  },
  {
    checkpoints: [
      {
        waitFor: (state) => state.phase === 'error',
      },
    ],
    id: 'transfer-failed',
    label: 'Transfer Failed',
    scenarioId: 'payload-transfer-failed',
    shouldStartFlow: true,
    successMessage: 'Reached transfer failure state.',
  },
];

const FIXTURE_STRATEGIES: {
  id: SyncTestbedFixtureStrategyId;
  label: string;
}[] = [
  { id: 'bootstrap-left-to-right', label: 'Bootstrap Theirs' },
  { id: 'bootstrap-right-to-left', label: 'Bootstrap Mine' },
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
  const [activePresetId, setActivePresetId] =
    useState<SyncTestbedPresetId | null>(null);
  const [isBaseSelectorVisible, setBaseSelectorVisible] = useState(false);
  const [isPreviewHistoryVisible, setPreviewHistoryVisible] = useState(false);
  const [isRunningPreset, setIsRunningPreset] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to simulate.');

  useEffect(() => {
    log.info('Sync testbed initialized');
  }, []);

  useEffect(() => {
    sessionStateRef.current = session.state;
  }, [session.state]);

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

    setActivePresetId(null);
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
  const activePreset =
    SYNC_TESTBED_PRESETS.find((preset) => preset.id === activePresetId) ?? null;

  async function resetPreview() {
    setActivePresetId(null);
    await resetPreviewToSeed(
      previewStore,
      session,
      controller,
      previewSeedDocument,
      setStatusMessage,
      'Preview reset.',
    );
  }

  async function runPreset(presetId: SyncTestbedPresetId) {
    const preset = SYNC_TESTBED_PRESETS.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setActivePresetId(preset.id);
    setIsRunningPreset(true);
    setStatusMessage(`Running ${preset.label.toLowerCase()} preset...`);

    try {
      await resetPreviewToSeed(
        previewStore,
        session,
        controller,
        previewSeedDocument,
        setStatusMessage,
        'Preview reset for preset playback.',
      );
      controller.applyScenario(preset.scenarioId);

      if (preset.shouldStartFlow) {
        await startModeForScenario(session);
      }

      for (const checkpoint of preset.checkpoints) {
        if (checkpoint.run) {
          await checkpoint.run(session);
        }

        await waitForCondition(() =>
          checkpoint.waitFor(sessionStateRef.current),
        );
      }

      setStatusMessage(preset.successMessage);
    } catch (error) {
      setStatusMessage(
        `Preset failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsRunningPreset(false);
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
                <CompactSurface>
                  <SectionLabel>Fixture</SectionLabel>
                  <ActionPillRow>
                    {FIXTURE_STRATEGIES.map((strategy) => (
                      <ActionPill
                        key={strategy.id}
                        label={strategy.label}
                        onPress={() => {
                          setActivePresetId(null);
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
                  {fixtureStrategyId === 'shared-base' ? (
                    <>
                      <ActionPillRow>
                        <ActionPill
                          label={
                            selectedCommonBaseOption
                              ? 'Shared Base'
                              : 'No Shared Base'
                          }
                          onPress={() => {
                            if (commonBaseOptions.length === 0) {
                              return;
                            }

                            setActivePresetId(null);
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
                  <SectionLabel>Inspect</SectionLabel>
                  <ActionPillRow>
                    <ActionPill
                      label="Reset Preview"
                      onPress={() => {
                        void resetPreview();
                      }}
                    />
                    <ActionPill
                      label="View Preview History"
                      onPress={() => {
                        setPreviewHistoryVisible(true);
                      }}
                    />
                  </ActionPillRow>
                </CompactSurface>
                <Text style={styles.helper}>
                  Fixture: {fixtureStrategyId}. Preset:{' '}
                  {activePreset?.label.toLowerCase() ?? 'none'}.
                </Text>
                <Text style={styles.helper}>{statusMessage}</Text>
              </Tile>

              <Tile collapsible initiallyCollapsed title="Scenario Presets">
                <ActionPillRow>
                  {SYNC_TESTBED_PRESETS.map((item) => (
                    <ActionPill
                      key={item.id}
                      label={item.label}
                      onPress={() => {
                        void runPreset(item.id);
                      }}
                      tone={activePresetId === item.id ? 'primary' : 'neutral'}
                    />
                  ))}
                </ActionPillRow>
                {isRunningPreset ? (
                  <Text style={styles.helper}>
                    Running preset automation...
                  </Text>
                ) : null}
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
          setActivePresetId(null);
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
  timeoutMs = 3000,
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
