import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import SidebarDrawer from '@/components/SidebarDrawer';
import { useAuth } from '@/lib/auth-context';
import { api, ProductData } from '@/lib/api';

export default function ProductsListScreen() {
  const { token } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<string[]>(['All Items', 'Low Stock']);
  const [totalProducts, setTotalProducts] = useState(0);

  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (!token) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, any> = { per_page: 50 };

      if (search) params.search = search;
      if (activeCategory === 'Low Stock') params.low_stock = true;

      const res = await api.listProducts(token, params);
      setProducts(res.data);
      if (res.meta) setTotalProducts(res.meta.total);

      const cats = new Set<string>();
      res.data.forEach(p => {
        if (p.category?.name) cats.add(p.category.name);
      });
      if (cats.size > 0) setCategories(['All Items', 'Low Stock', ...Array.from(cats)]);
    } catch (e: any) {
      console.error('Failed to fetch products', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, search, activeCategory]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  useFocusEffect(
    useCallback(() => {
      if (!search) return;
      const timer = setTimeout(() => fetchProducts(), 400);
      return () => clearTimeout(timer);
    }, [search])
  );

  const handleDelete = async (uuid: string, name: string) => {
    if (!token) return;
    try {
      await api.deleteProduct(token, uuid);
      setProducts(prev => prev.filter(p => p.id !== uuid));
    } catch (e: any) {
      console.error('Failed to delete product', e.message);
    }
  };

  const filteredProducts = activeCategory === 'All Items'
    ? products
    : activeCategory === 'Low Stock'
      ? products.filter(p => p.is_low_stock)
      : products.filter(p => p.category?.name === activeCategory);

  const lowStockCount = products.filter(p => p.is_low_stock).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSidebarOpen(true)}>
          <Ionicons name="menu" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.topTitle}>Inventory</Text>
          <Text style={styles.topSubtitle}>{totalProducts} products</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => fetchProducts(true)}>
          <Ionicons name="refresh" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchProducts(true)} tintColor={Tokens.secondary} />}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="cube" size={20} color="#2e7d32" />
            </View>
            <Text style={styles.statValue}>{totalProducts}</Text>
            <Text style={styles.statLabel}>Total Products</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="warning-outline" size={20} color="#e65100" />
            </View>
            <Text style={[styles.statValue, { color: '#e65100' }]}>{lowStockCount}</Text>
            <Text style={styles.statLabel}>Low Stock</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="pricetags-outline" size={20} color="#1565c0" />
            </View>
            <Text style={[styles.statValue, { color: '#1565c0' }]}>{categories.length - 2}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
        </View>

        {/* Search + Category Filters */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Tokens.outline} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, categories or barcodes..."
              placeholderTextColor={Tokens.outline}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipsRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, activeCategory === cat && styles.chipActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Product List */}
        {loading ? (
          <ActivityIndicator size="large" color={Tokens.secondary} style={{ marginTop: 40 }} />
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="search-outline" size={36} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptySub}>Try adjusting your search or add a new product.</Text>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {filteredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                activeOpacity={0.95}
                onPress={() => (router as any).push('/inventory/add?id=' + product.id)}
                onLongPress={() => handleDelete(product.id, product.name)}
              >
                <View style={styles.productCardTop}>
                  {product.image ? (
                    <Image source={{ uri: product.image }} style={styles.productThumb} />
                  ) : (
                    <View style={styles.productThumbPlaceholder}>
                      <Ionicons name="cube-outline" size={24} color={Tokens['on-surface-variant']} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                    <View style={styles.productBadges}>
                      {product.category && (
                        <View style={styles.badgeCategory}>
                          <Text style={styles.badgeCategoryText}>{product.category.name}</Text>
                        </View>
                      )}
                      <View style={[styles.badgeStock, product.is_low_stock && styles.badgeStockLow]}>
                        <View style={[styles.dot, product.is_low_stock ? styles.dotLow : styles.dotOk]} />
                        <Text style={[styles.badgeStockText, product.is_low_stock && { color: '#dc2626' }]}>
                          {product.is_low_stock ? 'Low' : 'In Stock'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {product.barcode && (
                    <View style={styles.barcodeWrap}>
                      <Ionicons name="barcode-outline" size={14} color={Tokens.outline} />
                    </View>
                  )}
                </View>

                <View style={styles.productMeta}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Price</Text>
                    <Text style={styles.metaPrice}>₹{Number(product.price).toFixed(2)}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Stock</Text>
                    <Text style={[styles.metaStock, product.is_low_stock && { color: '#dc2626' }]}>
                      {Number(product.stock_quantity)} {product.unit}
                    </Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => (router as any).push('/inventory/add?id=' + product.id)}>
                      <Ionicons name="create-outline" size={16} color={Tokens.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add New Product Card */}
            <TouchableOpacity style={styles.addCard} onPress={() => (router as any).push('/inventory/add')} activeOpacity={0.9}>
              <View style={styles.addIconWrap}>
                <Ionicons name="add" size={32} color="#fff" />
              </View>
              <Text style={styles.addTitle}>Add New Product</Text>
              <Text style={styles.addSub}>Scan barcode or enter details manually</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => (router as any).push('/inventory/add')}>
        <Ionicons name="add" size={28} color={Tokens['on-primary']} />
      </TouchableOpacity>

      <SidebarDrawer
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRoute="/inventory"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fa' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 64, backgroundColor: '#fff',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  topTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', fontFamily: 'Lexend-SemiBold' },
  topSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 12, paddingBottom: 100, gap: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', fontFamily: 'Lexend-SemiBold' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Search
  searchSection: { gap: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16,
    backgroundColor: '#fff', borderRadius: 14, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1c1c1e' },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  chipActive: { backgroundColor: Tokens.secondary },
  chipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  chipTextActive: { color: '#fff' },

  // Products
  productGrid: { gap: 14 },
  productCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  productCardTop: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  productThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#f3f4f6' },
  productThumbPlaceholder: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  productBadges: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  badgeCategory: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: '#f0fdf4',
  },
  badgeCategoryText: { fontSize: 11, fontWeight: '700', color: Tokens.secondary, letterSpacing: 0.3 },
  badgeStock: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: '#f0fdf4',
  },
  badgeStockLow: { backgroundColor: '#fef2f2' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOk: { backgroundColor: '#16a34a' },
  dotLow: { backgroundColor: '#dc2626' },
  badgeStockText: { fontSize: 11, fontWeight: '600', color: '#16a34a' },
  barcodeWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },

  productName: { fontSize: 16, fontWeight: '600', color: '#1c1c1e', fontFamily: 'Lexend' },

  productMeta: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, padding: 10 },
  metaItem: { flex: 1, alignItems: 'center' },
  metaLabel: { fontSize: 11, fontWeight: '500', color: '#9ca3af', marginBottom: 2 },
  metaPrice: { fontSize: 16, fontWeight: '700', color: Tokens.secondary, fontFamily: 'Lexend-SemiBold' },
  metaDivider: { width: 1, height: 28, backgroundColor: '#e5e7eb' },
  metaStock: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  editBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(0,107,89,0.08)', alignItems: 'center', justifyContent: 'center' },

  // Add Card
  addCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 24,
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,107,89,0.2)',
    alignItems: 'center', justifyContent: 'center', minHeight: 180,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  addIconWrap: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: Tokens.secondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  addTitle: { fontSize: 16, fontWeight: '600', color: '#1c1c1e', fontFamily: 'Lexend' },
  addSub: { fontSize: 13, color: '#9ca3af', marginTop: 4, textAlign: 'center', maxWidth: 200 },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#6b7280' },
  emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', maxWidth: 240 },

  // FAB
  fab: {
    position: 'absolute', bottom: 32, right: 20, width: 60, height: 60,
    borderRadius: 18, backgroundColor: Tokens.secondary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
});
