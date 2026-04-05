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
    <Tile eyebrow="Delivery" title="Notification placeholders">
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
            Notifications enabled
          </Text>
          <Text style={[styles.supportingText, { color: tokens.textMuted }]}>
            This persists the preference now. Native alarm and notification
            delivery will be added later.
          </Text>
        </View>
        <Switch
          onValueChange={onNotificationsEnabledChange}
          thumbColor="#f8fafc"
          trackColor={{ false: '#94a3b8', true: '#0f766e' }}
          value={notificationsEnabled}
        />
      </View>
      <View style={styles.soundRow}>
        {(['Chime', 'Bell'] as const).map((sound) => {
          const selected = alarmSound === sound;

          return (
            <Pressable
              key={sound}
              onPress={() => onAlarmSoundChange(sound)}
              style={[
                styles.soundOption,
                selected && styles.soundOptionSelected,
              ]}
            >
              <Text
                style={[
                  styles.soundOptionText,
                  selected && styles.soundOptionTextSelected,
                ]}
              >
                {sound}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  supportingText: {
    fontSize: 15,
    lineHeight: 22,
  },
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
  soundRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  soundOption: {
    borderRadius: 999,
    backgroundColor: '#fde68a',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  soundOptionSelected: {
    backgroundColor: '#b45309',
  },
  soundOptionText: {
    fontWeight: '800',
    color: '#92400e',
  },
  soundOptionTextSelected: {
    color: '#fffbeb',
  },
});
