import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { File, Directory, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api, DailyReport, MonthlyReport, CustomRangeReport } from '@/lib/api';

const displayUnit = (unit?: string) => unit || 'pcs';

const fmt = (n: number) => Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReportsScreen() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'custom'>('daily');
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [customReport, setCustomReport] = useState<CustomRangeReport | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const customStartRef = useRef(new Date());
  const customEndRef = useRef(new Date());
  const [customStartDisplay, setCustomStartDisplay] = useState(new Date());
  const [customEndDisplay, setCustomEndDisplay] = useState(new Date());
  const [customFetchKey, setCustomFetchKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const { t } = useTranslation();
  const [shopName, setShopName] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopLogoBase64, setShopLogoBase64] = useState('');
  const [brandLogoBase64, setBrandLogoBase64] = useState('');

  const fetchReport = useCallback(async (showLoader?: boolean) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      if (period === 'daily') {
        const res = await api.getDailyReport(token);
        setDailyReport(res.data);
      } else if (period === 'monthly') {
        const now = new Date();
        const res = await api.getMonthlyReport(token, now.getFullYear(), now.getMonth() + 1);
        setMonthlyReport(res.data);
      } else {
        const fmt = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const res = await api.getCustomRangeReport(token, fmt(customStartRef.current), fmt(customEndRef.current));
        setCustomReport(res.data);
      }
    } catch (e: any) {
      console.error('Failed to fetch report', e.message);
      if (period === 'monthly') setMonthlyReport(null);
      else if (period === 'custom') setCustomReport(null);
      else setDailyReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, period, customFetchKey]);

  useEffect(() => {
    fetchReport(true);
    api.getProfile(token!).then(r => {
      if (r.data.shop) {
        const s = r.data.shop;
        setShopName(s.shop_name);
        setShopLogo(s.logo || '');
        const addr = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ');
        setShopAddress(addr);
        if (s.logo) {
          const destDir = new Directory(Paths.cache, 'shop-logos');
          destDir.create({ intermediates: true, idempotent: true });
          const destFile = new File(destDir, `logo-${Date.now()}.png`);
          File.downloadFileAsync(s.logo, destFile)
            .then(file => file.base64())
            .then(b64 => setShopLogoBase64('data:image/png;base64,' + b64))
            .catch(e => console.error('Failed to load shop logo', e));
        }
      }
    }).catch(() => {});
    const asset = Image.resolveAssetSource(require('@/assets/images/logo.png'));
    FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' })
      .then(b64 => setBrandLogoBase64('data:image/png;base64,' + b64))
      .catch(() => {});
  }, [fetchReport]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReport(false);
  };

  const totalSales = period === 'daily'
    ? dailyReport?.total_sales ?? 0
    : period === 'monthly'
    ? monthlyReport?.current_month.total_sales ?? 0
    : customReport?.total_sales ?? 0;

  const totalBills = period === 'daily'
    ? dailyReport?.total_bills ?? 0
    : period === 'monthly'
    ? monthlyReport?.current_month.total_bills ?? 0
    : customReport?.total_bills ?? 0;

  const totalCredit = period === 'daily'
    ? dailyReport?.total_credit ?? 0
    : period === 'monthly'
    ? monthlyReport?.current_month.total_credit ?? 0
    : customReport?.total_credit ?? 0;

  const paymentBreakdown = period === 'daily'
    ? dailyReport?.payment_breakdown
    : period === 'monthly'
    ? monthlyReport?.current_month.payment_breakdown
    : customReport?.payment_breakdown;

  const topProducts = period === 'daily'
    ? dailyReport?.top_products ?? []
    : period === 'monthly'
    ? monthlyReport?.current_month.top_products ?? []
    : customReport?.top_products ?? [];

  const growth = period === 'monthly' ? monthlyReport?.comparison.sales_growth_percentage : undefined;

  const handleExportPDF = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const monthName = monthlyReport?.current_month.month
        ? (() => { const [y, m] = monthlyReport.current_month.month.split('-'); return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); })()
        : '';
      const label = period === 'daily' ? 'Daily'
        : period === 'monthly' ? monthName
        : 'Custom Range';
      const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const topRows = topProducts.length > 0 ? topProducts.map((p, i) =>
        `<tr>
          <td style="text-align:center;padding:12px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:40px">${i + 1}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:600">${p.product_name}</td>
          <td style="text-align:center;padding:12px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">${Number(p.total_quantity)} ${displayUnit(p.unit)}</td>
           <td style="text-align:right;padding:12px 14px;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:700">₹${fmt(Number(p.total_revenue))}</td>
        </tr>`
      ).join('') : '<tr><td colspan="4" style="text-align:center;padding:28px;color:#9ca3af;font-size:14px">No product data for this period</td></tr>';

      const headerLogo = shopLogoBase64;
      const brandLogo = brandLogoBase64;
      const logoHtml = headerLogo ? `<img src="${headerLogo}" style="height:48px;width:auto" />` : '';
      const watermarkHtml = brandLogo
        ? `<div class="watermark"><img src="${brandLogo}" /><div class="watermark-tagline">Smart dukan · Smart hisaab</div></div>`
        : `<div class="watermark-text">KhataFlow<div class="watermark-tagline">Smart dukan · Smart hisaab</div></div>`;

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;background:#f0f2f5;padding:24px}
.page{max-width:750px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(15,46,42,0.1);position:relative}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.1;pointer-events:none;z-index:0;text-align:center}
.watermark img{max-width:260px;max-height:260px}
.watermark .watermark-tagline{font-size:15px;font-weight:700;color:#0f2e2a;letter-spacing:1.5px;margin-top:8px;opacity:0.9}
.watermark-text{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:96px;font-weight:900;color:#0f2e2a;opacity:0.045;pointer-events:none;z-index:0;white-space:nowrap;letter-spacing:10px;text-align:center}
.watermark-text .watermark-tagline{font-size:22px;font-weight:700;letter-spacing:3px;margin-top:8px;opacity:0.9}
.header{background:linear-gradient(135deg,#0f2e2a 0%,#1a6b5e 100%);padding:32px 40px;color:#fff;position:relative;z-index:1}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.header h1{font-size:28px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;line-height:1.2}
.header .sub{font-size:14px;opacity:0.85;font-weight:500;letter-spacing:0.3px}
.header .address{font-size:11px;opacity:0.6;font-weight:400;margin-top:4px;line-height:1.5;max-width:360px}
.header .date-row{display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1)}
.header .date-row span{font-size:12px;opacity:0.8;letter-spacing:0.2px}
.badge{display:inline-block;background:rgba(255,255,255,0.12);border-radius:20px;padding:6px 18px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase}
.content{position:relative;z-index:1;padding:0}
.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin:0;background:transparent}
.summary-item{padding:28px 32px;text-align:center;border-right:1px solid #f0f0f0;background:transparent}
.summary-item:last-child{border-right:none}
.summary-item h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:6px}
.summary-item .value{font-size:30px;font-weight:800;color:#0f2e2a;letter-spacing:-0.5px}
.summary-item .value.credit{color:#d97706}
.section{padding:28px 32px}
.section-title{font-size:13px;font-weight:700;color:#0f2e2a;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #e5e7eb;letter-spacing:0.8px;text-transform:uppercase}
table{width:100%;border-collapse:separate;border-spacing:0}
thead th{padding:12px 14px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;background:#f9fafb}
thead th:first-child{border-radius:10px 0 0 0}
thead th:last-child{border-radius:0 10px 0 0}
tbody td{padding:12px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px}
tbody tr:last-child td{border-bottom:none}
.pay-list{display:grid;gap:8px}
.pay-item{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-radius:8px}
.pay-item .left{display:flex;align-items:center;gap:14px}
.pay-dot{width:12px;height:12px;border-radius:50%}
.pay-item .name{font-size:14px;font-weight:600;color:#1f2937}
.pay-item .amt{font-size:18px;font-weight:700;color:#111827}
.footer{text-align:center;padding:24px 32px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ca3af;letter-spacing:0.5px;position:relative;z-index:1;background:#fafafa}
</style>
</head>
<body>
<div class="page">
  ${watermarkHtml}
  <div class="header">
    <div class="header-top">
      <div>
        <h1>${label} Sales Report</h1>
        <div class="sub">${shopName || 'KhataFlow'}</div>
        ${shopAddress ? `<div class="address">${shopAddress}</div>` : ''}
      </div>
      ${logoHtml}
    </div>
    <div class="date-row">
      <span>${today}</span>
      <span class="badge">${period === 'daily' ? 'Day Summary' : period === 'monthly' ? 'Month Summary' : 'Custom Range'}</span>
    </div>
    ${period === 'custom' && customReport ? `<div style="font-size:12px;opacity:0.7;margin-top:6px">${customReport.start_date} to ${customReport.end_date}</div>` : ''}
  </div>
  <div class="content">
  <div class="summary">
    <div class="summary-item">
      <h4>Total Sales</h4>
      <div class="value">₹${fmt(Number(totalSales))}</div>
    </div>
    <div class="summary-item">
      <h4>Total Bills</h4>
      <div class="value">${totalBills}</div>
    </div>
    <div class="summary-item">
      <h4>Total Credit</h4>
      <div class="value credit">₹${fmt(Number(totalCredit))}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Payment Breakdown</div>
    <div class="pay-list">
      ${(['cash', 'upi', 'card', 'credit'] as const).filter(m => Number((paymentBreakdown as any)?.[m] || 0) > 0).map(m => {
        const amount = Number((paymentBreakdown as any)?.[m] || 0);
        const colors: Record<string, string> = { cash: '#2e7d32', upi: '#1565c0', card: '#7c3aed', credit: '#d97706' };
        return `<div class="pay-item">
          <div class="left"><span class="pay-dot" style="background:${colors[m]}"></span><span class="name">${m.charAt(0).toUpperCase() + m.slice(1)}</span></div>
          <span class="amt">₹${fmt(amount)}</span>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div class="section" style="padding-top:0">
    <div class="section-title">Top Products</div>
    <table><thead><tr><th style="text-align:center">#</th><th>Product</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${topRows}</tbody></table>
  </div>
  </div>
  <div class="footer">
    Powered by KhataFlow
  </div>
</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      }
    } catch {
      // silently fail
    } finally {
      setExporting(false);
      exportingRef.current = false;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('reports.title')}</Text>
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
        <Text style={styles.topTitle}>{t('reports.title')}</Text>
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
            <Text style={[styles.toggleText, period === 'daily' && styles.toggleTextActive]}>{t('reports.today')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, period === 'monthly' && styles.toggleBtnActive]}
            onPress={() => setPeriod('monthly')}
          >
            <Ionicons name="calendar-outline" size={16} color={period === 'monthly' ? '#fff' : Tokens['on-surface-variant']} />
            <Text style={[styles.toggleText, period === 'monthly' && styles.toggleTextActive]}>{t('reports.thisMonth')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, period === 'custom' && styles.toggleBtnActive]}
            onPress={() => setPeriod('custom')}
          >
            <Ionicons name="options-outline" size={16} color={period === 'custom' ? '#fff' : Tokens['on-surface-variant']} />
            <Text style={[styles.toggleText, period === 'custom' && styles.toggleTextActive]}>{t('reports.custom')}</Text>
          </TouchableOpacity>
        </View>

        {period === 'custom' && (
          <View style={styles.dateRangeRow}>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateLabel}>{t('reports.from')}</Text>
              <Text style={styles.dateValue}>{customStartDisplay.toLocaleDateString('en-IN')}</Text>
            </TouchableOpacity>
            <Text style={styles.dateSep}>→</Text>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateLabel}>{t('reports.to')}</Text>
              <Text style={styles.dateValue}>{customEndDisplay.toLocaleDateString('en-IN')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateApply} onPress={() => { setCustomFetchKey(k => k + 1); }}>
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {showStartPicker && (
          <DateTimePicker
            value={customStartRef.current}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={customEndRef.current}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              if (event.type === 'dismissed' || Platform.OS !== 'ios') setShowStartPicker(false);
              if (date) {
                customStartRef.current = date;
                setCustomStartDisplay(date);
                if (Platform.OS !== 'ios') setCustomFetchKey(k => k + 1);
              }
            }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={customEndRef.current}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={customStartRef.current}
            maximumDate={new Date()}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              if (event.type === 'dismissed' || Platform.OS !== 'ios') setShowEndPicker(false);
              if (date) {
                customEndRef.current = date;
                setCustomEndDisplay(date);
                if (Platform.OS !== 'ios') setCustomFetchKey(k => k + 1);
              }
            }}
          />
        )}

        {/* Sales Card */}
        <View style={styles.salesCard}>
          <View style={styles.salesCardTop}>
            <Text style={styles.salesLabel}>{t('reports.totalSales')}</Text>
            {growth !== undefined && (
              <View style={[styles.growthBadge, growth >= 0 ? styles.growthPositive : styles.growthNegative]}>
                <Ionicons name={growth >= 0 ? 'trending-up' : 'trending-down'} size={12} color={growth >= 0 ? '#16a34a' : '#dc2626'} />
                <Text style={[styles.growthText, { color: growth >= 0 ? '#16a34a' : '#dc2626' }]}>
                  {growth >= 0 ? '+' : ''}{growth}%
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.salesAmount}>₹{fmt(Number(totalSales))}</Text>
          <View style={styles.salesFooter}>
            <View style={styles.salesBadge}>
              <Ionicons name="receipt-outline" size={14} color={Tokens['on-secondary']} />
              <Text style={styles.salesBadgeText}>{totalBills} {t('reports.totalBills')}</Text>
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
            <Text style={styles.statLabel}>{t('reports.totalBills')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="cash-outline" size={20} color="#1565c0" />
            </View>
            <Text style={styles.statValue}>₹{fmt(Number(totalSales))}</Text>
            <Text style={styles.statLabel}>{t('reports.grossSales')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="wallet-outline" size={20} color="#d97706" />
            </View>
            <Text style={styles.statValue}>₹{fmt(Number(totalCredit))}</Text>
            <Text style={styles.statLabel}>{t('reports.totalCredit')}</Text>
          </View>
        </View>

        {/* Payment Breakdown */}
        {paymentBreakdown && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="wallet-outline" size={18} color={Tokens.secondary} />
              <Text style={styles.cardTitle}>{t('reports.paymentBreakdown')}</Text>
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
                    <Text style={styles.breakdownAmount}>₹{fmt(amount)}</Text>
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
              <Text style={styles.cardTitle}>{t('reports.topProducts')}</Text>
            </View>
            {topProducts.map((item, i) => (
              <View key={i} style={styles.topItem}>
                <View style={styles.topItemRank}>
                  <Text style={styles.topItemRankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.topItemName} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={styles.topItemUnits}>
                    {Number(item.total_quantity)} {displayUnit(item.unit)} {t('reports.sold')}
                  </Text>
                </View>
                <Text style={styles.topItemRevenue}>₹{fmt(Number(item.total_revenue))}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bar-chart-outline" size={36} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>{t('reports.noData')}</Text>
            <Text style={styles.emptySub}>{t('reports.noDataSub')}</Text>
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

  // Date Range
  dateRangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  dateField: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#f8faf9', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  dateLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 2 },
  dateValue: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  dateSep: { fontSize: 18, color: '#9ca3af', fontWeight: '700' },
  dateApply: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Tokens.secondary, alignItems: 'center', justifyContent: 'center',
  },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#6b7280' },
  emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', maxWidth: 240 },
});
