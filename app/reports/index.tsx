import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api, DailyReport, MonthlyReport } from '@/lib/api';

const displayUnit = (unit?: string) => unit || 'pcs';

export default function ReportsScreen() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async (showLoader?: boolean) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      if (period === 'daily') {
        const res = await api.getDailyReport(token);
        setDailyReport(res.data);
      } else {
        const now = new Date();
        const res = await api.getMonthlyReport(token, now.getFullYear(), now.getMonth() + 1);
        setMonthlyReport(res.data);
      }
    } catch (e: any) {
      console.error('Failed to fetch report', e.message);
      if (period === 'monthly') setMonthlyReport(null);
      else setDailyReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, period]);

  useEffect(() => {
    fetchReport(true);
  }, [fetchReport]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReport(false);
  };

  const totalSales = period === 'daily'
    ? dailyReport?.total_sales ?? 0
    : monthlyReport?.current_month.total_sales ?? 0;

  const totalBills = period === 'daily'
    ? dailyReport?.total_bills ?? 0
    : monthlyReport?.current_month.total_bills ?? 0;

  const avgBillValue = period === 'daily'
    ? dailyReport?.average_bill_value ?? 0
    : monthlyReport?.current_month.average_per_day ?? 0;

  const paymentBreakdown = period === 'daily'
    ? dailyReport?.payment_breakdown
    : monthlyReport?.current_month.payment_breakdown;

  const topProducts = period === 'daily'
    ? dailyReport?.top_products ?? []
    : monthlyReport?.current_month.top_products ?? [];

  const growth = monthlyReport?.comparison.sales_growth_percentage;

  const label = period === 'daily' ? '/bill' : '/day';

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const rows = topProducts.length > 0 ? topProducts.map((p, i) =>
        `<tr><td>${i + 1}</td><td>${p.product_name}</td><td>${Number(p.total_quantity)} ${displayUnit(p.unit)}</td><td>₹${Number(p.total_revenue).toLocaleString('en-IN')}</td></tr>`
      ).join('') : '<tr><td colspan="4">No data</td></tr>';

      const html = `
<html>
<head><meta charset="utf-8"><style>
body{font-family:sans-serif;padding:40px;color:#333}
h1{color:#006b59;font-size:24px;margin:0}
.date{color:#666;margin:4px 0 20px}
.summary{display:flex;gap:20px;margin-bottom:20px}
.card{background:#f4f6f8;padding:16px;border-radius:8px;flex:1}
.card h3{margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase}
.card .val{font-size:22px;font-weight:700;color:#006b59}
table{width:100%;border-collapse:collapse;margin-top:16px}
th{text-align:left;padding:8px 4px;border-bottom:2px solid #006b59;color:#006b59;font-size:12px;text-transform:uppercase}
td{padding:8px 4px;border-bottom:1px solid #e0e0e0}
</style></head>
<body>
<h1>${period === 'daily' ? 'Daily' : 'Monthly'} Sales Report</h1>
<p class="date">${now}</p>
<div class="summary">
<div class="card"><h3>Total Sales</h3><div class="val">₹${Number(totalSales).toLocaleString('en-IN')}</div></div>
<div class="card"><h3>Total Bills</h3><div class="val">${totalBills}</div></div>
<div class="card"><h3>Avg Value</h3><div class="val">₹${Number(avgBillValue).toFixed(0)}</div></div>
</div>
<h2>Top Products</h2>
<table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch {
      // silently fail
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Reports</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator size="large" color={Tokens.secondary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Reports</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleExportPDF} disabled={exporting}>
            <Ionicons name={exporting ? 'hourglass' : 'download-outline'} size={22} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setLoading(true); fetchReport(true); }}>
            <Ionicons name="refresh" size={22} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Tokens.secondary} />}
      >
        {/* Period Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, period === 'daily' && styles.toggleBtnActive]}
            onPress={() => setPeriod('daily')}
          >
            <Ionicons name="sunny-outline" size={16} color={period === 'daily' ? '#fff' : Tokens['on-surface-variant']} />
            <Text style={[styles.toggleText, period === 'daily' && styles.toggleTextActive]}>Daily</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, period === 'monthly' && styles.toggleBtnActive]}
            onPress={() => setPeriod('monthly')}
          >
            <Ionicons name="calendar-outline" size={16} color={period === 'monthly' ? '#fff' : Tokens['on-surface-variant']} />
            <Text style={[styles.toggleText, period === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
          </TouchableOpacity>
        </View>

        {/* Sales Card */}
        <View style={styles.salesCard}>
          <View style={styles.salesCardTop}>
            <Text style={styles.salesLabel}>Total Sales</Text>
            {growth !== undefined && (
              <View style={[styles.growthBadge, growth >= 0 ? styles.growthPositive : styles.growthNegative]}>
                <Ionicons name={growth >= 0 ? 'trending-up' : 'trending-down'} size={12} color={growth >= 0 ? '#16a34a' : '#dc2626'} />
                <Text style={[styles.growthText, { color: growth >= 0 ? '#16a34a' : '#dc2626' }]}>
                  {growth >= 0 ? '+' : ''}{growth}%
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.salesAmount}>₹{Number(totalSales).toLocaleString('en-IN')}</Text>
          <View style={styles.salesFooter}>
            <View style={styles.salesBadge}>
              <Ionicons name="receipt-outline" size={14} color={Tokens['on-secondary']} />
              <Text style={styles.salesBadgeText}>{totalBills} bills</Text>
            </View>
            <View style={styles.salesBadge}>
              <Ionicons name="trending-up-outline" size={14} color={Tokens['on-secondary']} />
              <Text style={styles.salesBadgeText}>Avg ₹{Number(avgBillValue).toFixed(0)}{label}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="receipt" size={20} color="#2e7d32" />
            </View>
            <Text style={styles.statValue}>{totalBills}</Text>
            <Text style={styles.statLabel}>Bills</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="cash-outline" size={20} color="#1565c0" />
            </View>
            <Text style={styles.statValue}>₹{Number(totalSales).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="analytics-outline" size={20} color="#7c3aed" />
            </View>
            <Text style={styles.statValue}>₹{Number(avgBillValue).toFixed(0)}</Text>
            <Text style={styles.statLabel}>{period === 'daily' ? 'Avg/Bill' : 'Avg/Day'}</Text>
          </View>
        </View>

        {/* Payment Breakdown */}
        {paymentBreakdown && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="wallet-outline" size={18} color={Tokens.secondary} />
              <Text style={styles.cardTitle}>Payment Breakdown</Text>
            </View>
            <View style={styles.breakdownList}>
              {(['cash', 'upi', 'card', 'credit'] as const).map(method => {
                const amount = Number((paymentBreakdown as any)[method] || 0);
                if (amount <= 0) return null;
                const total = Object.values(paymentBreakdown).reduce((a: number, b: any) => a + Number(b), 0);
                const pct = total > 0 ? (amount / total * 100) : 0;
                const icons: Record<string, string> = { cash: 'cash-outline', upi: 'phone-portrait-outline', card: 'card-outline', credit: 'wallet-outline' };
                const colors: Record<string, string> = { cash: '#2e7d32', upi: '#1565c0', card: '#7c3aed', credit: '#d97706' };
                return (
                  <View key={method} style={styles.breakdownRow}>
                    <View style={[styles.breakdot, { backgroundColor: colors[method] }]} />
                    <Text style={styles.breakdownLabel}>{method.charAt(0).toUpperCase() + method.slice(1)}</Text>
                    <View style={styles.breakdownBarBg}>
                      <View style={[styles.breakdownBar, { width: `${pct}%`, backgroundColor: colors[method] }]} />
                    </View>
                    <Text style={styles.breakdownAmount}>₹{amount.toLocaleString('en-IN')}</Text>
                    <Text style={styles.breakdownPct}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Top Items */}
        {topProducts.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="basket-outline" size={18} color={Tokens.secondary} />
              <Text style={styles.cardTitle}>Top Items</Text>
            </View>
            {topProducts.map((item, i) => (
              <View key={i} style={styles.topItem}>
                <View style={styles.topItemRank}>
                  <Text style={styles.topItemRankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.topItemName} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={styles.topItemUnits}>
                    {Number(item.total_quantity)} {displayUnit(item.unit)} sold
                  </Text>
                </View>
                <Text style={styles.topItemRevenue}>₹{Number(item.total_revenue).toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bar-chart-outline" size={36} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No data for this period</Text>
            <Text style={styles.emptySub}>Start billing to see reports here.</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fa' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 64, backgroundColor: '#fff',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  topTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', fontFamily: 'Lexend-SemiBold' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 12, paddingBottom: 40, gap: 16 },

  // Toggle
  toggleRow: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
  },
  toggleBtnActive: { backgroundColor: Tokens.secondary },
  toggleText: { fontSize: 14, fontWeight: '600', color: Tokens['on-surface-variant'] },
  toggleTextActive: { color: '#fff' },

  // Sales Card
  salesCard: {
    backgroundColor: '#006b59', borderRadius: 20, padding: 22,
    shadowColor: '#006b59', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  salesCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  salesLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  growthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  growthPositive: { backgroundColor: 'rgba(22,163,74,0.15)' },
  growthNegative: { backgroundColor: 'rgba(220,38,38,0.15)' },
  growthText: { fontSize: 11, fontWeight: '700' },
  salesAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 6, letterSpacing: -0.5 },
  salesFooter: { flexDirection: 'row', gap: 8, marginTop: 14 },
  salesBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  salesBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1c1c1e' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1c1c1e' },

  // Payment Breakdown
  breakdownList: { gap: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdot: { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { fontSize: 13, fontWeight: '600', color: '#1c1c1e', width: 60 },
  breakdownBarBg: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  breakdownBar: { height: '100%', borderRadius: 4 },
  breakdownAmount: { fontSize: 13, fontWeight: '700', color: '#1c1c1e', width: 80, textAlign: 'right' },
  breakdownPct: { fontSize: 12, fontWeight: '600', color: '#6b7280', width: 36, textAlign: 'right' },

  // Top Items
  topItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  topItemRank: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
  },
  topItemRankText: { fontSize: 13, fontWeight: '700', color: Tokens.secondary },
  topItemName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  topItemUnits: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  topItemRevenue: { fontSize: 15, fontWeight: '700', color: '#1c1c1e' },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#6b7280' },
  emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', maxWidth: 240 },
});
