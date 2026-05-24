import FullScreenLoader from '@/components/FullScreenLoader';
import { Tokens } from '@/constants/theme';
import type { DashboardData } from '@/lib/api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [shopName, setShopName] = useState('Your Shop');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { token } = useAuth();

  const fetchDashboard = useCallback(async (showLoader?: boolean) => {
    if (showLoader) setLoading(true);
    try {
      const [dashRes, profileRes] = await Promise.all([
        api.getDashboard(token!),
        api.getProfile(token!).catch(() => null),
      ]);
      setData(dashRes.data);
      if (profileRes?.data?.shop?.shop_name) setShopName(profileRes.data.shop.shop_name);
    } catch {
      // keep existing data on failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard(!data);
    }, [fetchDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard(false);
  };

  const creditCustomers = data?.credit_customers || [];

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FullScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <View>
           <Text style={styles.shopName}>Welcome</Text>
          <Text style={styles.greeting}>{shopName}</Text>
         
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => (router as any).push('/edit-profile')}>
          <Ionicons name="person-circle-outline" size={32} color={Tokens.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Tokens.secondary} />}
      >
        {/* Today's Sales */}
        <View style={styles.salesCard}>
          <Text style={styles.salesLabel}>Today's Sales</Text>
          <Text style={styles.salesAmount}>₹{(data?.today_sales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <View style={styles.salesFooter}>
            <View style={styles.salesBadge}>
              <Ionicons name="receipt-outline" size={14} color={Tokens['on-secondary']} />
              <Text style={styles.salesBadgeText}>{data?.today_bills_count ?? 0} bills</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="receipt" size={20} color="#2e7d32" />
            </View>
            <Text style={styles.statValue}>{data?.today_bills_count ?? 0}</Text>
            <Text style={styles.statLabel}>Bills</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="cash" size={20} color="#e65100" />
            </View>
            <Text style={styles.statValue}>₹{(data?.total_credit ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
            <Text style={styles.statLabel}>Credit amount</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="people" size={20} color="#1565c0" />
            </View>
            <Text style={styles.statValue}>{creditCustomers.length}</Text>
            <Text style={styles.statLabel}>Creditors</Text>
          </View>
        </View>

        {/* Credit Customers */}
        {creditCustomers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}> Customers on Credit </Text>
            </View>
            <View style={styles.creditList}>
              {creditCustomers.slice(0, 3).map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.creditItem, i === Math.min(creditCustomers.length, 3) - 1 && { borderBottomWidth: 0 }]}
                  activeOpacity={0.7}
                  onPress={() => (router as any).push(`/customers/${c.id}`)}
                >
                  <View style={styles.creditAvatar}>
                    <Text style={styles.creditAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.creditName} numberOfLines={1}>{c.name}</Text>
                    {c.phone && <Text style={styles.creditPhone} numberOfLines={1}>{c.phone}</Text>}
                  </View>
                  <Text style={styles.creditAmount}>₹{c.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => (router as any).push('/customers?creditOnly=true')}
              >
                <Ionicons name="people-outline" size={16} color={Tokens.secondary} />
                <Text style={styles.viewAllText}>View All ({creditCustomers.length})</Text>
                <Ionicons name="chevron-forward" size={16} color={Tokens.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => (router as any).push('/bill')}>
              <View style={[styles.actionIcon, { backgroundColor: '#0891b2' }]}>
                <Ionicons name="add-circle" size={28} color="#fff" />
              </View>
              <Text style={styles.actionText}>New Bill</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => (router as any).push('/bill/history')}>
              <View style={[styles.actionIcon, { backgroundColor: '#7c3aed' }]}>
                <Ionicons name="time" size={28} color="#fff" />
              </View>
              <Text style={styles.actionText}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => (router as any).push('/inventory')}>
              <View style={[styles.actionIcon, { backgroundColor: '#d97706' }]}>
                <Ionicons name="cube" size={28} color="#fff" />
              </View>
              <Text style={styles.actionText}>Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => (router as any).push('/customers')}>
              <View style={[styles.actionIcon, { backgroundColor: '#dc2626' }]}>
                <Ionicons name="people" size={28} color="#fff" />
              </View>
              <Text style={styles.actionText}>Customers</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Bills */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            <TouchableOpacity style={styles.viewAllLink} onPress={() => (router as any).push('/bill/history')}>
              <Text style={styles.viewAllLinkText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={Tokens.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.billsCard}>
            {data?.today_bills?.length ? data.today_bills.map((bill) => (
              <TouchableOpacity key={bill.id} style={styles.billItem} onPress={() => (router as any).push(`/bill/detail?uuid=${bill.id}`)}>
                <View style={styles.billIconWrap}>
                  <Ionicons name="receipt-outline" size={18} color={Tokens.secondary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.billName} numberOfLines={1}>{bill.bill_number}</Text>
                  <Text style={styles.billCustomer} numberOfLines={1}>{bill.customer_name || 'Walk-in Customer'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.billTotal}>₹{bill.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  <View style={[styles.billStatusDot, bill.payment_status === 'paid' ? styles.dotPaid : styles.dotPending]} />
                </View>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyBills}>
                <Ionicons name="receipt-outline" size={36} color="#d1d5db" />
                <Text style={styles.emptyBillsText}>No bills today</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 64, backgroundColor: '#fff',
  },
  greeting: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  shopName: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginTop: 1 },
  profileBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 8, gap: 16 },

  // Sales
  salesCard: {
    backgroundColor: '#006b59', borderRadius: 20, padding: 22,
    shadowColor: '#006b59', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  salesLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  salesAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.5 },
  salesFooter: { flexDirection: 'row', marginTop: 12 },
  salesBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  salesBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1c1c1e' },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },

  // Sections
  section: { gap: 10 },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1c1c1e' },

  // Credit Customers
  creditList: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  creditItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  creditAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center',
  },
  creditAvatarText: { fontSize: 16, fontWeight: '700', color: '#d97706' },
  creditName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  creditPhone: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  creditAmount: { fontSize: 16, fontWeight: '700', color: '#d97706' },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
  },
  viewAllText: { fontSize: 13, fontWeight: '600', color: Tokens.secondary },

  // Quick Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    width: '48%', backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },

  // Recent Bills
  viewAllLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllLinkText: { fontSize: 13, fontWeight: '600', color: '#0891b2' },
  billsCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  billItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  billIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
  },
  billName: { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },
  billCustomer: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  billTotal: { fontSize: 15, fontWeight: '700', color: '#1c1c1e' },
  billStatusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  dotPaid: { backgroundColor: '#16a34a' },
  dotPending: { backgroundColor: '#d97706' },
  emptyBills: { padding: 28, alignItems: 'center', gap: 8 },
  emptyBillsText: { fontSize: 14, color: '#9ca3af' },
});
