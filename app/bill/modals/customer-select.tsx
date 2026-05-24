import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useBill } from '@/lib/bill-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast-provider';
import { api, type CustomerData } from '@/lib/api';
import Loader from '@/components/Loader';

export default function CustomerSelectModal() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const { customer, setCustomer } = useBill();
  const { token } = useAuth();
  const { showToast } = useToast();

  const searchCustomers = useCallback(async (q: string) => {
    if (!token) return;
    if (!q.trim()) {
      setCustomers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.searchCustomers(token, q, 20);
      setCustomers(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(search), 300);
    return () => clearTimeout(timer);
  }, [search, searchCustomers]);

  const handleSelect = (c: CustomerData) => {
    setCustomer({ uuid: c.id, name: c.name, phone: c.phone || undefined });
    router.back();
  };

  const handleWalkIn = () => {
    setCustomer(null);
    router.back();
  };

  const handleQuickAdd = async () => {
    if (!token || !quickName.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await api.createCustomer(token, {
        name: quickName.trim(),
        phone: quickPhone.trim() || undefined,
      });
      setCustomer({ uuid: res.data.id, name: res.data.name, phone: res.data.phone || undefined });
      router.back();
    } catch (e: any) {
      const msg = e?.message || 'Failed to create customer';
      setError(msg);
      showToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setAdding(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => router.back()} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Select Customer</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Tokens['on-surface-variant']} />
            </TouchableOpacity>
          </View>

          {!showQuickAdd ? (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={Tokens['on-surface-variant']} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or phone..."
                  placeholderTextColor={Tokens['on-surface-variant']}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
                {loading && <Loader size={18} color={Tokens.secondary} />}
              </View>

              <TouchableOpacity style={[styles.option, !customer && styles.optionActive]} onPress={handleWalkIn}>
                <View style={[styles.iconBox, !customer && styles.iconBoxActive]}>
                  <Ionicons name="person" size={24} color={!customer ? Tokens['on-primary'] : Tokens['on-surface-variant']} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, !customer && styles.optionLabelActive]}>Walk-in Customer</Text>
                  <Text style={styles.optionDesc}>No name or phone needed</Text>
                </View>
                {!customer && <Ionicons name="checkmark-circle" size={22} color={Tokens['primary-container']} />}
              </TouchableOpacity>

              <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {customers.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.option, customer?.uuid === c.id && styles.optionActive]}
                    onPress={() => handleSelect(c)}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons name="person" size={24} color={Tokens.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>{c.name}</Text>
                      <Text style={styles.optionDesc}>{c.phone || 'No phone'}</Text>
                    </View>
                    <Text style={[styles.dueText, { color: c.total_credit > 0 ? Tokens.tertiary : Tokens.secondary }]}>
                      {c.total_credit > 0 ? `Due: ₹${c.total_credit}` : 'No dues'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.addNewBtn} onPress={() => { setShowQuickAdd(true); setError(''); }}>
                <Ionicons name="person-add" size={20} color={Tokens.secondary} />
                <Text style={styles.addNewText}>Add New Customer</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.form}>
                <View>
                  <Text style={styles.label}>Customer Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter name"
                    placeholderTextColor={Tokens['on-surface-variant']}
                    value={quickName}
                    onChangeText={setQuickName}
                    autoFocus
                  />
                </View>
                <View>
                  <Text style={styles.label}>Phone (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number"
                    placeholderTextColor={Tokens['on-surface-variant']}
                    value={quickPhone}
                    onChangeText={setQuickPhone}
                    keyboardType="phone-pad"
                  />
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.addBtn, (!quickName.trim() || adding) && styles.addBtnDisabled]}
                  onPress={handleQuickAdd}
                  disabled={!quickName.trim() || adding}
                  activeOpacity={0.9}
                >
                  {adding ? (
                    <Loader size={20} color={Tokens['on-primary']} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={22} color={Tokens['on-primary']} />
                      <Text style={styles.addBtnText}>Add & Select</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowQuickAdd(false)}>
                  <Text style={styles.cancelText}>Back to Search</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,27,0.5)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%', backgroundColor: Tokens.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm, paddingBottom: Spacing.xl,
  },
  handle: { width: 40, height: 4, backgroundColor: Tokens['outline-variant'], borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  closeBtn: { padding: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 52,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: Tokens['outline-variant'],
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'] },
  list: { gap: 0, marginTop: Spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md, borderRadius: BorderRadius.xl, marginBottom: Spacing.sm,
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  optionActive: { backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'] },
  iconBox: {
    width: 48, height: 48, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['surface-container'], alignItems: 'center', justifyContent: 'center',
  },
  iconBoxActive: { backgroundColor: Tokens['primary-container'] },
  optionLabel: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'] },
  optionLabelActive: { color: Tokens['on-primary'] },
  optionDesc: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  dueText: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any },
  addNewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 52, borderWidth: 2, borderStyle: 'dashed', borderColor: Tokens['outline-variant'],
    borderRadius: BorderRadius.xl, marginTop: Spacing.sm,
  },
  addNewText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens.secondary },
  form: { gap: Spacing.md },
  label: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'], marginBottom: 6 },
  input: {
    height: 56, backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Tokens['outline-variant'], paddingHorizontal: Spacing.md,
    fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'],
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, backgroundColor: Tokens['primary-container'], borderRadius: BorderRadius.xl,
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-primary'] },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelText: { fontSize: Typography['body-md'].fontSize, color: Tokens.secondary },
  errorText: { fontSize: Typography['label-md'].fontSize, color: Tokens.error, textAlign: 'center' },
});
