import FullScreenLoader from '@/components/FullScreenLoader';
import { BorderRadius, Spacing, Tokens, Typography } from '@/constants/theme';
import type { UserProfileData } from '@/lib/api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <FullScreenLoader />
        </View>
      </SafeAreaView>
    );
  }

  const user = profile?.user;
  const shop = profile?.shop;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
        {/* <Text style={styles.topBarTitle}>KhataFlow</Text> */}
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="sync" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {shop?.logo ? (
              <Image source={{ uri: shop.logo }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="storefront" size={48} color={Tokens['on-surface-variant']} style={{ opacity: 0.3 }} />
            )}
          </View>
          <Text style={styles.shopName}>{shop?.shop_name || 'Your Shop'}</Text>
          {shop?.owner_name && (
            <Text style={styles.ownerName}>{shop.owner_name} • Proprietor</Text>
          )}
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={16} color={Tokens['on-secondary-container']} />
            <Text style={styles.badgeText}>Verified Business</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <View style={styles.infoCardRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="call" size={20} color={Tokens.secondary} />
              </View>
              <Text style={styles.infoLabel}>REGISTERED MOBILE</Text>
            </View>
            <Text style={styles.infoValue}>+91 {user?.phone}</Text>
          </View>

          {shop?.gstin && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="receipt" size={20} color={Tokens.secondary} />
                </View>
                <Text style={styles.infoLabel}>GSTIN NUMBER</Text>
              </View>
              <Text style={[styles.infoValue, { fontFamily: 'monospace' }]}>{shop.gstin}</Text>
            </View>
          )}

          {shop?.address && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="location" size={20} color={Tokens.secondary} />
                </View>
                <Text style={styles.infoLabel}>STORE LOCATION</Text>
              </View>
              <Text style={styles.addressText}>
                {[shop.address, shop.city, shop.state, shop.pincode].filter(Boolean).join('\n')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.editButton} activeOpacity={0.9} onPress={() => router.push('/edit-profile')}>
            <Ionicons name="create" size={20} color={Tokens['on-primary']} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpButton} activeOpacity={0.7}>
            <Ionicons name="help-circle-outline" size={20} color={Tokens.outline} />
            <Text style={styles.helpButtonText}>Help & Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Tokens.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    height: 56,
    backgroundColor: Tokens.surface,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  topBarTitle: {
    fontSize: Typography['headline-md'].fontSize,
    fontWeight: '700',
    color: Tokens.secondary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.md,
    paddingBottom: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: Tokens['surface-variant'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 4,
    borderColor: Tokens['surface-container-lowest'],
  },
  avatarImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: Tokens['surface-variant'],
  },
  shopName: {
    fontSize: Typography['headline-lg-mobile'].fontSize,
    fontWeight: Typography['headline-lg-mobile'].fontWeight,
    color: Tokens.primary,
    textAlign: 'center',
  },
  ownerName: {
    fontSize: Typography['body-lg-mobile'].fontSize,
    color: Tokens['on-surface-variant'],
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Tokens['secondary-container'],
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  badgeText: {
    fontSize: Typography['label-md'].fontSize,
    fontWeight: Typography['label-md'].fontWeight,
    color: Tokens['on-secondary-container'],
  },
  infoGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoCard: {
    backgroundColor: Tokens['surface-container-lowest'],
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Tokens['surface-container-low'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: Typography['label-md'].fontSize,
    fontWeight: Typography['label-md'].fontWeight,
    color: Tokens['on-surface-variant'],
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: Typography['headline-sm'].fontSize,
    fontWeight: Typography['headline-sm'].fontWeight,
    color: Tokens.primary,
    paddingLeft: 52,
  },
  addressText: {
    fontSize: Typography['body-lg-mobile'].fontSize,
    color: Tokens['on-surface'],
    lineHeight: Typography['body-lg-mobile'].lineHeight,
    paddingLeft: 52,
  },
  actions: {
    gap: Spacing.sm,
  },
  editButton: {
    height: 56,
    backgroundColor: Tokens.primary,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight,
    color: Tokens['on-primary'],
  },
  helpButton: {
    height: 56,
    backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
  },
  helpButtonText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight,
    color: Tokens['on-surface'],
  },
});
