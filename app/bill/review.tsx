import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useBill } from '@/lib/bill-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Loader from '@/components/Loader';

const PAYMENT_MODES = [
  { key: 'Cash', icon: 'cash', label: 'Cash' },
  { key: 'UPI', icon: 'phone-portrait', label: 'UPI' },
  { key: 'Card', icon: 'card', label: 'Card' },
  { key: 'Udhaar', icon: 'book', label: 'Udhaar' },
] as const;

export default function BillReviewScreen() {
  const {
    items, customer, paymentMode, discount, notes,
    subtotal, discountAmount, taxAmount, grandTotal,
    setPaymentMode, resetBill,
  } = useBill();
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const [error, setError] = useState('');
  const [shopName, setShopName] = useState('KhataFlow');
  const [shopLogo, setShopLogo] = useState<string | null>(null);

  const [paidAmount, setPaidAmount] = useState(grandTotal);
  const [paidInput, setPaidInput] = useState(String(grandTotal));

  useEffect(() => {
    const next = paymentMode === 'Udhaar' ? 0 : grandTotal;
    setPaidAmount(next);
    setPaidInput(String(next));
  }, [paymentMode, grandTotal]);

  useEffect(() => {
    if (token) {
      api.getProfile(token).then(res => {
        if (res.data.shop?.shop_name) setShopName(res.data.shop.shop_name);
        if (res.data.shop?.logo) setShopLogo(res.data.shop.logo);
      }).catch(() => {});
    }
  }, [token]);

  const dueAmount = Math.max(0, grandTotal - paidAmount);
  const isPartialPayment = dueAmount > 0 && paymentMode !== 'Udhaar';

  const confirmPaidInput = () => {
    const trimmed = paidInput.replace(/[^0-9.]/g, '');
    if (!trimmed || trimmed === '.') {
      setPaidAmount(0);
      setPaidInput('0');
      return;
    }
    const num = parseFloat(trimmed);
    if (isNaN(num) || num <= 0) {
      setPaidAmount(0);
      setPaidInput('0');
    } else if (num > grandTotal) {
      setPaidAmount(grandTotal);
      setPaidInput(String(grandTotal));
    } else {
      setPaidAmount(num);
      setPaidInput(trimmed);
    }
  };

  const handleConfirm = async () => {
    if (!token) return;

    if (dueAmount > 0 && !customer?.uuid) {
      Alert.alert(
        'Customer Required',
        'Please select a customer to track Udhaar for the remaining ₹' + dueAmount.toFixed(2) + '.',
      );
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const isCredit = paymentMode === 'Udhaar';
      const payload: any = {
        items: items.map(item => ({
          ...(item.product_uuid
            ? { product_uuid: item.product_uuid }
            : { product_name: item.name, unit_price: item.rate }
          ),
          quantity: item.quantity,
          ...(item.gstRate ? { gst_rate: item.gstRate } : {}),
        })),
        payment_method: isCredit ? 'credit' : paymentMode.toLowerCase(),
        paid_amount: paidAmount,
        notes: notes || undefined,
      };

      if (customer?.uuid) {
        payload.customer_uuid = customer.uuid;
      }

      if (discount) {
        payload.discount_type = discount.type;
        payload.discount_value = discount.value;
      }

      const res = await api.createBill(token, payload);
      resetBill();

      (router as any).replace({
        pathname: '/bill/success',
        params: { bill: JSON.stringify(res.data) },
      });
    } catch (e: any) {
      setError(e.message || 'Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Review Bill</Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.billCard}>
          <View style={styles.billHeader}>
            <View style={styles.billLogo}>
              {shopLogo ? (
                <Image source={{ uri: shopLogo }} style={{ width: 36, height: 36, borderRadius: 10 }} />
              ) : (
                <Ionicons name="receipt" size={28} color={Tokens['primary-container']} />
              )}
            </View>
            <Text style={styles.billStoreName}>{shopName}</Text>
            <Text style={styles.billDate}>Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
          </View>

          <View style={styles.billCustomer}>
            <Ionicons name="person-outline" size={18} color={Tokens['on-surface-variant']} />
            <View>
              <Text style={styles.billSectionLabel}>Customer</Text>
              <Text style={styles.billSectionValue}>{customer?.name || 'Walk-in Customer'}</Text>
            </View>
          </View>

          <View style={styles.billItemsSection}>
            <Text style={styles.billSectionLabel}>Items ({items.length})</Text>
            {items.map(item => {
              const itemSubtotal = item.rate * item.quantity;
              const gstAmt = (item.gstRate ?? 0) > 0 ? Math.round(itemSubtotal * (item.gstRate ?? 0) / 100) : 0;
              return (
                <View key={item.id} style={styles.billItemRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.billItemName}>{item.name}</Text>
                    <Text style={styles.billItemSubtext}>
                      {item.quantity} × ₹{item.rate}
                      {(item.gstRate ?? 0) > 0 ? ` | GST ${item.gstRate}%` : ''}
                    </Text>
                  </View>
                  <Text style={styles.billItemAmount}>₹{itemSubtotal + gstAmt}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.billSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{subtotal}</Text>
            </View>
            {discount && (
              <View style={styles.summaryRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>{discount.type === 'percentage' ? `${discount.value}% OFF` : `₹${discount.value} OFF`}</Text>
                  </View>
                </View>
                <Text style={[styles.summaryValue, { color: Tokens.secondary }]}>-₹{discountAmount}</Text>
              </View>
            )}
            {taxAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST</Text>
                <Text style={styles.summaryValue}>₹{taxAmount}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>₹{grandTotal}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Mode</Text>
          <View style={styles.paymentGrid}>
            {PAYMENT_MODES.map(mode => (
              <TouchableOpacity
                key={mode.key}
                style={[styles.paymentOption, paymentMode === mode.key && styles.paymentOptionActive]}
                onPress={() => setPaymentMode(mode.key)}
              >
                <Ionicons
                  name={mode.icon as any}
                  size={24}
                  color={paymentMode === mode.key ? Tokens['on-primary'] : Tokens['on-surface-variant']}
                />
                <Text style={[styles.paymentLabel, paymentMode === mode.key && styles.paymentLabelActive]}>{mode.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {paymentMode !== 'Udhaar' && (
          <View style={styles.paidSection}>
            <Text style={styles.paidSectionTitle}>💳 Amount Paid</Text>
            <View style={styles.paidInputContainer}>
              <Text style={styles.paidCurrencySign}>₹</Text>
              <TextInput
                style={styles.paidInput}
                value={paidInput}
                onChangeText={t => setPaidInput(t.replace(/[^0-9.]/g, ''))}
                onSubmitEditing={confirmPaidInput}
                onEndEditing={confirmPaidInput}
                keyboardType="decimal-pad"
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={Tokens['outline-variant']}
                selectTextOnFocus
              />
              <View style={styles.paidTotalBadge}>
                <Text style={styles.paidTotalBadgeText}>of ₹{grandTotal}</Text>
              </View>
            </View>
            <View style={styles.paidHintRow}>
              <Ionicons name="information-circle-outline" size={14} color={Tokens['on-surface-variant']} />
              <Text style={styles.paidHintText}>
                {paidAmount >= grandTotal
                  ? 'Full payment — no Udhaar'
                  : `₹${dueAmount.toFixed(2)} will go as Udhaar`
                }
              </Text>
            </View>
            {dueAmount > 0 && !customer?.name && (
              <View style={styles.dueWarning}>
                <Ionicons name="alert-circle" size={16} color={Tokens.tertiary} />
                <Text style={styles.dueWarningText}>Select a customer to track Udhaar credit.</Text>
              </View>
            )}
          </View>
        )}

        {paymentMode === 'Udhaar' && (
          <View style={styles.paidSection}>
            <View style={styles.udhaarNotice}>
              <View style={styles.udhaarIconWrap}>
                <Ionicons name="book" size={22} color={Tokens.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.udhaarNoticeTitle}>Full Udhaar</Text>
                <Text style={styles.udhaarNoticeText}>
                  ₹{grandTotal} will be added to {customer?.name ? `${customer.name}'s account` : 'customer account'}.
                </Text>
              </View>
            </View>
          </View>
        )}

        {notes ? (
          <View style={styles.notesCard}>
            <Ionicons name="document-text-outline" size={18} color={Tokens['on-surface-variant']} />
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={Tokens.tertiary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: (Spacing as any).md + insets.bottom }]}>
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomLabel}>Amount to Collect</Text>
          <Text style={styles.bottomAmount}>₹{grandTotal}</Text>
        </View>
        <TouchableOpacity
          style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          activeOpacity={0.9}
          disabled={submitting}
        >
          {submitting ? (
            <Loader size={20} color={Tokens['on-primary']} />
          ) : (
            <>
              <Text style={styles.confirmBtnText}>Confirm & Generate Bill</Text>
              <Ionicons name="checkmark-circle" size={20} color={Tokens['on-primary']} />
            </>
          )}
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
  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, paddingBottom: 180, gap: Spacing.md },
  billCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    overflow: 'hidden', shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  billHeader: { padding: Spacing.md, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'] },
  billLogo: {
    width: 48, height: 48, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['primary-container'], alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  billStoreName: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  billDate: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'], marginTop: 2 },
  billCustomer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
  },
  billSectionLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  billSectionValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'], fontWeight: '500' },
  billItemsSection: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'], gap: Spacing.sm },
  billItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billItemName: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'] },
  billItemSubtext: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'] },
  billItemAmount: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  billSummary: { padding: Spacing.md, gap: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  summaryValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'] },
  discountBadge: { backgroundColor: Tokens['secondary-fixed'], paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  discountBadgeText: { fontSize: 10, fontWeight: '600', color: Tokens['on-secondary-fixed'] },
  totalRow: { borderTopWidth: 1, borderTopColor: Tokens['outline-variant'], paddingTop: Spacing.sm },
  totalLabel: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  totalValue: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens.secondary },
  section: {},
  sectionTitle: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'], marginBottom: Spacing.sm },
  paymentGrid: { flexDirection: 'row', gap: Spacing.sm },
  paymentOption: {
    flex: 1, alignItems: 'center', gap: 6, padding: Spacing.sm,
    borderRadius: BorderRadius.xl, backgroundColor: Tokens['surface-container-lowest'],
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  paymentOptionActive: { backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'] },
  paymentLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  paymentLabelActive: { color: Tokens['on-primary'] },
  notesCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  notesText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'], flex: 1 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.xl,
    padding: Spacing.md,
  },
  errorText: { fontSize: Typography['body-md'].fontSize, color: Tokens.tertiary, flex: 1 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Tokens['surface-container-lowest'],
    borderTopWidth: 1, borderTopColor: Tokens['outline-variant'],
    paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.sm, paddingBottom: Spacing.md,
  },
  bottomSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  bottomLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  bottomAmount: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, backgroundColor: Tokens['primary-container'], borderRadius: BorderRadius.xl,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-primary'] },

  // Paid amount section
  paidSection: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  paidSectionTitle: {
    fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-surface'], marginBottom: Spacing.sm,
  },
  paidInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    height: 56, backgroundColor: Tokens['surface'],
    borderRadius: BorderRadius.xl, borderWidth: 2, borderColor: Tokens['primary-container'],
    paddingHorizontal: Spacing.md, gap: 4,
  },
  paidCurrencySign: {
    fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens['on-surface'],
    marginRight: 4,
  },
  paidInput: {
    flex: 1, height: '100%',
    fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens['on-surface'],
    paddingVertical: 0,
  },
  paidTotalBadge: {
    backgroundColor: Tokens['surface-container'], borderRadius: BorderRadius.lg,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  paidTotalBadgeText: {
    fontSize: Typography['label-md'].fontSize, fontWeight: '600', color: Tokens['on-surface-variant'],
  },
  paidHintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.sm,
  },
  paidHintText: {
    fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'], flex: 1,
  },
  dueWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.lg,
    padding: Spacing.sm, marginTop: Spacing.sm,
  },
  dueWarningText: { fontSize: Typography['body-md'].fontSize, color: Tokens.tertiary, flex: 1 },
  udhaarNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  udhaarIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Tokens['tertiary-fixed'], alignItems: 'center', justifyContent: 'center',
  },
  udhaarNoticeTitle: {
    fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens.tertiary,
  },
  udhaarNoticeText: { fontSize: Typography['body-md'].fontSize, color: Tokens.tertiary, flex: 1 },
});
