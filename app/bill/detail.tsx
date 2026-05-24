import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { api, type BillDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import FullScreenLoader from '@/components/FullScreenLoader';
import Loader from '@/components/Loader';
import { shareInvoicePdf, shareOnWhatsApp } from '@/lib/bill-pdf';

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    credit: 'Credit (Udhaar)',
    mix: 'Split Payment',
  };
  return map[method] || method;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    paid: 'Paid',
    partial: 'Partial',
    pending: 'Pending',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

export default function BillDetailScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { token } = useAuth();
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const insets = useSafeAreaInsets();
  const [shopName, setShopName] = useState('KhataFlow');

  const loadBill = useCallback(async () => {
    if (!uuid || !token) return;
    try {
      setLoading(true);
      const [billRes, profileRes] = await Promise.all([
        api.getBill(token, uuid),
        api.getProfile(token).catch(() => null),
      ]);
      setBill(billRes.data);
      if (profileRes?.data?.shop?.shop_name) {
        setShopName(profileRes.data.shop.shop_name);
      }
    } catch {
      // handle error
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
    try {
      if (bill.customer?.phone) {
        await shareOnWhatsApp(bill, shopName);
      } else {
        await shareInvoicePdf(bill, shopName);
      }
    } catch {
      await shareInvoicePdf(bill, shopName).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Bill Detail</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.centerLoader}>
          <FullScreenLoader />
        </View>
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Bill Detail</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.centerLoader}>
          <Text style={{ color: Tokens['on-surface-variant'] }}>Bill not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPaid = bill.payment_status === 'paid';
  const statusIcon = isPaid ? 'checkmark-circle' : 'time';
  const statusColor = isPaid ? Tokens.secondary : Tokens.tertiary;
  const statusText = formatStatus(bill.payment_status);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Bill {bill.bill_number}</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="ellipsis-vertical" size={22} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusBanner, { backgroundColor: isPaid ? Tokens['secondary-fixed'] : Tokens['tertiary-fixed'] }]}>
          <Ionicons name={statusIcon as any} size={24} color={statusColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBannerTitle, { color: statusColor }]}>{statusText}</Text>
            <Text style={styles.statusBannerSubtext}>
              {bill.payment_method === 'credit' ? 'Udhaar' : formatPaymentMethod(bill.payment_method)}
              {bill.due_amount > 0 ? ` · Paid ₹${bill.paid_amount} · Due ₹${bill.due_amount}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.billCard}>
          <View style={styles.storeSection}>
            <View style={styles.storeIcon}>
              <Ionicons name="storefront" size={24} color={Tokens['primary-container']} />
            </View>
            <View>
              <Text style={styles.storeName}>{shopName}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            {[
              { label: 'Bill No.', value: bill.bill_number },
              { label: 'Date', value: new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { label: 'Time', value: new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
              { label: 'Payment', value: formatPaymentMethod(bill.payment_method) },
            ].map((item, i) => (
              <View key={i} style={{ minWidth: '45%' }}>
                <Text style={styles.metaLabel}>{item.label}</Text>
                <Text style={styles.metaValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.customerRow}>
            <Ionicons name="person-outline" size={18} color={Tokens['on-surface-variant']} />
            <View>
              <Text style={styles.sectionLabel}>Customer</Text>
              <Text style={styles.sectionValue}>{bill.customer?.name || 'Walk-in Customer'}</Text>
              {bill.customer?.phone && (
                <Text style={styles.customerPhone}>{bill.customer.phone}</Text>
              )}
            </View>
          </View>

          <View style={styles.itemsSection}>
            <Text style={styles.sectionLabel}>Items ({bill.items.length})</Text>
            {bill.items.map((item, i) => (
              <View key={item.id || i} style={[styles.itemRow, i < bill.items.length - 1 && styles.itemRowBorder]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemSubtext}>{item.quantity} × ₹{item.unit_price}</Text>
                </View>
                <Text style={styles.itemTotal}>₹{item.total}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{bill.subtotal}</Text>
            </View>
            {bill.discount > 0 && (
              <View style={styles.summaryRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{bill.discount_type === 'percentage' ? `${bill.discount_value}% OFF` : `₹${bill.discount_value} OFF`}</Text>
                  </View>
                </View>
                <Text style={[styles.summaryValue, { color: Tokens.secondary }]}>-₹{bill.discount}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST</Text>
              <Text style={styles.summaryValue}>₹{bill.tax}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{bill.total}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: Tokens.secondary }]}>Paid</Text>
              <Text style={[styles.summaryValue, { color: Tokens.secondary, fontWeight: '700' }]}>₹{bill.paid_amount}</Text>
            </View>
            {bill.due_amount > 0 && (
              <View style={styles.dueRow}>
                <Text style={styles.dueLabel}>Due (Udhaar)</Text>
                <Text style={styles.dueValue}>₹{bill.due_amount}</Text>
              </View>
            )}
          </View>
        </View>

      {bill.payments && bill.payments.length > 0 && (
        <View style={styles.paymentHistory}>
          <Text style={styles.payHistTitle}>Payment History</Text>
          <View style={styles.payHistList}>
            {bill.payments.map((p, idx) => {
              const pmtDate = p.payment_date ? new Date(p.payment_date) : null;
              return (
                <View key={p.id || idx} style={styles.payHistItem}>
                  <View style={styles.payHistDot} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.payHistRow}>
                      <Text style={styles.payHistMethod}>{formatPaymentMethod(p.payment_method)}</Text>
                      <Text style={styles.payHistAmount}>+₹{Number(p.amount).toFixed(2)}</Text>
                    </View>
                    {pmtDate ? (
                      <Text style={styles.payHistDate}>
                        {pmtDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : null}
                    {p.reference ? <Text style={styles.payHistRef}>Ref: {p.reference}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {bill.notes ? (
        <View style={styles.notesCard}>
          <Ionicons name="document-text-outline" size={18} color={Tokens['on-surface-variant']} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notesText}>{bill.notes}</Text>
          </View>
        </View>
      ) : null}
      <View style={{ height: 80 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <TouchableOpacity
          style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
          activeOpacity={0.9}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <Loader size={20} color="#fff" />
          ) : (
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          )}
          <Text style={styles.shareBtnText}>
            {sharing ? 'Generating PDF...' : 'Share Invoice'}
          </Text>
        </TouchableOpacity>
      </View>
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
  centerLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, paddingBottom: 100, gap: Spacing.md },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: BorderRadius.xl, padding: Spacing.md,
  },
  statusBannerTitle: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any },
  statusBannerSubtext: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  billCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    overflow: 'hidden', shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  storeSection: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
  },
  storeIcon: {
    width: 40, height: 40, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['primary-container'], alignItems: 'center', justifyContent: 'center',
  },
  storeName: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'] },
  metaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.md, gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
  },
  metaLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  metaValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'], fontWeight: '500' },
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
  },
  sectionLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  sectionValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'], fontWeight: '500' },
  customerPhone: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'], marginTop: 2 },
  itemsSection: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'], gap: Spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.base },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'] },
  itemName: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'] },
  itemSubtext: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'] },
  itemTotal: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  summarySection: { padding: Spacing.md, gap: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  summaryValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'] },
  discountBadge: { backgroundColor: Tokens['secondary-fixed'], paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  discountText: { fontSize: 10, fontWeight: '600', color: Tokens['on-secondary-fixed'] },
  totalRow: { borderTopWidth: 1, borderTopColor: Tokens['outline-variant'], paddingTop: Spacing.sm },
  totalLabel: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  totalValue: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens.secondary },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm, backgroundColor: Tokens['tertiary-fixed'], padding: Spacing.sm, borderRadius: BorderRadius.lg },
  dueLabel: { fontSize: Typography['label-lg'].fontSize, fontWeight: '700', color: Tokens.tertiary },
  dueValue: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens.tertiary },
  notesCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  notesText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'] },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Tokens['surface-container-lowest'],
    borderTopWidth: 1, borderTopColor: Tokens['outline-variant'],
    paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.sm, paddingBottom: Spacing.md,
  },
  paymentHistory: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  payHistTitle: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.md },
  payHistList: { gap: Spacing.md },
  payHistItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  payHistDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: Tokens.secondary,
    marginTop: 5,
  },
  payHistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payHistMethod: { fontSize: Typography['body-md'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  payHistAmount: { fontSize: Typography['body-lg'].fontSize, fontWeight: '700', color: Tokens.secondary },
  payHistDate: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'], marginTop: 1 },
  payHistRef: { fontSize: 11, color: Tokens['on-surface-variant'], marginTop: 1, fontStyle: 'italic' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 56, backgroundColor: '#25D366', borderRadius: BorderRadius.xl,
    shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  shareBtnDisabled: { opacity: 0.7 },
  shareBtnText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: '#fff' },
});
