import { View, Text, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { isServerAlwaysOn } from '../services/serverWarmup';

const PRIMARY = '#E8751A';

/** Shown instantly while auth restores from storage — no API calls. */
export function AppBootScreen() {
  const { isDark } = useAppTheme();
  const bg = isDark ? '#0C0C0F' : '#F5F5F7';
  const sub = isDark ? '#9A9A9E' : '#6E6E73';

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={s.logoWrap}>
        <Image source={require('../assets/icon.png')} style={s.logo} resizeMode="contain" />
      </View>
      <Text style={[s.name, { color: isDark ? '#FFFFFF' : '#0C0C0F' }]}>AllConnect</Text>
      <Text style={[s.sub, { color: sub }]}>
        {isServerAlwaysOn() ? 'Loading…' : 'Getting things ready…'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  logo: { width: 64, height: 64 },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 14, marginTop: 8, fontWeight: '500' },
});
