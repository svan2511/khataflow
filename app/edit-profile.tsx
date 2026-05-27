import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Loader from '@/components/Loader';
import FullScreenLoader from '@/components/FullScreenLoader';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast-provider';

export default function EditProfileScreen() {
  const { token, user, setUser } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');

  const [logo, setLogo] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.getProfile(token!);
      const shop = response.data.shop;
      if (shop) {
        setShopName(shop.shop_name || '');
        setOwnerName(shop.owner_name || '');
        setAddress(shop.address || '');
        setCity(shop.city || '');
        setState(shop.state || '');
        setPincode(shop.pincode || '');
        setGstin(shop.gstin || '');
        setLogo(shop.logo || null);
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to load profile', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast({ type: 'info', title: 'Permission needed', message: 'Allow gallery access to change logo.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogo(result.assets[0].uri);
      setLogoChanged(true);
    }
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      showToast({ type: 'info', title: 'Required', message: 'Shop name cannot be empty.' });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (shopName) payload.shop_name = shopName;
      if (ownerName) payload.owner_name = ownerName;
      if (address) payload.address = address;
      if (city) payload.city = city;
      if (state) payload.state = state;
      if (pincode) payload.pincode = pincode;
      if (gstin) payload.gstin = gstin;

      let response;
      if (logoChanged && logo) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append('logo', { uri: logo, type: 'image/jpeg', name: 'shop-logo.jpg' } as any);
        response = await api.updateProfile(token!, formData);
      } else {
        response = await api.updateProfile(token!, payload);
      }

      if (response.data?.user && user) {
        setUser(response.data.user);
      }

      showToast({ type: 'success', title: t('profile.savedSuccess'), duration: 1500 });
      setTimeout(() => router.back(), 200);
    } catch (err: any) {
      showToast({ type: 'error', title: t('profile.saveFailed'), message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.flex, styles.center]}>
        <FullScreenLoader />
      </View>
    );
  }

  return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBarButton}>
            <Ionicons name="close" size={24} color={Tokens['on-surface']} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{t('profile.title')}</Text>
          <View style={styles.topBarButton} />
        </View>

        <View style={styles.logoSection}>
          <TouchableOpacity onPress={pickLogo} activeOpacity={0.8} style={styles.logoOuter}>
            <View style={styles.logoContainer}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoEmpty}>
                  <Ionicons name="camera-outline" size={32} color={Tokens['on-surface-variant']} />
                  <Text style={styles.logoEmptyText}>Add Logo</Text>
                </View>
              )}
              <View style={styles.logoOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.logoHint}>Tap to change shop logo</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.shopName')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="storefront-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('profile.shopNamePlaceholder')}
                placeholderTextColor={Tokens.outline}
                value={shopName}
                onChangeText={setShopName}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.ownerName')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('profile.ownerNamePlaceholder')}
                placeholderTextColor={Tokens.outline}
                value={ownerName}
                onChangeText={setOwnerName}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>GSTIN (optional)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="receipt-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="15-digit GSTIN"
                placeholderTextColor={Tokens.outline}
                autoCapitalize="characters"
                maxLength={15}
                value={gstin}
                onChangeText={setGstin}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.address')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="location-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder={t('profile.addressPlaceholder')}
                placeholderTextColor={Tokens.outline}
                multiline
                numberOfLines={3}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>City</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor={Tokens.outline}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.label}>State</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="State"
                  placeholderTextColor={Tokens.outline}
                  value={state}
                  onChangeText={setState}
                />
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Pincode</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="6-digit pincode"
                placeholderTextColor={Tokens.outline}
                keyboardType="number-pad"
                maxLength={6}
                value={pincode}
                onChangeText={setPincode}
              />
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <Loader size={20} color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={Tokens['on-primary']} />
                <Text style={styles.saveButtonText}>{t('profile.save')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: Tokens.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.gutter,
    paddingBottom: Spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    marginBottom: Spacing.md,
  },
  topBarButton: {
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
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoOuter: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: Tokens['surface-container-high'],
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmptyText: {
    fontSize: 12,
    color: Tokens['on-surface-variant'],
    marginTop: 4,
  },
  logoHint: {
    fontSize: 12,
    color: Tokens.outline,
    marginTop: Spacing.sm,
  },
  form: { gap: Spacing.md, marginBottom: Spacing.lg },
  fieldGroup: { gap: Spacing.xs },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Tokens['on-surface-variant'],
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
    backgroundColor: Tokens['surface-container-lowest'],
  },
  inputIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: Tokens['on-surface'],
  },
  textarea: {
    height: 76,
    paddingTop: Spacing.sm,
    alignItems: 'flex-start',
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  actions: {
    marginTop: Spacing.sm,
  },
  saveButton: {
    height: 56,
    backgroundColor: Tokens.secondary,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  saveButtonText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight,
    color: Tokens['on-primary'],
  },
});
