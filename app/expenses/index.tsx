import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Tokens, Spacing } from '@/constants/theme';
import SidebarDrawer from '@/components/SidebarDrawer';
import { useAuth } from '@/lib/auth-context';
import { api, ExpenseData } from '@/lib/api';

const CATEGORIES = [
  'Utilities & Bills',
  'Shop Supplies',
  'Transport & Logistics',
  'Staff Welfare (Tea/Snacks)',
  'Repairs & Maintenance',
  'Restaurant & Kitchen Supplies',
  'Other',
];

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const toKey = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const fmt = (n: number) =>
  Number.isInteger(n)
    ? n.toLocaleString('en-IN')
    : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dayLabel(dateKey: string, t: (k: string) => string) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateKey === toKey(today)) return t('expenses.today');
  if (dateKey === toKey(yesterday)) return t('expenses.yesterday');
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExpensesListScreen() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>('week');
  const [category, setCategory] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [customEnd, setCustomEnd] = useState(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const range = useCallback((): { date_from: string; date_to: string } => {
    const today = new Date();
    if (preset === 'today') {
      const k = toKey(today);
      return { date_from: k, date_to: k };
    }
    if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      const k = toKey(y);
      return { date_from: k, date_to: k };
    }
    if (preset === 'week') {
      const from = new Date();
      from.setDate(today.getDate() - 6);
      return { date_from: toKey(from), date_to: toKey(today) };
    }
    if (preset === 'month') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date_from: toKey(from), date_to: toKey(today) };
    }
    return { date_from: toKey(customStart), date_to: toKey(customEnd) };
  }, [preset, customStart, customEnd]);

  const fetchExpenses = useCallback(async (isRefresh = false) => {
    if (!token) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const { date_from, date_to } = range();
      const res = await api.listExpenses(token, {
        per_page: 100,
        date_from,
        date_to,
        category: category ?? undefined,
      });
      setExpenses(res.data);
    } catch (e: any) {
      console.error('Failed to fetch expenses', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, range, category]);

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [fetchExpenses])
  );

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const { date_from, date_to } = range();
  const dayCount =
    Math.max(
      1,
      Math.round((new Date(date_to).getTime() - new Date(date_from).getTime()) / 86400000) + 1,
    );

  const groups: Array<{ dateKey: string; items: ExpenseData[]; dayTotal: number }> = [];
  expenses.forEach((e) => {
    const dateKey = String(e.expense_date).slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey) {
      last.items.push(e);
      last.dayTotal += Number(e.amount);
    } else {
      groups.push({ dateKey, items: [e], dayTotal: Number(e.amount) });
    }
  });

  const presets: Array<{ key: Preset; label: string }> = [
    { key: 'today', label: t('expenses.today') },
    { key: 'yesterday', label: t('expenses.yesterday') },
    { key: 'week', label: t('expenses.last7Days') },
    { key: 'month', label: t('expenses.thisMonth') },
    { key: 'custom', label: t('expenses.custom') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.topBtn} onPress={() => setSidebarOpen(true)}>
            <Ionicons name="menu" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.topTitle}>{t('expenses.title')}</Text>
            <Text style={styles.topSubtitle}>{expenses.length} {t('expenses.entries')}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => (router as any).push('/expenses/add')}>
          <Ionicons name="add" size={22} color={Tokens.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchExpenses(true)} tintColor={Tokens.secondary} />}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#ffebee' }]}>
              <Ionicons name="wallet" size={18} color="#c62828" />
            </View>
            <Text style={[styles.statValue, { color: '#c62828' }]}>₹{fmt(total)}</Text>
            <Text style={styles.statLabel}>{t('expenses.totalSpent')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="receipt" size={18} color="#1565c0" />
            </View>
            <Text style={styles.statValue}>{expenses.length}</Text>
            <Text style={styles.statLabel}>{t('expenses.entries')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="calendar" size={18} color="#2e7d32" />
            </View>
            <Text style={styles.statValue}>₹{fmt(total / dayCount)}</Text>
            <Text style={styles.statLabel}>{t('expenses.perDayAvg')}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, preset === p.key && styles.chipActive]}
              onPress={() => setPreset(p.key)}
            >
              <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {preset === 'custom' && (
          <View style={styles.dateRangeRow}>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateLabel}>{t('expenses.from')}</Text>
              <Text style={styles.dateValue}>{customStart.toLocaleDateString('en-IN')}</Text>
            </TouchableOpacity>
            <Text style={styles.dateSep}>→</Text>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateLabel}>{t('expenses.to')}</Text>
              <Text style={styles.dateValue}>{customEnd.toLocaleDateString('en-IN')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
            <Text style={[styles.selectText, !category && { color: Tokens.outline }]}>
              {category || t('expenses.allCategories')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={styles.pickerDropdown}>
              <TouchableOpacity
                style={[styles.pickerItem, !category && styles.pickerItemActive]}
                onPress={() => { setCategory(null); setShowCategoryPicker(false); }}
              >
                <Text style={[styles.pickerText, !category && styles.pickerTextActive]}>{t('expenses.allCategories')}</Text>
                {!category && <Ionicons name="checkmark" size={18} color={Tokens.secondary} />}
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.pickerItem, category === cat && styles.pickerItemActive]}
                  onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                >
                  <Text style={[styles.pickerText, category === cat && styles.pickerTextActive]}>{cat}</Text>
                  {category === cat && <Ionicons name="checkmark" size={18} color={Tokens.secondary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Tokens.secondary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="wallet-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>{t('expenses.noExpenses')}</Text>
            <Text style={styles.emptyHint}>{t('expenses.noExpensesHint')}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => (router as any).push('/expenses/add')}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>{t('expenses.addExpense')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.dateKey} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{dayLabel(g.dateKey, t)}</Text>
                <Text style={styles.dayTotal}>₹{fmt(g.dayTotal)}</Text>
              </View>
              <View style={styles.dayCard}>
                {g.items.map((e, i) => (
                  <View key={e.id} style={[styles.expenseRow, i === g.items.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.expenseIcon}>
                      <Ionicons name="receipt-outline" size={18} color={Tokens.secondary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.expenseTitle} numberOfLines={1}>{e.title}</Text>
                      {!!e.category && <Text style={styles.expenseCategory} numberOfLines={1}>{e.category}</Text>}
                    </View>
                    <Text style={styles.expenseAmount}>₹{fmt(Number(e.amount))}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {showStartPicker && (
        <DateTimePicker
          value={customStart}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={customEnd}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type === 'dismissed' || Platform.OS !== 'ios') setShowStartPicker(false);
            if (date) setCustomStart(date);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={customEnd}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={customStart}
          maximumDate={new Date()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type === 'dismissed' || Platform.OS !== 'ios') setShowEndPicker(false);
            if (date) setCustomEnd(date);
          }}
        />
      )}

      <SidebarDrawer visible={sidebarOpen} onClose={() => setSidebarOpen(false)} activeRoute="/expenses" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Tokens.surface },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, height: 64, backgroundColor: Tokens['surface-container-lowest'],
    borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'],
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  topTitle: { fontSize: 20, fontWeight: '600', color: Tokens.primary, fontFamily: 'Lexend-SemiBold' },
  topSubtitle: { fontSize: 13, color: Tokens['on-surface-variant'], fontFamily: 'Inter' },
  addBtn: {
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24,
    backgroundColor: Tokens['secondary-container'],
  },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: Tokens['surface-container-lowest'], borderRadius: 12, padding: 12,
    alignItems: 'center', gap: 4,
    shadowColor: '#00332b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 2,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: Tokens.primary, fontFamily: 'Lexend-SemiBold' },
  statLabel: { fontSize: 11, color: Tokens['on-surface-variant'], fontFamily: 'Inter', textAlign: 'center' },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 16, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: 999, backgroundColor: Tokens['surface-container-lowest'],
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  chipActive: { backgroundColor: Tokens.secondary, borderColor: Tokens.secondary },
  chipText: { fontSize: 14, fontWeight: '600', color: Tokens['on-surface-variant'], fontFamily: 'Inter-SemiBold' },
  chipTextActive: { color: Tokens['on-primary'] },
  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateField: {
    flex: 1, height: 56, paddingHorizontal: 14, justifyContent: 'center',
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1,
    borderColor: Tokens['outline-variant'], borderRadius: 12,
  },
  dateLabel: { fontSize: 11, color: Tokens['on-surface-variant'], fontFamily: 'Inter' },
  dateValue: { fontSize: 16, color: Tokens['on-surface'], fontFamily: 'Inter-SemiBold' },
  dateSep: { fontSize: 16, color: Tokens['on-surface-variant'] },
  selectBtn: {
    height: 56, paddingHorizontal: 14,
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 16, color: Tokens['on-surface'], fontFamily: 'Inter', flex: 1 },
  pickerDropdown: {
    marginTop: 4, backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1,
    borderColor: Tokens['outline-variant'], borderRadius: 12, overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'],
  },
  pickerItemActive: { backgroundColor: 'rgba(157,243,220,0.2)' },
  pickerText: { fontSize: 14, color: Tokens['on-surface'], fontFamily: 'Inter' },
  pickerTextActive: { color: Tokens.secondary, fontWeight: '600' },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Inter-SemiBold', marginTop: 8 },
  emptyHint: { fontSize: 14, color: Tokens['on-surface-variant'], fontFamily: 'Inter' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    height: 56, paddingHorizontal: 20, borderRadius: 12, backgroundColor: Tokens.secondary,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff', fontFamily: 'Inter-SemiBold' },
  daySection: { gap: 8 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  dayTitle: { fontSize: 15, fontWeight: '600', color: Tokens.primary, fontFamily: 'Lexend-SemiBold' },
  dayTotal: { fontSize: 15, fontWeight: '700', color: '#c62828', fontFamily: 'Lexend-SemiBold' },
  dayCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: 12, paddingHorizontal: 14,
    shadowColor: '#00332b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 2,
  },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'], minHeight: 72,
  },
  expenseIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Tokens['secondary-container'],
    alignItems: 'center', justifyContent: 'center',
  },
  expenseTitle: { fontSize: 16, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Inter-SemiBold' },
  expenseCategory: { fontSize: 13, color: Tokens['on-surface-variant'], fontFamily: 'Inter', marginTop: 2 },
  expenseAmount: { fontSize: 16, fontWeight: '700', color: '#c62828', fontFamily: 'Lexend-SemiBold' },
});
