import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Tile } from '../../components/Tile';
import { useAppTheme } from '../theme/themeContext';

type IntervalSettingsTileProps = {
  alarmDurationSeconds: string;
  intervalMinutes: string;
  onAlarmDurationSecondsChange: (value: string) => void;
  onAlarmDurationSecondsBlur: () => void;
  onIntervalMinutesChange: (value: string) => void;
  onIntervalMinutesBlur: () => void;
};

export function IntervalSettingsTile({
  alarmDurationSeconds,
  intervalMinutes,
  onAlarmDurationSecondsBlur,
  onAlarmDurationSecondsChange,
  onIntervalMinutesBlur,
  onIntervalMinutesChange,
}: IntervalSettingsTileProps) {
  const { tokens } = useAppTheme();

  return (
    <Tile collapsible={false} floatingTitle title="Settings">
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
          Interval length in minutes
        </Text>
        <TextInput
          keyboardType="number-pad"
          onBlur={onIntervalMinutesBlur}
          onChangeText={onIntervalMinutesChange}
          style={[
            styles.input,
            {
              backgroundColor: tokens.inputSurface,
              borderColor: tokens.border,
              color: tokens.textPrimary,
            },
          ]}
          value={intervalMinutes}
        />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: tokens.textPrimary }]}>
          Alarm duration in seconds
        </Text>
        <TextInput
          keyboardType="number-pad"
          onBlur={onAlarmDurationSecondsBlur}
          onChangeText={onAlarmDurationSecondsChange}
          style={[
            styles.input,
            {
              backgroundColor: tokens.inputSurface,
              borderColor: tokens.border,
              color: tokens.textPrimary,
            },
          ]}
          value={alarmDurationSeconds}
        />
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
});
