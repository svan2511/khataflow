import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useBill } from '@/lib/bill-context';
import { useTranslation } from 'react-i18next';

const modes = [
  { key: 'Cash', icon: 'cash', label: 'Cash', desc: 'Pay with physical currency' },
  { key: 'UPI', icon: 'phone-portrait', label: 'UPI', desc: 'Google Pay, PhonePe, Paytm' },
  { key: 'Card', icon: 'card', label: 'Card', desc: 'Credit / Debit card' },
  { key: 'Udhaar', icon: 'book', label: 'Udhaar (Credit)', desc: "Add to customer's ledger" },
  { key: 'Split', icon: 'git-branch', label: 'Split Payment', desc: 'Pay using multiple methods' },
] as const;

export default function PaymentModeModal() {
  const { t } = useTranslation();
  const { paymentMode, setPaymentMode, grandTotal } = useBill();

  const handleSelect = (key: string) => {
    setPaymentMode(key);
    router.back();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{t('bill.selectPayment')}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
        </View>

        <Text style={styles.totalText}>
          {t('bill.totalAmountLabel')} <Text style={styles.totalAmount}>₹{grandTotal}</Text>
        </Text>

        <View style={styles.list}>
          {modes.map(mode => (
            <TouchableOpacity
              key={mode.key}
              style={[styles.option, paymentMode === mode.key && styles.optionActive]}
              onPress={() => handleSelect(mode.key)}
            >
              <View style={[styles.iconBox, paymentMode === mode.key && styles.iconBoxActive]}>
                <Ionicons name={mode.icon as any} size={26} color={paymentMode === mode.key ? Tokens['on-primary'] : Tokens['on-surface-variant']} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, paymentMode === mode.key && styles.optionLabelActive]}>{t(mode.key === 'Split' ? 'bill.splitLabel' : 'paymentMethods.' + mode.key.toLowerCase())}</Text>
                <Text style={styles.optionDesc}>{t('bill.' + mode.key.toLowerCase() + 'Desc')}</Text>
              </View>
              {paymentMode === mode.key ? (
                <Ionicons name="checkmark-circle" size={22} color={Tokens['primary-container']} />
              ) : mode.key === 'Split' ? (
                <Ionicons name="chevron-forward" size={18} color={Tokens['on-surface-variant']} />
              ) : (
                <View style={styles.radio} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.confirmBtn} onPress={() => router.back()} activeOpacity={0.9}>
          <Text style={styles.confirmText}>{t('bill.confirmPayment')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(25,28,27,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Tokens.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm, paddingBottom: Spacing.xl,
  },
  handle: { width: 40, height: 4, backgroundColor: Tokens['outline-variant'], borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  title: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  closeBtn: { padding: 4 },
  totalText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'], marginBottom: Spacing.md },
  totalAmount: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  list: { gap: Spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  optionActive: { backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'] },
  iconBox: {
    width: 48, height: 48, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['surface-container'], alignItems: 'center', justifyContent: 'center',
  },
  iconBoxActive: { backgroundColor: Tokens['primary-container'] },
  optionLabel: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'] },
  optionLabelActive: { color: Tokens['on-primary'] },
  optionDesc: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Tokens['outline-variant'] },
  confirmBtn: {
    height: 56, backgroundColor: Tokens['primary-container'], borderRadius: BorderRadius.xl,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md,
  },
  confirmText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-primary'] },
});
