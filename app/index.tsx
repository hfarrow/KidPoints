import { StyleSheet, Text, View } from 'react-native';

export default function RebuildHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>KidPoints</Text>
      <Text style={styles.title}>Rebuild in progress</Text>
      <Text style={styles.body}>
        The app shell is reset and ready for us to rebuild features layer by
        layer.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: '#4b5563',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 280,
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
});
