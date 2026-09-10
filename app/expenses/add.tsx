import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast-provider';
import { api } from '@/lib/api';

const CATEGORIES = [
  'Utilities & Bills',
  'Shop Supplies',
  'Transport & Logistics',
  'Staff Welfare (Tea/Snacks)',
  'Repairs & Maintenance',
  'Restaurant & Kitchen Supplies',
  'Other',
];

const toKey = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export default function ExpenseAddScreen() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!token) return;
    if (!title.trim()) {
      showToast({ type: 'error', title: t('common.validation'), message: t('expense.expenseTitleRequired') });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showToast({ type: 'error', title: t('common.validation'), message: t('validation.invalidAmount') });
      return;
    }

    setSaving(true);
    try {
      await api.createExpense(token, {
        title: title.trim(),
        amount: Number(amount),
        category: category || undefined,
        expense_date: toKey(expenseDate),
      });
      showToast({ type: 'success', title: t('common.success'), message: t('expense.savedSuccess') });
      router.back();
    } catch (e: any) {
      showToast({ type: 'error', title: t('common.error'), message: e.message || t('expense.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
        </TouchableOpacity>
        <View style={styles.topTitleWrap}>
          <View style={styles.topIcon}>
            <Ionicons name="wallet" size={20} color={Tokens['on-secondary-container']} />
          </View>
          <Text style={styles.topTitle}>{t('expenses.addExpense')}</Text>
        </View>
        <View style={styles.topBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>{t('expense.amount')} (₹)</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.rupeeSign}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Tokens.outline}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('expense.expenseTitle')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('expense.titlePlaceholder')}
            placeholderTextColor={Tokens.outline}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('expense.category')}</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => { Keyboard.dismiss(); setShowCategoryPicker(!showCategoryPicker); }}>
            <Text style={[styles.selectText, !category && { color: Tokens.outline }]}>
              {category || t('expenses.selectCategory')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={styles.pickerDropdown}>
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

        <View style={styles.field}>
          <Text style={styles.label}>{t('expense.date')}</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.selectText}>
              {expenseDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={expenseDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              if (event.type === 'dismissed' || Platform.OS !== 'ios') setShowDatePicker(false);
              if (date) setExpenseDate(date);
            }}
          />
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Tokens['on-primary']} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={Tokens['on-primary']} />
                <Text style={styles.submitBtnText}>{t('expenses.recordExpense')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Tokens.surface },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, height: 64, backgroundColor: Tokens['surface-bright'],
    borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'],
  },
  topBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  topTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Tokens['secondary-container'], alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: 20, fontWeight: '600', color: Tokens.primary, fontFamily: 'Lexend-SemiBold' },
  scroll: { flex: 1 },
  body: { padding: Spacing.md, gap: Spacing.md },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '500', color: Tokens['on-surface-variant'], fontFamily: 'Inter' },
  amountInputWrap: {
    position: 'relative', height: 56, justifyContent: 'center',
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
    borderRadius: 12,
  },
  rupeeSign: {
    position: 'absolute', left: 14,
    fontSize: 17, fontWeight: '600', color: Tokens.primary, fontFamily: 'Lexend',
  },
  amountInput: {
    height: 56, paddingLeft: 40, paddingRight: 14,
    fontSize: 17, fontWeight: '600', color: Tokens.primary, fontFamily: 'Lexend',
  },
  textInput: {
    height: 56, paddingHorizontal: 14,
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
    borderRadius: 12, fontSize: 16, color: Tokens['on-surface'], fontFamily: 'Inter',
  },
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: {
    height: 56, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: Tokens.secondary,
    alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Tokens.secondary, fontFamily: 'Inter-SemiBold' },
  submitBtn: {
    height: 56, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: Tokens.secondary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1.5,
  },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: Tokens['on-primary'], fontFamily: 'Inter-SemiBold' },
});
