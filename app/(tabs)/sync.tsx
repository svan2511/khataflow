import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

export default function SyncScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>KhataFlow</Text>
        <View style={styles.topBtn} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-outline" size={64} color={Tokens.secondary} />
        </View>
        <Text style={styles.title}>{t('sync.dataSync')}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('sync.comingSoon')}</Text>
        </View>
        <Text style={styles.sub}>{t('sync.comingSoonSub')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Tokens.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, height: 56, backgroundColor: Tokens.surface,
    borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'],
  },
  topBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  topTitle: { fontSize: 20, fontWeight: '700', color: Tokens.secondary, fontFamily: 'Lexend-SemiBold' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  iconWrap: {
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: Tokens['secondary-container'],
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold', textAlign: 'center' },
  badge: {
    backgroundColor: Tokens['tertiary-container'] ?? '#fef3c7',
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: Tokens.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sub: { fontSize: 14, color: Tokens['on-surface-variant'], textAlign: 'center', lineHeight: 20, marginTop: 4 },
});
