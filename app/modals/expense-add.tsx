import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const categories = [
  'Utilities & Bills',
  'Shop Supplies',
  'Transport & Logistics',
  'Staff Welfare (Tea/Snacks)',
  'Repairs & Maintenance',
  'Other',
];

export default function ExpenseAddModal() {
  const { token } = useAuth();
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!token) return;
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter an expense title.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }

    setSaving(true);
    try {
      await api.createExpense(token, {
        title: title.trim(),
        amount: Number(amount),
        category: category || undefined,
        expense_date: new Date().toISOString().split('T')[0],
      });
      Alert.alert('Success', 'Expense recorded successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {/* Modal Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons name="card-outline" size={20} color={Tokens['on-secondary-container']} />
            </View>
            <Text style={styles.headerTitle}>Record Expense</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Amount Input */}
          <View style={styles.field}>
            <Text style={styles.label}>Amount (₹)</Text>
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

          {/* Expense Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Expense Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Electricity, Tea, Transport"
              placeholderTextColor={Tokens.outline}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Category Dropdown */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
              <Text style={[styles.selectText, !category && { color: Tokens.outline }]}>
                {category || 'Select a category'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Tokens['on-surface-variant']} />
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.pickerDropdown}>
                {categories.map((cat) => (
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

          {/* Date Display */}
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <View style={styles.dateInputWrap}>
              <TextInput
                style={styles.dateInput}
                placeholder="Today"
                placeholderTextColor={Tokens.outline}
                value={new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                editable={false}
              />
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Tokens['on-primary']} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={Tokens['on-primary']} />
                  <Text style={styles.submitBtnText}>Record Expense</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(25,28,27,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modal: {
    width: '100%', maxWidth: 448,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'],
    backgroundColor: Tokens['surface-bright'],
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Tokens['secondary-container'], alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: Tokens.primary, fontFamily: 'Lexend-SemiBold' },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  body: { padding: Spacing.md, gap: Spacing.md },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '500', color: Tokens['on-surface-variant'] },
  amountInputWrap: {
    position: 'relative', height: 56, justifyContent: 'center',
    backgroundColor: Tokens.surface, borderWidth: 1, borderColor: Tokens['outline-variant'],
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
    backgroundColor: Tokens.surface, borderWidth: 1, borderColor: Tokens['outline-variant'],
    borderRadius: 12, fontSize: 16, color: Tokens['on-surface'], fontFamily: 'Inter',
  },
  selectBtn: {
    height: 56, paddingHorizontal: 14,
    backgroundColor: Tokens.surface, borderWidth: 1, borderColor: Tokens['outline-variant'],
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 16, color: Tokens['on-surface'], fontFamily: 'Inter', flex: 1 },
  pickerDropdown: {
    marginTop: 4, backgroundColor: Tokens.surface, borderWidth: 1,
    borderColor: Tokens['outline-variant'], borderRadius: 12, overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'],
  },
  pickerItemActive: { backgroundColor: 'rgba(157,243,220,0.2)' },
  pickerText: { fontSize: 14, color: Tokens['on-surface'] },
  pickerTextActive: { color: Tokens.secondary, fontWeight: '600' },
  dateInputWrap: {
    height: 56, justifyContent: 'center',
    backgroundColor: Tokens.surface, borderWidth: 1, borderColor: Tokens['outline-variant'], borderRadius: 12,
  },
  dateInput: {
    height: 56, paddingHorizontal: 14,
    fontSize: 16, color: Tokens['on-surface'],
  },
  actions: {
    flexDirection: 'row', gap: 8, marginTop: 4,
  },
  cancelBtn: {
    height: 56, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: Tokens.secondary,
    alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Tokens.secondary },
  submitBtn: {
    height: 56, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: Tokens.secondary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1.5,
  },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: Tokens['on-primary'] },
});
