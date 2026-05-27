import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api, ProductData } from '@/lib/api';

export default function AddEditProductScreen() {
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [unit, setUnit] = useState('pc');
  const [openingStock, setOpeningStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);

  useEffect(() => {
    if (isEditing && token) {
      loadProduct();
    }
  }, [id, token]);

  const loadProduct = async () => {
    if (!token || !id) return;
    try {
      const res = await api.getProduct(token, id);
      const p = res.data;
      setProductName(p.name);
      setCategory(p.category?.name || '');
      setSellingPrice(String(p.price));
      setPurchasePrice(p.cost_price ? String(p.cost_price) : '');
      setUnit(p.unit);
      setOpeningStock(p.stock_quantity ? String(p.stock_quantity) : '');
      setLowStockThreshold(p.low_stock_threshold ? String(p.low_stock_threshold) : '');
      if (p.image) setImage(p.image);
    } catch (e: any) {
      Alert.alert(t('common.error'), t('inventory.loadFailed'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('inventory.permissionNeeded'), t('inventory.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      setImageFile(result.assets[0] as any);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (!productName.trim()) {
      Alert.alert(t('common.validation'), t('inventory.nameRequired'));
      return;
    }
    if (!sellingPrice || Number(sellingPrice) <= 0) {
      Alert.alert(t('common.validation'), t('inventory.priceRequired'));
      return;
    }

    setSaving(true);
    try {
      const formData = buildForm();
      if (isEditing && id) {
        await api.updateProductFull(token, id, formData);
      } else {
        await api.createProductFull(token, formData);
      }
      router.back();
    } catch (e: any) {
      if (!isEditing && category.trim() && /UNIQUE|duplicate/i.test(e?.message || '')) {
        const fallback = buildForm(true);
        try {
          await api.createProductFull(token, fallback);
          router.back();
          return;
        } catch {}
      }
      const apiMsg = e?.message || '';
      const translated = /low stock threshold/i.test(apiMsg) ? t('validation.lowStockThresholdRequired') : apiMsg;
      Alert.alert(t('common.error'), translated || t('inventory.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const buildForm = (skipCategory?: boolean) => {
    const fd = new FormData();
    fd.append('name', productName.trim());
    fd.append('price', sellingPrice);
    fd.append('unit', unit);
    if (!skipCategory && category.trim()) fd.append('category_name', category.trim());
    if (purchasePrice) fd.append('cost_price', purchasePrice);
    if (openingStock) fd.append('stock_quantity', openingStock);
    if (lowStockThreshold) fd.append('low_stock_threshold', lowStockThreshold);
    if (imageFile) {
      const filename = imageFile.fileName || 'product.jpg';
      const ext = filename.split('.').pop() || 'jpg';
      fd.append('image', { uri: imageFile.uri, type: `image/${ext}`, name: filename } as any);
    }
    return fd;
  };

  const units = ['pc', 'kg', 'g', 'l', 'ml', 'dozen', 'box', 'packet'];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator size="large" color={Tokens.secondary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isEditing ? t('inventory.editProduct') : t('inventory.addProduct')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.imageSection} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.productImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={36} color={Tokens['on-surface-variant']} />
              </View>
            )}
            <Text style={styles.imageLabel}>{image ? t('inventory.changeImage') : t('inventory.addImage')}</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('inventory.coreDetails')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('inventory.productName')} <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder={t('inventory.productNamePlaceholder')}
                placeholderTextColor={Tokens.outline}
                value={productName}
                onChangeText={setProductName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('inventory.category')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('inventory.categoryPlaceholder')}
                placeholderTextColor={Tokens.outline}
                value={category}
                onChangeText={setCategory}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('inventory.pricingInventory')}</Text>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>{t('inventory.sellingPrice')} <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={Tokens.outline}
                  keyboardType="numeric"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>{t('inventory.purchasePrice')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={Tokens.outline}
                  keyboardType="numeric"
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>{t('inventory.unit')} <Text style={styles.required}>*</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitRow}>
                  {units.map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitChip, unit === u && styles.unitChipActive]}
                      onPress={() => setUnit(u)}
                    >
                      <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>{t('inventory.totalStock')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Tokens.outline}
                  keyboardType="numeric"
                  value={openingStock}
                  onChangeText={setOpeningStock}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('inventory.lowStockAlert')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('inventory.lowStockPlaceholder')}
                placeholderTextColor={Tokens.outline}
                keyboardType="numeric"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
              />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={Tokens['on-primary']} />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color={Tokens['on-primary']} />
              <Text style={styles.saveBtnText}>{isEditing ? t('inventory.updateProduct') : t('inventory.save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      </View>
      </KeyboardAvoidingView>
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
  scrollContent: { padding: 16, paddingBottom: 100, gap: 14 },
  imageSection: {
    alignItems: 'center', justifyContent: 'center', padding: 20,
    backgroundColor: Tokens.surface, borderRadius: 18, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  imagePlaceholder: {
    width: 88, height: 88, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: Tokens['outline-variant'], alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8faf9',
  },
  productImage: {
    width: 120, height: 120, borderRadius: 16,
  },
  imageLabel: { fontSize: 13, fontWeight: '500', color: Tokens['on-surface-variant'] },
  card: {
    backgroundColor: Tokens.surface, borderRadius: 18, padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  cardTitle: {
    fontSize: 17, fontWeight: '600', color: Tokens['on-surface'],
    fontFamily: 'Lexend', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  fieldGroup: { gap: 4 },
  label: { fontSize: 13, fontWeight: '500', color: Tokens['on-surface-variant'], marginLeft: 2 },
  required: { color: Tokens.error },
  input: {
    height: 52, paddingHorizontal: 14, backgroundColor: Tokens.surface,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 12,
    fontSize: 15, color: Tokens['on-surface'], fontFamily: 'Inter',
  },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 4 },
  unitRow: { flexDirection: 'row', paddingVertical: 8, gap: 6 },
  unitChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#f8faf9', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    marginRight: 6,
  },
  unitChipActive: { backgroundColor: Tokens.secondary, borderColor: Tokens.secondary },
  unitChipText: { fontSize: 13, color: Tokens['on-surface-variant'] },
  unitChipTextActive: { color: Tokens['on-primary'], fontWeight: '600' },
  bottomBar: {
    padding: 16,
    backgroundColor: Tokens.surface, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  saveBtn: {
    height: 54, backgroundColor: Tokens.secondary, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: Tokens['on-primary'] },
});
