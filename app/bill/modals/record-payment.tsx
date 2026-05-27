import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast-provider';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

const PAYMENT_METHODS = [
  { key: 'cash', icon: 'cash', label: 'Cash' },
  { key: 'upi', icon: 'phone-portrait', label: 'UPI' },
  { key: 'card', icon: 'card', label: 'Card' },
] as const;

export default function RecordPaymentModal() {
  const { t } = useTranslation();
  const fmt = (n: number) => Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { billUuid, billNumber, customerName, total, dueAmount: dueAmountParam } = useLocalSearchParams<{
    billUuid: string;
    billNumber: string;
    customerName?: string;
    total?: string;
    dueAmount?: string;
  }>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState(dueAmountParam || '');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const dueAmount = parseFloat(dueAmountParam || '0');
  const billTotal = parseFloat(total || '0');

  const handleRecord = async () => {
    if (!token || !billUuid) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast({ type: 'error', title: t('common.error'), message: t('bill.enterValidAmount') });
      return;
    }
    if (parsedAmount > dueAmount) {
      showToast({ type: 'error', title: t('common.error'), message: t('bill.amountExceedsDue', { due: dueAmount.toFixed(2) }) });
      return;
    }

    setSaving(true);
    try {
      await api.addPayment(token, billUuid, {
        amount: parsedAmount,
        payment_method: paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast({ type: 'success', title: t('bill.paymentRecorded'), message: t('bill.paymentReceived', { amount: parsedAmount.toFixed(2) }) });
      router.back();
    } catch (e: any) {
      showToast({ type: 'error', title: t('common.error'), message: e?.message || t('bill.paymentFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => router.back()} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('bill.recordPayment')}</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Tokens['on-surface-variant']} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.billInfoCard}>
              <Text style={styles.billInfoNumber}>{billNumber}</Text>
              {customerName ? <Text style={styles.billInfoCustomer}>{customerName}</Text> : null}
              <View style={styles.billInfoRow}>
                <Text style={styles.billInfoLabel}>{t('common.total')}</Text>
                <Text style={styles.billInfoValue}>₹{fmt(billTotal)}</Text>
              </View>
              <View style={styles.billInfoRow}>
                <Text style={styles.billInfoLabel}>{t('common.due')}</Text>
                <Text style={[styles.billInfoValue, { color: Tokens.tertiary }]}>₹{fmt(dueAmount)}</Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('bill.amount')}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Tokens['on-surface-variant']}
                autoFocus
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('bill.paymentMethod')}</Text>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.methodChip, paymentMethod === m.key && styles.methodChipActive]}
                    onPress={() => setPaymentMethod(m.key)}
                  >
                    <Ionicons name={m.icon as any} size={20} color={paymentMethod === m.key ? Tokens['on-primary'] : Tokens['on-surface-variant']} />
                    <Text style={[styles.methodText, paymentMethod === m.key && styles.methodTextActive]}>{t('paymentMethods.' + m.key)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('bill.reference')}</Text>
              <TextInput
                style={styles.input}
                value={reference}
                onChangeText={setReference}
                placeholder={t('bill.referencePlaceholder')}
                placeholderTextColor={Tokens['on-surface-variant']}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('common.notes')}</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('bill.notesPlaceholder')}
                placeholderTextColor={Tokens['on-surface-variant']}
                multiline
                numberOfLines={2}
              />
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
              onPress={handleRecord}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color={Tokens['on-primary']} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color={Tokens['on-primary']} />
                  <Text style={styles.confirmText}>{t('bill.recordPaymentBtn')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,27,0.5)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: Tokens.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm, paddingBottom: Spacing.xl,
  },
  handle: { width: 40, height: 4, backgroundColor: Tokens['outline-variant'], borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  closeBtn: { padding: 4 },
  scrollContent: { gap: Spacing.md, paddingBottom: Spacing.md },
  billInfoCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, gap: 6,
  },
  billInfoNumber: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'] },
  billInfoCustomer: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'], marginBottom: 4 },
  billInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billInfoLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  billInfoValue: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  fieldGroup: { gap: 6 },
  label: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'] },
  amountInput: {
    height: 64, backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    borderWidth: 2, borderColor: Tokens.secondary, paddingHorizontal: Spacing.md,
    fontSize: 28, fontWeight: '800', color: Tokens['on-surface'], textAlign: 'center',
  },
  input: {
    height: 52, backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Tokens['outline-variant'], paddingHorizontal: Spacing.md,
    fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'],
  },
  notesInput: { height: 64, paddingTop: Spacing.sm, textAlignVertical: 'top' },
  methodRow: { flexDirection: 'row', gap: Spacing.sm },
  methodChip: {
    flex: 1, height: 52, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  methodChipActive: { backgroundColor: Tokens.secondary, borderColor: Tokens.secondary },
  methodText: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  methodTextActive: { color: Tokens['on-primary'] },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, backgroundColor: Tokens.secondary, borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
  },
  confirmText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-primary'] },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginTop: -Spacing.xs },
  cancelText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
});
