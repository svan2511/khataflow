import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Platform, KeyboardAvoidingView, RefreshControl } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { api, type BillListItem } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import FullScreenLoader from '@/components/FullScreenLoader';

const DATE_FILTERS = ['Today', 'This Week', 'This Month', 'Custom'];

function getDateRange(filter: string): { date_from?: string; date_to?: string } {
  const now = new Date();
  switch (filter) {
    case 'Today': {
      const d = now.toISOString().split('T')[0];
      return { date_from: d, date_to: d };
    }
    case 'This Week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { date_from: start.toISOString().split('T')[0] };
    }
    case 'This Month':
      return { date_from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01` };
    default:
      return {};
  }
}

export default function BillHistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Today');
  const [bills, setBills] = useState<BillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState<Date | null>(null);
  const [customDateTo, setCustomDateTo] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);
  const { token } = useAuth();

  const fetchBills = useCallback(async (search?: string) => {
    if (!token) return;
    try {
      const params: Record<string, string> = {};
      const dateRange = getDateRange(activeFilter);
      if (activeFilter === 'Custom') {
        if (customDateFrom) params.date_from = customDateFrom.toISOString().split('T')[0];
        if (customDateTo) params.date_to = customDateTo.toISOString().split('T')[0];
      } else {
        if (dateRange.date_from) params.date_from = dateRange.date_from;
        if (dateRange.date_to) params.date_to = dateRange.date_to;
      }
      if (search?.trim()) params.search = search.trim();

      const res = await api.listBills(token, { ...params, per_page: 50 });
      setBills(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeFilter, customDateFrom, customDateTo]);

  useEffect(() => {
    setLoading(true);
    fetchBills(searchQuery);
  }, [fetchBills, activeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchBills(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBills(searchQuery);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(null);
      return;
    }
    if (showDatePicker === 'from') {
      setCustomDateFrom(selectedDate || customDateFrom);
    } else if (showDatePicker === 'to') {
      setCustomDateTo(selectedDate || customDateTo);
    }
    if (Platform.OS === 'android') setShowDatePicker(null);
  };

  const formatDate = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filtered = bills;

  const grouped = filtered.reduce((acc, bill) => {
    const date = new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(bill);
    return acc;
  }, {} as Record<string, BillListItem[]>);

  const todayTotal = bills
    .filter(b => new Date(b.created_at).toDateString() === new Date().toDateString())
    .reduce((s, b) => s + b.total, 0);

  const weekTotal = bills.reduce((s, b) => s + b.total, 0);

  const periodLabel = activeFilter === 'Custom'
    ? (customDateFrom && customDateTo
        ? `${formatDate(customDateFrom)} to ${formatDate(customDateTo)}`
        : 'Custom')
    : activeFilter;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'partial': return 'Partial';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return styles.statusPaid;
      case 'partial': return styles.statusPartial;
      case 'pending': return styles.statusPending;
      default: return styles.statusPaid;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Bill History</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Tokens['on-surface-variant']} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by bill no. or customer..."
            placeholderTextColor={Tokens['on-surface-variant']}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DATE_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeFilter === 'Custom' && (
        <View style={styles.customDateRow}>
          <TouchableOpacity style={styles.datePickBtn} onPress={() => setShowDatePicker('from')}>
            <Text style={styles.dateLabel}>From</Text>
            <Text style={[styles.dateValue, !customDateFrom && styles.datePlaceholder]}>
              {customDateFrom ? formatDate(customDateFrom) : 'Select date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.datePickBtn} onPress={() => setShowDatePicker('to')}>
            <Text style={styles.dateLabel}>To</Text>
            <Text style={[styles.dateValue, !customDateTo && styles.datePlaceholder]}>
              {customDateTo ? formatDate(customDateTo) : 'Select date'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {showDatePicker && (
        <DateTimePicker
          value={showDatePicker === 'from' ? (customDateFrom || new Date()) : (customDateTo || new Date())}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{todayTotal}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₹{weekTotal}</Text>
          <Text style={styles.statLabel}>{periodLabel}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{bills.length}</Text>
          <Text style={styles.statLabel}>Bills</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <FullScreenLoader />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {Object.entries(grouped).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={60} color={Tokens['outline-variant']} />
              <Text style={styles.emptyText}>No bills found</Text>
            </View>
          ) : (
            Object.entries(grouped).map(([date, dateBills]) => (
              <View key={date} style={styles.section}>
                <Text style={styles.sectionTitle}>{date}</Text>
                {dateBills.map(bill => (
                  <TouchableOpacity
                    key={bill.id}
                    style={styles.billCard}
                    onPress={() => (router as any).push(`/bill/detail?uuid=${bill.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.billAccent} />
                    <View style={styles.billCardBody}>
                      <View style={styles.billTop}>
                        <View style={styles.billTopLeft}>
                          <Text style={styles.billNo}>{bill.bill_number}</Text>
                          <Text style={styles.billCustomer}>{bill.customer_name || 'Walk-in Customer'}</Text>
                        </View>
                        <View style={styles.billTopRight}>
                          <Text style={styles.billAmount}>₹{bill.total}</Text>
                          <View style={[styles.billStatusBadge, getStatusStyle(bill.payment_status)]}>
                            <Text style={styles.billStatusText}>{getStatusText(bill.payment_status)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.billBottom}>
                        <Text style={styles.billDate}>
                          {new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Tokens.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, height: 56, backgroundColor: Tokens.surface,
    borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.full },
  topBarTitle: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  searchContainer: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 52, backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.xl, paddingHorizontal: 12, gap: 8,
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  searchInput: { flex: 1, fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'] },
  filterRow: { paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.sm },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.lg,
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  filterChipActive: { backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'] },
  filterText: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  filterTextActive: { color: Tokens['on-primary'] },
  customDateRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.gutter,
    paddingBottom: Spacing.sm,
  },
  datePickBtn: {
    flex: 1, backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.lg, padding: 12,
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  dateLabel: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'], marginBottom: 2 },
  dateValue: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'], fontWeight: '500' },
  datePlaceholder: { color: Tokens['on-surface-variant'], fontWeight: '400' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.gutter, marginBottom: Spacing.md },
  statCard: {
    flex: 1, backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.sm, alignItems: 'center', shadowColor: Tokens['surface-tint'],
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  statValue: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  statLabel: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'], marginTop: 2 },
  centerLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, paddingBottom: Spacing.xl, gap: Spacing.md },
  section: {},
  sectionTitle: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'], marginBottom: Spacing.sm },
  billCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  billAccent: { width: 4, backgroundColor: '#006b59' },
  billCardBody: { flex: 1, padding: 14, gap: 10 },
  billTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  billTopLeft: { flex: 1, minWidth: 0, marginRight: 12 },
  billNo: { fontSize: 16, fontWeight: '700', color: '#1c1c1e', fontFamily: 'Lexend-SemiBold' },
  billCustomer: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  billTopRight: { alignItems: 'flex-end' },
  billAmount: { fontSize: 18, fontWeight: '800', color: '#1c1c1e', letterSpacing: -0.3 },
  billStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  billStatusText: { fontSize: 11, fontWeight: '700' },
  billBottom: { flexDirection: 'row', alignItems: 'center' },
  billDate: { fontSize: 12, color: '#9ca3af' },
  statusPaid: { backgroundColor: '#d1fae5' },
  statusPartial: { backgroundColor: '#fef3c7' },
  statusPending: { backgroundColor: '#fee2e2' },
  statusText: { color: '#1c1c1e' },
});
