import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBill } from '@/lib/bill-context';
import { useAuth } from '@/lib/auth-context';
import { api, type CustomerData } from '@/lib/api';
import Loader from '@/components/Loader';
import { useTranslation } from 'react-i18next';

export default function CustomerSelectScreen() {
  const { t } = useTranslation();
  const { customer, setCustomer } = useBill();
  const { token } = useAuth();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = useCallback(async (q?: string) => {
    if (!token) return;
    try {
      const res = await api.searchCustomers(token, q || undefined, 50);
      setCustomers(res.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => fetchCustomers(search), 200);
    return () => clearTimeout(timer);
  }, [search, fetchCustomers]);

  const handleSelect = (c: CustomerData) => {
    setCustomer({ uuid: c.id, name: c.name, phone: c.phone || undefined });
    (router as any).push('/bill/items');
  };

  const handleWalkIn = () => {
    setCustomer(null);
    (router as any).push('/bill/items');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={24} color="#1c1c1e" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('bill.newBill')}</Text>
        <TouchableOpacity onPress={() => (router as any).push('/bill/history')} style={styles.topBtn}>
          <Ionicons name="receipt-outline" size={22} color="#1c1c1e" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('bill.searchCustomers')}
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {loading && <Loader size={18} color="#0891b2" />}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.walkInCard} onPress={handleWalkIn} activeOpacity={0.7}>
          <View style={styles.walkInIcon}>
            <Ionicons name="person-outline" size={26} color="#0891b2" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walkInName}>{t('bill.walkInCustomer')}</Text>
            <Text style={styles.walkInSub}>{t('bill.walkInSubtitle')}</Text>
          </View>
          <View style={styles.arrowBtn}>
            <Ionicons name="arrow-forward" size={18} color="#0891b2" />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('bill.savedCustomers')}</Text>
          <Text style={styles.sectionCount}>{customers.length}</Text>
        </View>

        {customers.length === 0 && !loading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>{t('bill.noCustomersYet')}</Text>
          </View>
        ) : (
          customers.map(c => (
            <TouchableOpacity key={c.id} style={styles.customerCard} onPress={() => handleSelect(c)} activeOpacity={0.7}>
              <View style={styles.customerAvatar}>
                <Text style={styles.avatarLetter}>{c.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{c.name}</Text>
                <Text style={styles.customerPhone}>{c.phone || t('customers.noPhone')}</Text>
              </View>
              <View style={styles.customerRight}>
                {c.total_credit > 0 && (
                  <View style={styles.creditBadge}>
                    <Text style={styles.creditText}>₹{c.total_credit}</Text>
                  </View>
                )}
                <Ionicons name="add-circle" size={28} color="#0891b2" />
              </View>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.addCustomerBtn} onPress={() => (router as any).push('/customers/add?returnTo=bill')}>
          <Ionicons name="person-add-outline" size={20} color="#0891b2" />
          <Text style={styles.addCustomerText}>{t('bill.addNewCustomer')}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, height: 56, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eef1f4',
  },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  topTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, gap: 8,
    borderWidth: 1, borderColor: '#eef1f4',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1c1c1e' },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingTop: 8, paddingBottom: 200, gap: 10 },
  walkInCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  walkInIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#e8f4f8', alignItems: 'center', justifyContent: 'center',
  },
  walkInName: { fontSize: 16, fontWeight: '600', color: '#1c1c1e' },
  walkInSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  arrowBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: '#eef1f4', marginVertical: 4 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 2, marginTop: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  customerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  customerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: '#0891b2' },
  customerName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  customerPhone: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  customerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creditBadge: {
    backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  creditText: { fontSize: 12, fontWeight: '700', color: '#d97706' },
  addCustomerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db',
    marginTop: 2,
  },
  addCustomerText: { fontSize: 15, fontWeight: '600', color: '#0891b2' },
});
