export type ChildProfile = {
  id: string;
  displayName: string;
  points: number;
  sortOrder: number;
  avatarColor: string;
  isActive: boolean;
};

export type SharedTimerConfig = {
  intervalMinutes: number;
  notificationsEnabled: boolean;
  alarmSound: 'Chime' | 'Bell';
  alarmDurationSeconds: number;
};

export type SharedTimerState = {
  cycleStartedAt: number | null;
  isRunning: boolean;
  pausedRemainingMs: number | null;
};

export type ParentSettings = {
  pin: string;
};

export type ParentSession = {
  isUnlocked: boolean;
};

export type ThemeMode = 'light' | 'dark' | 'system';

export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export type UiPreferences = {
  themeMode: ThemeMode;
};

export type ShopCatalogItem = {
  id: string;
  title: string;
  imageUri: string | null;
  cost: number;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

export type ShopCatalogState = {
  items: ShopCatalogItem[];
  updatedAt: number | null;
};

export type CartState = {
  itemIds: string[];
};

export type PersistedAppData = {
  children: ChildProfile[];
  uiPreferences: UiPreferences;
  timerConfig: SharedTimerConfig;
  timerState: SharedTimerState;
  parentSettings: ParentSettings;
  shopCatalog: ShopCatalogState;
  cart: CartState;
};
