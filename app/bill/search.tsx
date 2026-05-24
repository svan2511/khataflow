import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useBill } from '@/lib/bill-context';
import { useAuth } from '@/lib/auth-context';
import { api, type ProductData } from '@/lib/api';
import Loader from '@/components/Loader';

export default function ProductSearchScreen() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const { addItem } = useBill();
  const { token } = useAuth();

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim() || !token) return;
    setSearching(true);
    try {
      const res = await api.searchProducts(token, q, 30);
      setProducts(res.data);
    } catch {
      // silently fail, keep showing previous results
    } finally {
      setSearching(false);
    }
  }, [token]);

  useEffect(() => {
    if (query.length < 1) {
      setProducts([]);
      return;
    }
    const timer = setTimeout(() => searchProducts(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchProducts]);

  const handleAdd = (product: ProductData) => {
    if (product.stock_quantity <= 0) return;
    addItem({
      id: product.id,
      product_uuid: product.id,
      name: product.name,
      rate: product.price,
      quantity: 1,
      unit: product.unit,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Products</Text>
        <TouchableOpacity style={styles.addNewBtn} onPress={() => (router as any).push('/bill/modals/quick-add')}>
          <Ionicons name="add-circle-outline" size={18} color={Tokens.secondary} />
          <Text style={styles.addNewText}>Add New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Tokens['on-surface-variant']} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Tokens['on-surface-variant']}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <TouchableOpacity style={styles.scanBtn}>
            <Ionicons name="qr-code-outline" size={22} color={Tokens['on-primary']} />
          </TouchableOpacity>
        </View>
      </View>

      {searching && (
        <View style={styles.loadingRow}>
          <Loader size={18} color={Tokens.secondary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!searching && query.length > 0 && products.length === 0 && (
        <View style={styles.resultInfo}>
          <Text style={styles.resultCount}>No results for "{query}"</Text>
        </View>
      )}

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {products.map(product => (
          <TouchableOpacity
            key={product.id}
            style={styles.productCard}
            onPress={() => handleAdd(product)}
            activeOpacity={0.7}
          >
            <View style={styles.productIcon}>
              <Ionicons name="cube" size={28} color={Tokens.secondary} />
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productRate}>₹{product.price}/{product.unit}</Text>
              <View style={styles.stockRow}>
                {product.stock_quantity > 0 ? (
                  <>
                    <Ionicons name="checkmark-circle" size={14} color={Tokens.secondary} />
                    <Text style={styles.inStock}>In Stock</Text>
                    <Text style={styles.stockQty}>| {product.stock_quantity} {product.unit}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="remove-circle" size={14} color={Tokens['on-surface-variant']} />
                    <Text style={styles.outOfStock}>Out of Stock</Text>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, product.stock_quantity <= 0 && styles.addBtnDisabled]}
              onPress={() => handleAdd(product)}
              disabled={product.stock_quantity <= 0}
            >
              <Ionicons name="add" size={20} color={product.stock_quantity > 0 ? Tokens['on-primary'] : Tokens['on-surface-variant']} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
      </KeyboardAvoidingView>
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
  addNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: BorderRadius.lg },
  addNewText: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens.secondary },
  searchContainer: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 56, backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.xl, paddingHorizontal: 12, gap: 8,
    borderWidth: 2, borderColor: Tokens['primary-container'],
  },
  searchInput: { flex: 1, fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'] },
  scanBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.lg,
    backgroundColor: Tokens['primary-container'], alignItems: 'center', justifyContent: 'center',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.sm },
  loadingText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  resultInfo: { paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.base },
  resultCount: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, gap: Spacing.sm },
  productCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  productIcon: {
    width: 56, height: 56, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['surface-container'], alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'] },
  productRate: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  inStock: { fontSize: Typography['body-md'].fontSize, color: Tokens.secondary },
  stockQty: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  outOfStock: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  addBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['primary-container'], alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: Tokens['surface-variant'], opacity: 0.5 },
});
