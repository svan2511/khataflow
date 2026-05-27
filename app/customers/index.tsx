import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import SidebarDrawer from '@/components/SidebarDrawer';
import { useAuth } from '@/lib/auth-context';
import { api, CustomerData } from '@/lib/api';

export default function CustomersListScreen() {
  const { token } = useAuth();
  const { creditOnly } = useLocalSearchParams<{ creditOnly?: string }>();
  const isCreditFilter = creditOnly === 'true';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUdhaar, setTotalUdhaar] = useState(0);
  const { t } = useTranslation();

  const fetchCustomers = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.listCustomers(token, { per_page: 50, search: search || undefined });
      setCustomers(res.data);
      const udhaar = res.data.reduce((sum, c) => sum + Number(c.total_credit), 0);
      setTotalUdhaar(udhaar);
    } catch (e: any) {
      console.error('Failed to fetch customers', e.message);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useFocusEffect(
    useCallback(() => {
      fetchCustomers();
    }, [fetchCustomers])
  );

  useFocusEffect(
    useCallback(() => {
      if (!search) return;
      const timer = setTimeout(() => fetchCustomers(), 400);
      return () => clearTimeout(timer);
    }, [search])
  );

  const settledCount = customers.filter(c => Number(c.total_credit) === 0).length;
  const visibleCustomers = isCreditFilter
    ? customers.filter(c => Number(c.total_credit) > 0)
    : customers;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.topBtn} onPress={() => setSidebarOpen(true)}>
            <Ionicons name="menu" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.topTitle}>{isCreditFilter ? t('customers.outstandingCustomers') : t('customers.title')}</Text>
            <Text style={styles.topSubtitle}>{isCreditFilter ? `${visibleCustomers.length} ${t('customers.withBalance')}` : `${customers.length} ${t('customers.customers')}`}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/customers/add')}>
          <Ionicons name="person-add" size={18} color={Tokens['on-primary']} />
          <Text style={styles.addText}>{t('customers.addCustomer')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="people" size={18} color={Tokens.secondary} />
            </View>
            <Text style={styles.statValue}>{isCreditFilter ? visibleCustomers.length : customers.length}</Text>
            <Text style={styles.statLabel}>{isCreditFilter ? t('customers.withBalance') : t('customers.totalCustomers')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="arrow-down" size={18} color="#e65100" />
            </View>
            <Text style={[styles.statValue, { color: '#e65100' }]}>
              ₹{Number.isInteger(totalUdhaar) ? totalUdhaar.toLocaleString('en-IN') : totalUdhaar.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.statLabel}>{t('customers.outstandingAmount')}</Text>
          </View>
          {!isCreditFilter && (
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#2e7d32" />
              </View>
              <Text style={[styles.statValue, { color: '#2e7d32' }]}>{settledCount}</Text>
              <Text style={styles.statLabel}>{t('customers.settled')}</Text>
            </View>
          )}
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Tokens.outline} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('customers.searchCustomers')}
              placeholderTextColor={Tokens.outline}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Tokens.secondary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.customerGrid}>
            {visibleCustomers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={Tokens.outline} />
                <Text style={styles.emptyTitle}>{isCreditFilter ? t('customers.noOutstanding') : t('customers.noCustomersYet')}</Text>
                <Text style={styles.emptySub}>
                  {isCreditFilter ? t('customers.allSettled') : t('customers.addFirstCustomer')}
                </Text>
              </View>
            ) : (
              visibleCustomers.map((c) => {
                const credit = Number(c.total_credit);
                const initial = c.name.charAt(0).toUpperCase();
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.customerCard}
                    onPress={() => (router as any).push(`/customers/${c.id}`)}
                    activeOpacity={0.95}
                  >
                    <View style={styles.cardRow}>
                      <View style={[styles.avatar, { backgroundColor: credit > 0 ? Tokens['tertiary-container'] : Tokens['surface-variant'] }]}>
                        <Text style={styles.avatarText}>{initial}</Text>
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.customerName}>{c.name}</Text>
                        <Text style={styles.customerPhone}>{c.phone || t('customers.noPhone')}</Text>
                      </View>
                      <View style={styles.cardRight}>
                        <Text style={[
                          styles.balanceAmount,
                          credit > 0 && { color: Tokens.error },
                        ]}>
                          ₹ {Number.isInteger(credit) ? credit.toLocaleString('en-IN') : credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Text style={styles.balanceLabel}>{credit > 0 ? t('customers.outstanding') : t('customers.settled')}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      <SidebarDrawer
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRoute="/customers"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, height: 64,
    backgroundColor: Tokens.surface,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  topTitle: { fontSize: 20, fontWeight: '700', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold' },
  topSubtitle: { fontSize: 13, color: Tokens['on-surface-variant'], marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Tokens.secondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  addText: { fontSize: 13, fontWeight: '600', color: Tokens['on-primary'] },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 12, paddingBottom: 40, gap: 14 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: Tokens.surface, borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,107,89,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold' },
  statLabel: { fontSize: 11, fontWeight: '500', color: Tokens['on-surface-variant'], letterSpacing: 0.2 },
  searchSection: { gap: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16,
    backgroundColor: Tokens.surface, borderRadius: 14, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: Tokens['on-surface'], fontFamily: 'Inter' },
  customerGrid: { gap: 10 },
  customerCard: {
    backgroundColor: Tokens.surface, borderRadius: 20, padding: 16,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(0,107,89,0.08)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: Tokens['on-tertiary-container'] },
  cardInfo: { flex: 1, minWidth: 0 },
  customerName: { fontSize: 17, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend', marginBottom: 2 },
  customerPhone: { fontSize: 13, color: Tokens['on-surface-variant'] },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  balanceAmount: { fontSize: 18, fontWeight: '700', color: Tokens['on-surface-variant'], fontFamily: 'Lexend-SemiBold' },
  balanceLabel: {
    fontSize: 11, fontWeight: '600', color: Tokens['on-surface-variant'],
    letterSpacing: 0.5,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Tokens['on-surface-variant'] },
  emptySub: { fontSize: 14, color: Tokens.outline, textAlign: 'center', maxWidth: 240 },
});
