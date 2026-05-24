import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useBill } from '@/lib/bill-context';

const presets = [5, 10, 15, 20];

export default function DiscountModal() {
  const { discount, setDiscount, subtotal, discountAmount } = useBill();
  const [type, setType] = useState<'percentage' | 'fixed'>(discount?.type || 'percentage');
  const [value, setValue] = useState(discount?.value.toString() || '');

  const computedDiscount = type === 'percentage'
    ? subtotal * (parseFloat(value || '0') / 100)
    : Math.min(parseFloat(value || '0'), subtotal);
  const afterDiscount = subtotal - computedDiscount;

  const handleApply = () => {
    if (!value || parseFloat(value) <= 0) {
      setDiscount(null);
    } else {
      setDiscount({ type, value: parseFloat(value) });
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => router.back()} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Add Discount</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Tokens['on-surface-variant']} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'percentage' && styles.toggleBtnActive]}
              onPress={() => setType('percentage')}
            >
              <Text style={[styles.toggleText, type === 'percentage' && styles.toggleTextActive]}>% Percentage</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'fixed' && styles.toggleBtnActive]}
              onPress={() => setType('fixed')}
            >
              <Text style={[styles.toggleText, type === 'fixed' && styles.toggleTextActive]}>₹ Fixed Amount</Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text style={styles.label}>{type === 'percentage' ? 'Discount Percentage' : 'Discount Amount'}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={Tokens['on-surface-variant']}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputSuffix}>{type === 'percentage' ? '%' : '₹'}</Text>
            </View>
          </View>

          {type === 'percentage' && (
            <View>
              <Text style={styles.presetLabel}>Quick Select</Text>
              <View style={styles.presetRow}>
                {presets.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.presetChip, parseFloat(value) === p && styles.presetChipActive]}
                    onPress={() => setValue(p.toString())}
                  >
                    <Text style={[styles.presetText, parseFloat(value) === p && styles.presetTextActive]}>{p}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.preview}>
            <View style={styles.previewCol}>
              <Text style={styles.previewLabel}>Subtotal</Text>
              <Text style={styles.previewValue}>₹{subtotal}</Text>
            </View>
            <View style={styles.previewCol}>
              <Text style={styles.previewLabel}>Discount</Text>
              <Text style={[styles.previewValue, { color: Tokens.secondary }]}>-₹{Math.round(computedDiscount)}</Text>
            </View>
            <View style={styles.previewCol}>
              <Text style={styles.previewLabel}>After Discount</Text>
              <Text style={styles.previewValue}>₹{Math.round(afterDiscount)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.9}>
            <Text style={styles.applyText}>Apply Discount</Text>
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
    backgroundColor: Tokens.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm, paddingBottom: Spacing.xl,
  },
  scrollContent: { gap: Spacing.md },
  handle: { width: 40, height: 4, backgroundColor: Tokens['outline-variant'], borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  closeBtn: { padding: 4 },
  toggleRow: {
    flexDirection: 'row', backgroundColor: Tokens['surface-container'], borderRadius: BorderRadius.xl,
    padding: 2, marginBottom: Spacing.md,
  },
  toggleBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4,
  },
  toggleBtnActive: { backgroundColor: Tokens['surface-container-lowest'] },
  toggleText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface-variant'] },
  toggleTextActive: { color: Tokens['on-surface'] },
  label: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'], marginBottom: 6 },
  inputRow: { position: 'relative' },
  input: {
    height: 56, backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    borderWidth: 2, borderColor: Tokens['primary-container'], paddingHorizontal: Spacing.md,
    fontSize: Typography['headline-md'].fontSize, color: Tokens['on-surface'], textAlign: 'center',
  },
  inputSuffix: {
    position: 'absolute', right: 16, top: 0, bottom: 0, textAlignVertical: 'center',
    fontSize: Typography['headline-sm'].fontSize, color: Tokens['on-surface-variant'],
    lineHeight: 56,
  },
  presetLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'], marginBottom: Spacing.sm, marginTop: Spacing.sm },
  presetRow: { flexDirection: 'row', gap: Spacing.sm },
  presetChip: {
    flex: 1, height: 44, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  presetChipActive: { backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'] },
  presetText: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  presetTextActive: { color: Tokens['on-primary'] },
  preview: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Tokens['surface-container'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, marginTop: Spacing.md,
  },
  previewCol: { alignItems: 'center' },
  previewLabel: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'] },
  previewValue: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '600', color: Tokens['on-surface'], marginTop: 2 },
  applyBtn: {
    height: 56, backgroundColor: Tokens['primary-container'], borderRadius: BorderRadius.xl,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md,
  },
  applyText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-primary'] },
});
