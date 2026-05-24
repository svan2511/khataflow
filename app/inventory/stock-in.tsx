import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import SidebarDrawer from '@/components/SidebarDrawer';
import { useAuth } from '@/lib/auth-context';
import { api, ProductData } from '@/lib/api';

export default function StockInScreen() {
  const { token } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductData[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [saving, setSaving] = useState(false);

  const searchProducts = useCallback(async (q: string) => {
    if (!token || q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    try {
      const res = await api.searchProducts(token, q, 10);
      setSearchResults(res.data);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    }
  }, [token]);

  const selectProduct = (product: ProductData) => {
    setSelectedProduct(product);
    setShowResults(false);
    setSearch(product.name);
    setPurchasePrice(product.cost_price ? String(product.cost_price) : '');
  };

  const handleStockIn = async () => {
    if (!token || !selectedProduct) {
      Alert.alert('Error', 'Please select a product first.');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      Alert.alert('Validation', 'Please enter a valid quantity.');
      return;
    }

    setSaving(true);
    try {
      await api.stockIn(token, {
        product_uuid: selectedProduct.id,
        quantity: Number(quantity),
        cost_price: purchasePrice ? Number(purchasePrice) : undefined,
      });
      Alert.alert('Success', 'Stock updated successfully.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const totalValue = selectedProduct && quantity
    ? Number(quantity) * Number(purchasePrice || selectedProduct.price)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.topBtn} onPress={() => setSidebarOpen(true)}>
            <Ionicons name="menu" size={22} color={Tokens.secondary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Record Stock Purchase</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search Product</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Tokens.outline} />
            <TextInput
              style={styles.searchInput}
              placeholder="Scan barcode or enter product name..."
              placeholderTextColor={Tokens.outline}
              value={search}
              onChangeText={(text) => { setSearch(text); searchProducts(text); }}
            />
          </View>
          {showResults && searchResults.length > 0 && (
            <View style={styles.dropdown}>
              {searchResults.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.dropdownItem}
                  onPress={() => selectProduct(p)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownName}>{p.name}</Text>
                    <Text style={styles.dropdownDetail}>
                      Stock: {Number(p.stock_quantity)} {p.unit} | Price: ₹{Number(p.price)}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={Tokens.secondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {selectedProduct && (
          <>
            <View style={styles.selectedCard}>
              <View style={styles.selectedHeader}>
                <View style={styles.selectedInfo}>
                  <View style={styles.productThumb}>
                    <Ionicons name="cube-outline" size={24} color={Tokens['on-surface-variant']} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName}>{selectedProduct.name}</Text>
                    <Text style={styles.selectedSku}>
                      {selectedProduct.sku ? `SKU: ${selectedProduct.sku} • ` : ''}
                      Current Stock: {Number(selectedProduct.stock_quantity)} {selectedProduct.unit}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.clearBtn} onPress={() => { setSelectedProduct(null); setSearch(''); }}>
                  <Ionicons name="close-circle" size={22} color={Tokens.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.fieldsRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Quantity Added</Text>
                  <View style={styles.fieldInputWrap}>
                    <Ionicons name="add-circle-outline" size={18} color={Tokens.outline} style={styles.fieldIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={Tokens.outline}
                      value={quantity}
                      onChangeText={setQuantity}
                    />
                  </View>
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Purchase Price (Per Unit)</Text>
                  <View style={styles.fieldInputWrap}>
                    <Ionicons name="cash-outline" size={18} color={Tokens.outline} style={styles.fieldIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={Tokens.outline}
                      value={purchasePrice}
                      onChangeText={setPurchasePrice}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Purchase Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Units Added</Text>
                <Text style={styles.summaryValue}>{quantity || '0'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cost per Unit</Text>
                <Text style={styles.summaryValue}>₹{Number(purchasePrice || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryTotal}>
                <Text style={styles.totalLabel}>Total Stock Value</Text>
                <Text style={styles.totalAmount}>
                  ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.updateBtn} onPress={handleStockIn} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Tokens['on-primary']} />
              ) : (
                <>
                  <Ionicons name="cube-outline" size={20} color={Tokens['on-primary']} />
                  <Text style={styles.updateBtnText}>Update Inventory</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <SidebarDrawer
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRoute="/inventory"
      />
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
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: Tokens.surface, borderRadius: 18, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    zIndex: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 14,
    backgroundColor: '#f8faf9', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: Tokens['on-surface'], fontFamily: 'Inter' },
  dropdown: {
    backgroundColor: Tokens.surface, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  dropdownName: { fontSize: 15, fontWeight: '600', color: Tokens['on-surface'] },
  dropdownDetail: { fontSize: 12, color: Tokens['on-surface-variant'], marginTop: 2 },
  selectedCard: {
    backgroundColor: Tokens.surface, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,107,89,0.2)', gap: 12,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  selectedHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  selectedInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  productThumb: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(0,107,89,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  selectedName: { fontSize: 16, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend' },
  selectedSku: { fontSize: 13, color: Tokens['on-surface-variant'], marginTop: 2 },
  clearBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)' },
  fieldsRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: Tokens['on-surface-variant'] },
  fieldInputWrap: { position: 'relative', height: 50, justifyContent: 'center' },
  fieldIcon: { position: 'absolute', left: 12, zIndex: 1 },
  fieldInput: {
    height: 50, paddingLeft: 38, paddingRight: 12,
    backgroundColor: '#f8faf9', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    fontSize: 15, color: Tokens['on-surface'], fontFamily: 'Inter',
  },
  summaryCard: {
    backgroundColor: 'rgba(0,107,89,0.04)', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,107,89,0.12)', gap: 10,
  },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: Tokens.secondary, fontFamily: 'Lexend' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  summaryLabel: { fontSize: 14, color: Tokens['on-surface-variant'] },
  summaryValue: { fontSize: 15, fontWeight: '600', color: Tokens['on-surface'] },
  summaryDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: Tokens['on-surface'] },
  totalAmount: { fontSize: 22, fontWeight: '700', color: Tokens.secondary, fontFamily: 'Lexend-SemiBold' },
  updateBtn: {
    height: 54, backgroundColor: Tokens.secondary, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  updateBtnText: { fontSize: 15, fontWeight: '600', color: Tokens['on-primary'] },
});
