import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView,
  Platform, Image, Animated, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Loader from '@/components/Loader';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast-provider';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

const STEPS = ['Details', 'Location', 'Logo'];

export default function ShopSetupScreen() {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const { token, user, setUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateToStep = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(nextStep > step ? width : -width);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const nextStep = () => {
    if (step === 0 && !shopName.trim()) {
      showToast({ type: 'info', title: t('common.required'), message: t('shopSetup.shopNameRequired') });
      return;
    }
    animateToStep(step + 1);
  };

  const prevStep = () => animateToStep(step - 1);

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast({ type: 'info', title: t('common.permissionNeeded'), message: t('shopSetup.galleryPermission') });
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
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (logo) {
        const formData = new FormData();
        formData.append('shop_name', shopName);
        formData.append('owner_name', ownerName);
        formData.append('address', address);
        formData.append('city', city);
        formData.append('state', state);
        formData.append('pincode', pincode);
        formData.append('gstin', gstin);
        formData.append('logo', { uri: logo, type: 'image/jpeg', name: 'shop-logo.jpg' } as any);
        await api.setupShopWithLogo(token!, formData);
      } else {
        await api.setupShop(token!, {
          shop_name: shopName,
          owner_name: ownerName,
          address, city, state, pincode, gstin,
        });
      }
      setUser({ ...user!, has_shop: true });
      router.replace('/(tabs)');
    } catch (err: any) {
      showToast({ type: 'error', title: t('shopSetup.setupFailed'), message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={false}
        scrollEnabled={true}
      >
        <View style={styles.card}>
          <View style={styles.headerSection}>
            <View style={styles.brandBadge}>
              <Ionicons name="storefront" size={22} color={Tokens['on-secondary-container']} />
            </View>
            <Text style={styles.title}>{t('shopSetup.title')}</Text>
            <Text style={styles.subtitle}>{t('shopSetup.step')} {step + 1} {t('common.of')} {STEPS.length} — {t(`shopSetup.${STEPS[step].toLowerCase()}`)}</Text>
          </View>

          <View style={styles.progress}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          <Animated.View
            style={[
              styles.stepContent,
              { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
          >
            {step === 0 && (
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('shopSetup.shopName')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="storefront-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('shopSetup.shopNamePlaceholder')}
                      placeholderTextColor={Tokens.outline}
                      value={shopName}
                      onChangeText={setShopName}
                    />
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('shopSetup.ownerName')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('shopSetup.ownerNamePlaceholder')}
                      placeholderTextColor={Tokens.outline}
                      value={ownerName}
                      onChangeText={setOwnerName}
                    />
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('shopSetup.gstin')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="receipt-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('shopSetup.gstinPlaceholder')}
                      placeholderTextColor={Tokens.outline}
                      autoCapitalize="characters"
                      maxLength={15}
                      value={gstin}
                      onChangeText={setGstin}
                    />
                  </View>
                </View>
              </View>
            )}

            {step === 1 && (
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('shopSetup.address')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="location-outline" size={18} color={Tokens['on-surface-variant']} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      placeholder={t('shopSetup.addressPlaceholder')}
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
                    <Text style={styles.label}>{t('shopSetup.city')}</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder={t('shopSetup.city')}
                        placeholderTextColor={Tokens.outline}
                        value={city}
                        onChangeText={setCity}
                      />
                    </View>
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{t('shopSetup.state')}</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder={t('shopSetup.state')}
                        placeholderTextColor={Tokens.outline}
                        value={state}
                        onChangeText={setState}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.label}>{t('shopSetup.pincode')}</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder={t('shopSetup.pincodePlaceholder')}
                        placeholderTextColor={Tokens.outline}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={pincode}
                        onChangeText={setPincode}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.logoStep}>
                <Text style={styles.logoStepTitle}>{t('shopSetup.addLogo')}</Text>
                <Text style={styles.logoStepSub}>{t('shopSetup.logoSubtitle')}</Text>
                <TouchableOpacity onPress={pickLogo} activeOpacity={0.8} style={styles.logoOuter}>
                  <View style={styles.logoContainer}>
                    {logo ? (
                      <>
                        <Image source={{ uri: logo }} style={styles.logoImage} />
                        <View style={styles.logoOverlay}>
                          <Ionicons name="camera" size={22} color="#fff" />
                        </View>
                      </>
                    ) : (
                      <View style={styles.logoEmpty}>
                        <Ionicons name="camera-outline" size={36} color={Tokens['on-surface-variant']} />
                        <Text style={styles.logoEmptyText}>{t('shopSetup.tapToAdd')}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <Text style={styles.logoHint}>{t('shopSetup.logoHint')}</Text>

                <View style={styles.divider} />

                <View style={styles.reviewSection}>
                  <Text style={styles.reviewTitle}>{t('shopSetup.summary')}</Text>
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>{t('shopSetup.shop')}</Text>
                    <Text style={styles.reviewValue}>{shopName || '—'}</Text>
                  </View>
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>{t('shopSetup.owner')}</Text>
                    <Text style={styles.reviewValue}>{ownerName || '—'}</Text>
                  </View>
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>{t('shopSetup.city')}</Text>
                    <Text style={styles.reviewValue}>{city || '—'}</Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>

          <View style={styles.actions}>
            {step > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={prevStep} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={20} color={Tokens['on-surface-variant']} />
                <Text style={styles.backText}>{t('common.back')}</Text>
              </TouchableOpacity>
            )}
            {step < STEPS.length - 1 ? (
              <TouchableOpacity style={styles.nextButton} onPress={nextStep} activeOpacity={0.9}>
                <Text style={styles.nextText}>{t('common.continue')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.nextButton, loading && styles.buttonDisabled]}
                onPress={handleComplete}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <Loader size={20} color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.nextText}>{t('shopSetup.finishSetup')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Tokens.background },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing['margin-mobile'],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  brandBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Tokens['secondary-container'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Tokens['on-surface'],
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Tokens['on-surface-variant'],
    marginTop: 2,
  },

  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Tokens['outline-variant'],
  },
  progressDotActive: {
    backgroundColor: Tokens.secondary,
    width: 24,
  },

  stepContent: {
    minHeight: 260,
  },

  form: { gap: Spacing.md },

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

  logoStep: { alignItems: 'center', paddingVertical: Spacing.sm },
  logoStepTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Tokens['on-surface'],
  },
  logoStepSub: {
    fontSize: 13,
    color: Tokens['on-surface-variant'],
    marginTop: 2,
    marginBottom: Spacing.md,
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
    height: 36,
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

  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Tokens['outline-variant'],
    marginVertical: Spacing.md,
  },

  reviewSection: {
    width: '100%',
    gap: Spacing.sm,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Tokens['on-surface'],
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  reviewLabel: { fontSize: 13, color: Tokens['on-surface-variant'] },
  reviewValue: { fontSize: 13, fontWeight: '500', color: Tokens['on-surface'] },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
  },
  backText: { fontSize: 14, fontWeight: '500', color: Tokens['on-surface-variant'] },
  nextButton: {
    flex: 1,
    height: 48,
    backgroundColor: Tokens.secondary,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  buttonDisabled: { opacity: 0.5 },
  nextText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
