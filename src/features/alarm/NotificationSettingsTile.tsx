import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

type AlarmSound = 'Chime' | 'Bell';

type NotificationSettingsTileProps = {
  alarmSound: AlarmSound;
  notificationsEnabled: boolean;
  onAlarmSoundChange: (sound: AlarmSound) => void;
  onNotificationsEnabledChange: (value: boolean) => void;
};

export function NotificationSettingsTile({
  alarmSound,
  notificationsEnabled,
  onAlarmSoundChange,
  onNotificationsEnabledChange,
}: NotificationSettingsTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile collapsible={false} floatingTitle title="Notifications">
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
            Notifications enabled
          </Text>
        </View>
        <Switch
          onValueChange={onNotificationsEnabledChange}
          thumbColor="#f8fafc"
          trackColor={{ false: '#94a3b8', true: '#0f766e' }}
          value={notificationsEnabled}
        />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
            Alarm sound
          </Text>
        </View>
        <View
          style={[
            styles.soundToggleRail,
            { backgroundColor: tokens.controlSurface },
          ]}
        >
          {(['Chime', 'Bell'] as const).map((sound, index) => {
            const selected = alarmSound === sound;

            return (
              <Pressable
                key={sound}
                onPress={() => onAlarmSoundChange(sound)}
                style={[
                  styles.soundToggleOption,
                  selected && {
                    backgroundColor: tokens.controlSurfaceActive,
                  },
                  index === 0 && styles.soundToggleOptionLeft,
                  index === 1 && [
                    styles.soundToggleOptionRight,
                    { borderLeftColor: tokens.border },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.soundOptionText,
                    {
                      color: selected
                        ? tokens.controlTextOnActive
                        : tokens.controlText,
                    },
                  ]}
                >
                  {sound}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  switchCopy: {
    flex: 1,
    gap: 6,
  },
  soundToggleRail: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 999,
  },
  soundToggleOption: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  soundToggleOptionLeft: {
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  soundToggleOptionRight: {
    borderLeftWidth: 1,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  soundOptionText: {
    fontWeight: '800',
  },
});
