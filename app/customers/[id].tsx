import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api, CustomerDetail, BillListItem } from '@/lib/api';

export default function CustomerDetailScreen() {
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCustomer = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      const res = await api.getCustomer(token, id);
      setCustomer(res.data);
    } catch (e: any) {
      console.error('Failed to load customer', e.message);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      loadCustomer();
    }, [loadCustomer])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator size="large" color={Tokens.secondary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={{ textAlign: 'center', marginTop: 60, color: Tokens['on-surface-variant'] }}>
          {t('customers.notFound')}
        </Text>
      </SafeAreaView>
    );
  }

  const credit = Number(customer.total_credit);
  const initial = customer.name.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('customers.customerDetail')}</Text>
        </View>
        <TouchableOpacity style={styles.topBtn} onPress={() => (router as any).push('/customers/add?id=' + id)}>
          <Ionicons name="create-outline" size={22} color={Tokens.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{customer.name}</Text>
            {customer.phone && <Text style={styles.profilePhone}>+91 {customer.phone}</Text>}
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('customers.netOutstandingBalance')}</Text>
          <Text style={styles.balanceAmount}>₹ {credit.toFixed(2)}</Text>
          <Text style={styles.balanceDesc}>
            {credit > 0 ? t('customers.customerOwes') : t('customers.noBalance')}
          </Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.recordPaymentBtn} onPress={() => (router as any).push('/bill/history')}>
              <Ionicons name="receipt-outline" size={18} color={Tokens['on-primary']} />
              <Text style={styles.recordPaymentText}>{t('common.viewAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.newBillBtn} onPress={() => (router as any).push({
                pathname: '/bill/items',
                params: {
                  newCustomerId: id,
                  newCustomerName: customer.name,
                  newCustomerPhone: customer.phone || '',
                },
              })}>
              <Ionicons name="receipt-outline" size={18} color={Tokens.primary} />
              <Text style={styles.newBillText}>{t('customers.createBill')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {customer.credit_summary && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('customers.totalBills')}</Text>
              <Text style={styles.summaryValue}>₹{Number.isInteger(customer.credit_summary.total_billed) ? Number(customer.credit_summary.total_billed).toLocaleString('en-IN') : Number(customer.credit_summary.total_billed).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('customers.totalPaid')}</Text>
              <Text style={[styles.summaryValue, { color: Tokens.secondary }]}>
                ₹{Number.isInteger(customer.credit_summary.total_paid) ? Number(customer.credit_summary.total_paid).toLocaleString('en-IN') : Number(customer.credit_summary.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('customers.totalCredit')}</Text>
              <Text style={[styles.summaryValue, { color: Tokens.error }]}>
                ₹{Number.isInteger(customer.credit_summary.outstanding) ? Number(customer.credit_summary.outstanding).toLocaleString('en-IN') : Number(customer.credit_summary.outstanding).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.transactionsSection}>
          <Text style={styles.transactionsTitle}>{t('customers.billHistory')}</Text>
          {customer.bills && customer.bills.length > 0 ? (
            <View style={styles.transactionsList}>
              {customer.bills.map((bill: BillListItem, i: number) => {
                const isPaid = bill.payment_status === 'paid';
                const isPartial = bill.payment_status === 'partial';
                return (
                <View key={bill.id} style={styles.txOuter}>
                  <TouchableOpacity
                    style={styles.transactionItem}
                    onPress={() => (router as any).push('/bill/detail?uuid=' + bill.id)}
                  >
                    <View style={[styles.txIcon, {
                      backgroundColor: isPaid ? '#d4edda' : '#fde8e8'
                    }]}>
                      <Ionicons
                        name={isPaid ? 'checkmark-circle' : 'receipt-outline'}
                        size={20}
                        color={isPaid ? '#16a34a' : '#dc2626'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle}>{bill.bill_number}</Text>
                      <Text style={styles.txTime}>{bill.created_at ? new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txAmount, { color: '#16a34a' }]}>
                        ₹{Number(bill.total).toFixed(2)}
                      </Text>
                      <Text style={[styles.txStatusLabel, {
                        color: isPaid ? '#16a34a' : isPartial ? '#dc2626' : '#dc2626',
                      }]}>
                        {isPaid ? t('bill.statusPaid') : isPartial ? t('bill.statusPartial') : t('bill.statusPending')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {Number(bill.due_amount) > 0 && (
                    <TouchableOpacity
                      style={styles.collectBtn}
                      onPress={() => (router as any).push({
                        pathname: '/bill/modals/record-payment',
                        params: {
                          billUuid: bill.id,
                          billNumber: bill.bill_number,
                          customerName: customer.name,
                          total: String(bill.total),
                          dueAmount: String(bill.due_amount),
                        },
                      })}
                    >
                      <View style={styles.collectInner}>
                        <Ionicons name="wallet-outline" size={17} color="#ffffff" />
                        <Text style={styles.collectText}>Collect ₹{Number(bill.due_amount).toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )})}
            </View>
          ) : (
            <Text style={styles.noTx}>{t('customers.noBillsYet')}</Text>
          )}
        </View>
      </ScrollView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, height: 60,
    backgroundColor: Tokens.surface,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  topTitle: { fontSize: 18, fontWeight: '700', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 40 },
  profileCard: {
    backgroundColor: Tokens.surface, borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Tokens['secondary-container'], alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: Tokens['on-secondary-container'] },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend' },
  profilePhone: { fontSize: 14, color: Tokens['on-surface-variant'], marginTop: 2 },
  balanceCard: {
    backgroundColor: Tokens.primary, borderRadius: 18, padding: 20, gap: 4,
    shadowColor: Tokens.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  balanceLabel: {
    fontSize: 13, fontWeight: '600', color: Tokens['primary-fixed-dim'],
    letterSpacing: 1, marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36, fontWeight: '700', color: Tokens['on-primary'],
    fontFamily: 'Lexend-Bold',
  },
  balanceDesc: { fontSize: 14, color: Tokens['primary-fixed'], marginBottom: 16 },
  balanceActions: { flexDirection: 'row', gap: 10 },
  recordPaymentBtn: {
    flex: 1, height: 50, backgroundColor: Tokens.secondary, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  recordPaymentText: { fontSize: 14, fontWeight: '600', color: Tokens['on-primary'] },
  newBillBtn: {
    flex: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  newBillText: { fontSize: 14, fontWeight: '600', color: Tokens['on-primary'] },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1, backgroundColor: Tokens.surface, borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  summaryLabel: { fontSize: 11, color: Tokens['on-surface-variant'] },
  summaryValue: { fontSize: 16, fontWeight: '700', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold' },
  transactionsSection: { marginTop: 4 },
  transactionsTitle: { fontSize: 17, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold', marginBottom: 12 },
  transactionsList: { gap: 6 },
  txOuter: {
    backgroundColor: Tokens.surface, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  transactionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, minHeight: 64,
  },
  txIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  txTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.3 },
  txTime: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  txStatusLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  noTx: { textAlign: 'center', color: Tokens['on-surface-variant'], marginTop: 20 },
  collectBtn: {
    marginHorizontal: 12, marginBottom: 10, marginTop: -2,
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#1a5c4a',
    shadowColor: '#1a5c4a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  collectInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11,
  },
  collectText: { fontSize: 14, fontWeight: '700', color: '#ffffff', letterSpacing: 0.3 },
});
