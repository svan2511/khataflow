import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast-provider';

export default function AddEditCustomerScreen() {
  const { token } = useAuth();
  const { id, returnTo } = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const isEditing = !!id;
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (isEditing && token) loadCustomer();
  }, [id, token]);

  const loadCustomer = async () => {
    if (!token || !id) return;
    try {
      const res = await api.getCustomer(token, id);
      setFullName(res.data.name);
      setMobile(res.data.phone || '');
    } catch (e: any) {
      showToast({ type: 'error', title: t('common.error'), message: t('customers.loadFailed') });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (!fullName.trim()) {
      showToast({ type: 'error', title: t('common.validation'), message: t('customers.nameRequired') });
      return;
    }

    setSaving(true);
    try {
      if (isEditing && id) {
        await api.updateCustomerFull(token, id, {
          name: fullName.trim(),
          phone: mobile.trim() || undefined,
        });
        showToast({ type: 'success', title: t('common.success'), message: t('customers.updatedSuccess') });
        router.back();
      } else {
        const res = await api.createCustomer(token, {
          name: fullName.trim(),
          phone: mobile.trim() || undefined,
        });
        showToast({ type: 'success', title: t('common.success'), message: t('customers.savedSuccess') });
        if (returnTo === 'bill') {
          (router as any).replace({
            pathname: '/bill/items',
            params: {
              newCustomerId: res.data.id,
              newCustomerName: res.data.name,
              newCustomerPhone: res.data.phone || '',
            },
          });
        } else {
          router.back();
        }
      }
    } catch (e: any) {
      showToast({ type: 'error', title: t('common.error'), message: e.message || t('customers.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator size="large" color={Tokens.secondary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isEditing ? t('customers.editCustomer') : t('customers.addCustomer')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formCard}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('customers.customerIdentity')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('customers.customerName')} <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="id-card-outline" size={18} color={Tokens.outline} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('customers.customerNamePlaceholder')}
                  placeholderTextColor={Tokens['outline-variant']}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('customers.phoneNumber')}</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <View style={styles.phoneInputWrap}>
                  <Ionicons name="call-outline" size={18} color={Tokens.outline} style={styles.phoneIcon} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder={t('customers.phonePlaceholder')}
                    placeholderTextColor={Tokens['outline-variant']}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={mobile}
                    onChangeText={setMobile}
                  />
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Tokens['on-primary']} />
            ) : (
              <>
                <Ionicons name="save" size={20} color={Tokens['on-primary']} />
                <Text style={styles.saveBtnText}>{isEditing ? t('customers.updateCustomer') : t('customers.save')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, height: 60,
    backgroundColor: Tokens.surface,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  topTitle: { fontSize: 18, fontWeight: '700', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 16 },
  formCard: {
    backgroundColor: Tokens.surface, borderRadius: 18, padding: 16, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 17, fontWeight: '600', color: Tokens['on-surface'],
    fontFamily: 'Lexend', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  fieldGroup: { gap: 4 },
  label: { fontSize: 13, fontWeight: '500', color: Tokens['on-surface-variant'], marginLeft: 4 },
  required: { color: Tokens.error },
  inputWrapper: { position: 'relative', height: 50, justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },
  input: {
    height: 50, paddingLeft: 42, paddingRight: 14,
    backgroundColor: Tokens.surface, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 12,
    fontSize: 15, color: Tokens['on-surface'], fontFamily: 'Inter',
  },
  phoneRow: { flexDirection: 'row', gap: 0 },
  countryCode: {
    height: 50, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f8faf9', borderWidth: 1, borderRightWidth: 0,
    borderColor: 'rgba(0,0,0,0.08)', borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
  },
  countryCodeText: { fontSize: 14, color: Tokens['on-surface-variant'], fontFamily: 'Inter' },
  phoneInputWrap: { flex: 1, position: 'relative', height: 50, justifyContent: 'center' },
  phoneIcon: { position: 'absolute', left: 14, zIndex: 1 },
  phoneInput: {
    height: 50, paddingLeft: 42, paddingRight: 14,
    backgroundColor: Tokens.surface, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    fontSize: 15, color: Tokens['on-surface'], fontFamily: 'Inter',
  },
  saveBtn: {
    height: 54, backgroundColor: Tokens.secondary, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: Tokens['on-primary'] },
});
