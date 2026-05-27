import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useBill } from '@/lib/bill-context';
import { useTranslation } from 'react-i18next';

export default function QuickAddModal() {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState('piece');
  const { addItem } = useBill();
  const { t } = useTranslation();

  const units = ['Piece', 'Kilogram', 'Liter', 'Gram'];

  const isIntegerUnit = (unit: string) => unit === 'Piece';

  const handleAdd = () => {
    if (!name.trim() || !rate) return;
    let qty = parseFloat(quantity) || 1;
    if (isIntegerUnit(selectedUnit)) {
      qty = Math.round(qty);
      if (qty < 1) qty = 1;
    }
    addItem({
      id: Date.now().toString(),
      name: name.trim(),
      rate: parseFloat(rate),
      quantity: qty,
      unit: selectedUnit.toLowerCase(),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => router.back()} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('bill.newProduct')}</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Tokens['on-surface-variant']} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View>
              <Text style={styles.label}>{t('bill.productName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('bill.productNamePlaceholder')}
                placeholderTextColor={Tokens['on-surface-variant']}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('bill.sellingPrice')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Tokens['on-surface-variant']}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('common.quantity')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor={Tokens['on-surface-variant']}
                  value={quantity}
                  onChangeText={(text) => {
                    if (isIntegerUnit(selectedUnit)) {
                      setQuantity(text.replace(/[^0-9]/g, ''));
                    } else {
                      setQuantity(text);
                    }
                  }}
                  keyboardType={isIntegerUnit(selectedUnit) ? 'number-pad' : 'decimal-pad'}
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>{t('bill.unit')}</Text>
              <View style={styles.unitRow}>
                {units.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitChip, selectedUnit === u && styles.unitChipActive]}
                    onPress={() => setSelectedUnit(u)}
                  >
                    <Text style={[styles.unitText, selectedUnit === u && styles.unitTextActive]}>{t('units.' + u.toLowerCase())}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.9}>
              <Ionicons name="cart" size={22} color={Tokens['on-primary']} />
              <Text style={styles.addBtnText}>{t('bill.addToBill')}</Text>
            </TouchableOpacity>
          </View>
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
  formScroll: { maxHeight: 400 },
  formScrollContent: { gap: Spacing.md },
  handle: { width: 40, height: 4, backgroundColor: Tokens['outline-variant'], borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  closeBtn: { padding: 4 },
  form: { gap: Spacing.md },
  label: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'], marginBottom: 6 },
  input: {
    height: 56, backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Tokens['outline-variant'], paddingHorizontal: Spacing.md,
    fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'],
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  unitRow: { flexDirection: 'row', gap: Spacing.sm },
  unitChip: {
    flex: 1, height: 48, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  unitChipActive: { backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'] },
  unitText: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  unitTextActive: { color: Tokens['on-primary'] },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, backgroundColor: Tokens['primary-container'], borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
  },
  addBtnText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-primary'] },
});
