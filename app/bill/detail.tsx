import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { File, Directory, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { api, type BillDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import FullScreenLoader from '@/components/FullScreenLoader';
import Loader from '@/components/Loader';
import { shareInvoicePdf, shareOnWhatsApp } from '@/lib/bill-pdf';
import { useTranslation } from 'react-i18next';

const fmt = (n: number) => Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatPaymentMethod(t: any, method: string): string {
  const map: Record<string, string> = {
    cash: t('paymentMethods.cash'), upi: t('paymentMethods.upi'), card: t('paymentMethods.card'),
    credit: t('paymentMethods.credit'), mix: t('paymentMethods.mix'),
  };
  return map[method] || method;
}

function formatStatus(t: any, status: string): string {
  const map: Record<string, string> = {
    paid: t('bill.statusPaid'), partial: t('bill.statusPartial'), pending: t('bill.statusPending'), cancelled: t('bill.statusCancelled'),
  };
  return map[status] || status;
}

const pmtIcons: Record<string, string> = {
  cash: 'cash-outline', upi: 'phone-portrait-outline', card: 'card-outline',
  credit: 'calendar-outline', mix: 'swap-horizontal-outline',
};

export default function BillDetailScreen() {
  const { t } = useTranslation();
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { token } = useAuth();
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const insets = useSafeAreaInsets();
  const [shopName, setShopName] = useState('KhataFlow');
  const [shopLogoBase64, setShopLogoBase64] = useState('');
  const [shopAddress, setShopAddress] = useState('');

  const loadBill = useCallback(async () => {
    if (!uuid || !token) return;
    try {
      setLoading(true);
      const [billRes, profileRes] = await Promise.all([
        api.getBill(token, uuid),
        api.getProfile(token).catch(() => null),
      ]);
      setBill(billRes.data);
      if (profileRes?.data?.shop) {
        const s = profileRes.data.shop;
        if (s.shop_name) setShopName(s.shop_name);
        if (s.logo) {
          try {
            const destDir = new Directory(Paths.cache, 'detail-shop-logos');
            destDir.create({ intermediates: true, idempotent: true });
            const destFile = new File(destDir, `logo-${Date.now()}.png`);
            const file = await File.downloadFileAsync(s.logo, destFile);
            const b64 = await file.base64();
            setShopLogoBase64('data:image/png;base64,' + b64);
          } catch (e) { console.error('Failed to load shop logo', e); }
        }
        const addr = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ');
        setShopAddress(addr);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [uuid, token]);

  useFocusEffect(
    useCallback(() => {
      loadBill();
    }, [loadBill])
  );

  const handleShare = async () => {
    if (!bill) return;
    setSharing(true);
    const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
    try {
      await Promise.race([
        (bill.customer?.phone
          ? shareOnWhatsApp(bill, shopName, shopLogoBase64 || undefined, shopAddress || undefined)
          : shareInvoicePdf(bill, shopName, shopLogoBase64 || undefined, shopAddress || undefined)
        ),
        timeout,
      ]);
    } catch {
      await Promise.race([
        shareInvoicePdf(bill, shopName, shopLogoBase64 || undefined, shopAddress || undefined).catch(() => {}),
        timeout,
      ]).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Tokens.background, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Loader size={48} />
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('bill.billDetail')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Tokens['on-surface-variant'] }}>{t('bill.billNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPaid = bill.payment_status === 'paid';
  const statusColor = isPaid ? Tokens.secondary : Tokens.tertiary;
  const statusBg = isPaid ? Tokens['secondary-fixed'] : Tokens['tertiary-fixed'];
  const statusText = formatStatus(t, bill.payment_status);

  const billDate = new Date(bill.created_at);
  const dateStr = billDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{`${t('common.bill')} ${bill.bill_number}`}</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              {shopLogoBase64 ? (
                <Image source={{ uri: shopLogoBase64 }} style={styles.heroLogo} />
              ) : (
                <View style={styles.heroLogoPlaceholder}>
                  <Ionicons name="storefront" size={24} color="#fff" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.heroShopName}>{shopName}</Text>
                {shopAddress ? <Text style={styles.heroAddress}>{shopAddress}</Text> : null}
              </View>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.heroBadgeText, { color: statusColor }]}>{statusText}</Text>
            </View>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroMeta}>
            {[
              { icon: 'receipt-outline', label: t('bill.billNumber'), value: bill.bill_number },
              { icon: 'calendar-outline', label: t('common.date'), value: dateStr },
              { icon: 'time-outline', label: t('common.time'), value: timeStr },
            ].map((item, i) => (
              <View key={i} style={styles.heroMetaItem}>
                <Ionicons name={item.icon as any} size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.heroMetaLabel}>{item.label}</Text>
                <Text style={styles.heroMetaValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitial}>
                {(bill.customer?.name || 'W').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.customerNameRow}>
                <Text style={styles.value}>{bill.customer?.name || t('bill.walkInCustomer')}</Text>
                {bill.customer?.phone ? (
                  <View style={styles.phoneInline}>
                    <Ionicons name="call-outline" size={12} color="#006b59" />
                    <Text style={styles.phoneText}>{bill.customer.phone}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('bill.items')} <Text style={{ color: Tokens['on-surface-variant'], fontWeight: '400' }}>({bill.items.length})</Text>
          </Text>
          {bill.items.map((item, i) => (
            <View key={item.id || i} style={[styles.itemRow, i < bill.items.length - 1 && styles.itemBorder]}>
              <View style={styles.itemDot} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemQty}>{item.quantity} × ₹{fmt(item.unit_price)}</Text>
              </View>
              <Text style={styles.itemTotal}>₹{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('bill.subtotal')}</Text>
            <Text style={styles.summaryValue}>₹{fmt(bill.subtotal)}</Text>
          </View>
          {bill.discount > 0 && (
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.summaryLabel}>{t('bill.discount')}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {bill.discount_type === 'percentage' ? `${bill.discount_value}% OFF` : `₹${fmt(bill.discount_value)} OFF`}
                  </Text>
                </View>
              </View>
              <Text style={[styles.summaryValue, { color: Tokens.secondary }]}>−₹{fmt(bill.discount)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('bill.gst')}</Text>
            <Text style={styles.summaryValue}>₹{fmt(bill.tax)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('bill.totalAmount')}</Text>
            <Text style={styles.totalValue}>₹{fmt(bill.total)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: Tokens.secondary }]}>{t('bill.paid')}</Text>
            <Text style={[styles.summaryValue, { color: Tokens.secondary, fontWeight: '700' }]}>₹{fmt(bill.paid_amount)}</Text>
          </View>
          {bill.due_amount > 0 && (
            <View style={styles.dueRow}>
              <Ionicons name="alert-circle" size={18} color={Tokens.tertiary} />
              <Text style={styles.dueLabel}>{t('bill.dueUdhaar')}</Text>
              <Text style={styles.dueValue}>₹{fmt(bill.due_amount)}</Text>
            </View>
          )}
        </View>

        {bill.payments && bill.payments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('bill.paymentHistory')}</Text>
            {bill.payments.map((p, idx) => {
              const pmtDate = p.payment_date ? new Date(p.payment_date) : null;
              return (
                <View key={p.id || idx} style={styles.payItem}>
                  <View style={styles.payTimeline}>
                    <View style={styles.payDot} />
                    {idx < bill.payments.length - 1 ? <View style={styles.payLine} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.payTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={pmtIcons[p.payment_method] as any || 'cash-outline'} size={14} color={Tokens.secondary} />
                        <Text style={styles.payMethod}>{formatPaymentMethod(t, p.payment_method)}</Text>
                      </View>
                      <Text style={styles.payAmount}>+₹{fmt(Number(p.amount))}</Text>
                    </View>
                    {pmtDate ? (
                      <Text style={styles.payDate}>
                        {pmtDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : null}
                    {p.reference ? <Text style={styles.payRef}>Ref: {p.reference}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {bill.notes ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={styles.notesIcon}>
                <Ionicons name="document-text" size={16} color={Tokens.secondary} />
              </View>
              <Text style={styles.sectionTitle}>{t('common.notes')}</Text>
            </View>
            <Text style={styles.notesText}>{bill.notes}</Text>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.shareBtn, sharing && { opacity: 0.7 }]}
          activeOpacity={0.9}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <Loader size={20} color="#fff" />
          ) : (
            <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          )}
          <Text style={styles.shareBtnText}>
            {sharing ? t('bill.generatingPdf') : t('bill.shareInvoice')}
          </Text>
        </TouchableOpacity>
      </View>
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
  scrollContent: { padding: 16, paddingTop: 12, paddingBottom: 100, gap: 14 },

  hero: {
    backgroundColor: '#006b59', borderRadius: 20, padding: 20, overflow: 'hidden',
    shadowColor: '#006b59', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 },
  heroLogo: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroLogoPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroShopName: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: 'Lexend-SemiBold' },
  heroAddress: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3, lineHeight: 16 },
  heroBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginLeft: 10 },
  heroBadgeText: { fontSize: 12, fontWeight: '700' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 16 },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  heroMetaItem: { alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  heroMetaLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroMetaValue: { fontSize: 11, fontWeight: '600', color: '#fff', textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  customerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#006b59', alignItems: 'center', justifyContent: 'center',
  },
  customerInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  customerNameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 16, fontWeight: '600', color: '#1c1c1e' },
  phoneInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phoneText: { fontSize: 14, color: '#006b59', fontWeight: '500' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1c1c1e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a7f3d0' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  itemQty: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  itemTotal: { fontSize: 17, fontWeight: '700', color: '#1c1c1e' },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  discountBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  discountText: { fontSize: 10, fontWeight: '700', color: '#006b59' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1c1c1e' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#006b59', letterSpacing: -0.3 },
  dueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', padding: 12,
    borderRadius: 12, marginTop: 8,
  },
  dueLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#d97706' },
  dueValue: { fontSize: 17, fontWeight: '700', color: '#d97706' },

  payItem: { flexDirection: 'row', gap: 12, marginTop: 12 },
  payTimeline: { alignItems: 'center', width: 14 },
  payDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#006b59', borderWidth: 2, borderColor: '#d1fae5',
  },
  payLine: { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: 4 },
  payTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payMethod: { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },
  payAmount: { fontSize: 15, fontWeight: '700', color: '#006b59' },
  payDate: { fontSize: 12, color: '#6b7280', marginTop: 2, marginLeft: 20 },
  payRef: { fontSize: 11, color: '#6b7280', marginTop: 1, fontStyle: 'italic', marginLeft: 20 },

  notesIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
  },
  notesText: { fontSize: 14, color: '#1c1c1e', lineHeight: 20 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, backgroundColor: '#25D366', borderRadius: 16,
    shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  shareBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
