import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { getConnectingMessage, type ConnectingKind } from '../services/serverWarmup';

const PRIMARY = '#E8751A';

type Props = {
  visible: boolean;
  kind?: ConnectingKind;
};

/** Full-screen overlay during login while server may be cold-starting. */
export function ConnectingOverlay({ visible, kind = 'server' }: Props) {
  const { isDark } = useAppTheme();
  const [message, setMessage] = useState(getConnectingMessage(0, kind));

  useEffect(() => {
    if (!visible) return;
    const start = Date.now();
    setMessage(getConnectingMessage(0, kind));
    const id = setInterval(() => {
      setMessage(getConnectingMessage(Date.now() - start, kind));
    }, 600);
    return () => clearInterval(id);
  }, [visible, kind]);

  if (!visible) return null;

  const bg = isDark ? 'rgba(12,12,15,0.92)' : 'rgba(245,245,247,0.94)';
  const text = isDark ? '#FFFFFF' : '#0C0C0F';
  const sub = isDark ? '#9A9A9E' : '#6E6E73';

  return (
    <View style={[s.overlay, { backgroundColor: bg }]} accessibilityLabel="Connecting to server" accessibilityRole="progressbar">
      <View style={[s.card, { backgroundColor: isDark ? '#1A1A1F' : '#FFFFFF', borderColor: isDark ? '#2C2C2F' : '#E5E5EA' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={[s.title, { color: text }]}>{message.title}</Text>
        <Text style={[s.subtitle, { color: sub }]}>{message.subtitle}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
