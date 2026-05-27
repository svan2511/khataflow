import FullScreenLoader from '@/components/FullScreenLoader';
import { useToast } from '@/components/toast-provider';
import { Spacing, Tokens } from '@/constants/theme';
import type { UserProfileData } from '@/lib/api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { changeLanguage, getCurrentLanguage, getLanguageLabel } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const settingsMenu = [
  {
    icon: 'receipt-outline' as const,
    title: 'Bill Settings',
    subtitle: 'Customize invoice format and fields',
    route: 'bill-settings' as const,
  },
  {
    icon: 'document-text-outline' as const,
    title: 'Tax & GST',
    subtitle: 'Manage tax rates and HSN codes',
    route: 'tax-gst' as const,
  },
  {
    icon: 'print-outline' as const,
    title: 'Printers',
    subtitle: 'Connect thermal and laser printers',
    route: 'printers' as const,
  },
  {
    icon: 'help-circle-outline' as const,
    title: 'Help',
    subtitle: 'Contact support and tutorials',
    route: 'help' as const,
  },
];

export default function SettingsScreen() {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const { token, signOut } = useAuth();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const [currentLng, setCurrentLng] = useState(getCurrentLanguage());

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.getProfile(token!);
      setProfile(response.data);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const handleSettingsPress = (route: string) => {
    if (route === 'help') {
      Linking.openURL('mailto:support@dukaansahayak.app').catch(() => {
        showToast({ type: 'info', title: t('settings.contactSupport'), message: 'support@dukaansahayak.app' });
      });
      return;
    }
    showToast({ type: 'info', title: t('settings.comingSoon') });
  };

  const toggleLanguage = async () => {
    const newLng = currentLng === 'hi' ? 'en' : 'hi';
    await changeLanguage(newLng);
    setCurrentLng(newLng);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FullScreenLoader />
      </SafeAreaView>
    );
  }

  const user = profile?.user;
  const shop = profile?.shop;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn}>
          <Ionicons name="sync" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{t('settings.title')}</Text>

        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.8}
          onPress={() => router.push('/edit-profile')}
        >
          <View style={styles.profileAvatar}>
            {shop?.logo ? (
              <Image source={{ uri: shop.logo }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="storefront" size={28} color={Tokens['on-secondary-container']} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{shop?.shop_name || t('common.yourShop')}</Text>
            {shop?.owner_name && (
              <Text style={styles.profilePhone}>{shop.owner_name}</Text>
            )}
            <Text style={styles.profileBadge}>+91 {user?.phone}</Text>
          </View>
          <View style={styles.profileEdit}>
            <Ionicons name="chevron-forward" size={22} color={Tokens.outline} />
          </View>
        </TouchableOpacity>

        <View style={styles.settingsGrid}>
          {settingsMenu.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.settingsCard}
              activeOpacity={0.9}
              onPress={() => handleSettingsPress(item.route)}
            >
              <View style={styles.settingsIcon}>
                <Ionicons name={item.icon} size={28} color={Tokens.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsTitle}>{item.title}</Text>
                <Text style={styles.settingsSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Tokens.outline} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.settingsCard}
            activeOpacity={0.9}
            onPress={toggleLanguage}
          >
            <View style={styles.settingsIcon}>
              <Ionicons name="language-outline" size={28} color={Tokens.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTitle}>{t('settings.language')}</Text>
              <Text style={styles.settingsSubtitle} numberOfLines={1}>{getLanguageLabel(currentLng)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Tokens.outline} />
          </TouchableOpacity>
        </View>

        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
            <Ionicons name="log-out-outline" size={20} color={Tokens['on-error']} />
            <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, paddingTop: Spacing.md, paddingBottom: 40, gap: Spacing.md },
  pageTitle: { fontSize: 22, fontWeight: '600', color: Tokens.primary, fontFamily: 'Lexend-SemiBold', marginBottom: 4 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: 16,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(192,200,197,0.5)',
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Tokens['secondary-container'], alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  profileName: { fontSize: 17, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend' },
  profilePhone: { fontSize: 13, color: Tokens['on-surface-variant'], marginTop: 1 },
  profileBadge: { fontSize: 12, color: Tokens.secondary, marginTop: 1 },
  profileEdit: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Tokens['surface-container-low'], alignItems: 'center', justifyContent: 'center',
  },
  settingsGrid: { gap: 8 },
  settingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.gutter,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: 16,
    padding: 12, borderWidth: 1, borderColor: 'rgba(192,200,197,0.5)',
    minHeight: 72,
  },
  settingsIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: Tokens['surface-variant'], alignItems: 'center', justifyContent: 'center',
  },
  settingsTitle: { fontSize: 17, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend', marginBottom: 2 },
  settingsSubtitle: { fontSize: 14, color: Tokens['on-surface-variant'] },
  signOutSection: { alignItems: 'center', paddingVertical: Spacing.md },
  signOutBtn: {
    height: 56, paddingHorizontal: 32, borderRadius: 999,
    backgroundColor: Tokens.error, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: Tokens['on-error'] },
});
