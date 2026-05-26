import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBill } from '@/lib/bill-context';
import { useAuth } from '@/lib/auth-context';
import { api, type ProductData } from '@/lib/api';
import Loader from '@/components/Loader';

export default function ProductSelectScreen() {
  const { items, customer, addItem, updateItemQuantity, removeItem, grandTotal, setCustomer } = useBill();
  const { token } = useAuth();
  const { newCustomerId, newCustomerName, newCustomerPhone } = useLocalSearchParams<{
    newCustomerId?: string;
    newCustomerName?: string;
    newCustomerPhone?: string;
  }>();
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPrice, setQuickPrice] = useState('');
  const [quickCostPrice, setQuickCostPrice] = useState('');
  const [quickUnit, setQuickUnit] = useState('pc');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickStock, setQuickStock] = useState('');
  const [quickLowStock, setQuickLowStock] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const quickUnits = ['pc', 'kg', 'g', 'l', 'ml', 'dozen', 'box', 'packet'];

  useEffect(() => {
    if (newCustomerId && newCustomerName) {
      setCustomer({ uuid: newCustomerId, name: newCustomerName, phone: newCustomerPhone || undefined });
    }
  }, []);

  const GST_RATES = [0, 3, 5, 12, 18, 28];

  // Modal state
  const [modalProduct, setModalProduct] = useState<ProductData | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalQtyInput, setModalQtyInput] = useState('1');
  const [modalEditing, setModalEditing] = useState(false);
  const [modalGstRate, setModalGstRate] = useState(0);
  const insets = useSafeAreaInsets();

  const fetchProducts = useCallback(async (q?: string) => {
    if (!token) return;
    try {
      const res = q
        ? await api.searchProducts(token, q, 100)
        : await api.listProducts(token, { per_page: 100 });
      setProducts(res.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => fetchProducts(search), 200);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  const openQtyModal = (product: ProductData) => {
    const existing = items.find(i => i.product_uuid === product.id);
    const qty = existing?.quantity || 1;
    setModalProduct(product);
    setModalQty(qty);
    setModalQtyInput(String(qty));
    setModalEditing(false);
    setModalGstRate(existing?.gstRate ?? 0);
  };

  const closeQtyModal = () => {
    setModalProduct(null);
  };

  const confirmQty = () => {
    if (!modalProduct) return;
    let qty = modalEditing ? parseFloat(modalQtyInput) : modalQty;
    if (isNaN(qty) || qty <= 0) return;
    if (isIntegerUnit(modalProduct.unit)) {
      qty = Math.round(qty);
      if (qty < 1) return;
    }

    addItem({
      id: modalProduct.id,
      product_uuid: modalProduct.id,
      name: modalProduct.name,
      rate: modalProduct.price,
      quantity: qty,
      unit: modalProduct.unit,
      gstRate: modalGstRate,
    });
    closeQtyModal();
  };

  const modalStep = 1;

  const handleModalQtyDelta = (delta: number) => {
    const integerUnit = modalProduct && isIntegerUnit(modalProduct.unit);
    if (modalEditing) {
      const parsed = parseFloat(modalQtyInput);
      if (!isNaN(parsed) && parsed > 0) {
        let next: number;
        if (integerUnit) {
          next = Math.max(1, Math.round(parsed + delta));
        } else {
          next = parseFloat((parsed + delta * modalStep).toFixed(1));
          next = Math.max(0.1, next);
        }
        setModalQty(next);
      }
      setModalEditing(false);
    } else {
      setModalQty(prev => {
        let next: number;
        if (integerUnit) {
          next = Math.max(1, Math.round(prev + delta));
        } else {
          next = parseFloat((prev + delta * modalStep).toFixed(1));
          next = Math.max(0.001, next);
        }
        return next;
      });
    }
  };

  const isIntegerUnit = (unit?: string) => unit && ['pc', 'box', 'packet'].includes(unit);
const displayUnit = (unit?: string) => unit || 'pcs';

  const handleQuickAdd = async () => {
    if (!quickName.trim() || !quickPrice.trim() || !token) return;
    setQuickSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', quickName.trim());
      formData.append('price', quickPrice);
      formData.append('unit', quickUnit);
      if (quickCategory.trim()) formData.append('category_name', quickCategory.trim());
      if (quickCostPrice) formData.append('cost_price', quickCostPrice);
      if (quickStock) formData.append('stock_quantity', quickStock);
      if (quickLowStock) formData.append('low_stock_threshold', quickLowStock);
      const res = await api.createProductFull(token, formData);
      const product = res.data;
      addItem({
        id: product.id,
        product_uuid: product.id,
        name: product.name,
        rate: product.price,
        quantity: 1,
        unit: product.unit,
      });
      setQuickName('');
      setQuickPrice('');
      setQuickCostPrice('');
      setQuickUnit('pc');
      setQuickCategory('');
      setQuickStock('');
      setQuickLowStock('');
      setShowQuickAdd(false);
      fetchProducts(search);
    } catch (e: any) {
      alert(e.message || 'Failed to create product');
    } finally {
      setQuickSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
            <Ionicons name="arrow-back" size={24} color="#1c1c1e" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.topTitle}>Add Items</Text>
            <Text style={styles.topSubtitle} numberOfLines={1}>
              {customer?.name || 'Walk-in Customer'}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
            />
            {loading && <Loader size={18} color="#0891b2" />}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {items.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Added Items ({items.length})
              </Text>
              <View style={styles.addedSection}>
                  {items.map(item => {
                  const itemSubtotal = item.rate * item.quantity;
                  const gstAmt = (item.gstRate ?? 0) > 0 ? itemSubtotal * (item.gstRate ?? 0) / 100 : 0;
                  return (
                  <View key={item.id} style={styles.addedCard}>
                    <View style={styles.addedRow}>
                      <View style={styles.addedIcon}>
                        <Ionicons name="cart" size={18} color="#0891b2" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.addedName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.addedRate}>
                          ₹{item.rate}/{displayUnit(item.unit)}
                          {(item.gstRate ?? 0) > 0 ? ` GST ${item.gstRate}%` : ''}
                        </Text>
                      </View>
                      <Text style={styles.addedLineTotal}>₹{(itemSubtotal + gstAmt).toFixed(2)}</Text>
                    </View>
                    <View style={styles.addedQtyRow}>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateItemQuantity(item.id, Math.max(isIntegerUnit(item.unit) ? 1 : 0.1, item.quantity - 1))}
                        >
                          <Ionicons name="remove" size={18} color="#6b7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            const p = products.find(pr => pr.id === item.id);
                            if (p) openQtyModal(p);
                          }}
                        >
                          <View style={styles.qtyValueWrap}>
                            <Text style={styles.qtyValue}>{isIntegerUnit(item.unit) ? item.quantity : Number(item.quantity).toFixed(1)}</Text>
                            {item.unit && <Text style={styles.qtyUnit}>{item.unit}</Text>}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.qtyBtn, styles.qtyAddBtn]}
                          onPress={() => updateItemQuantity(item.id, item.quantity + 1)}
                        >
                          <Ionicons name="add" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(item.id)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.divider} />
            </>
          )}

          <Text style={styles.sectionTitle}>All Products</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <Loader size={48} color="#0891b2" />
            </View>
          ) : (
            products.map(product => {
              const selected = items.some(i => i.product_uuid === product.id);
              return (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.productCard, selected && styles.productCardSelected]}
                  onPress={() => openQtyModal(product)}
                  activeOpacity={0.7}
                >
                  <View style={styles.productRow}>
                    <View style={[styles.productIcon, selected && styles.productIconSelected]}>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'cube-outline'}
                        size={22}
                        color={selected ? '#fff' : '#0891b2'}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>₹{product.price} / {displayUnit(product.unit)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {showQuickAdd && (
            <View style={styles.quickAddCard}>
              <Text style={styles.quickAddTitle}>New Product</Text>
              <Text style={styles.quickAddSubtitle}>This will be saved to your product list</Text>

              <Text style={styles.qaLabel}>Product Name *</Text>
              <TextInput
                style={styles.quickAddInput}
                placeholder="e.g. Aashirvaad Atta 5kg"
                placeholderTextColor="#9ca3af"
                value={quickName}
                onChangeText={setQuickName}
              />

              <Text style={styles.qaLabel}>Category</Text>
              <TextInput
                style={styles.quickAddInput}
                placeholder="e.g. Grocery"
                placeholderTextColor="#9ca3af"
                value={quickCategory}
                onChangeText={setQuickCategory}
              />

              <View style={styles.quickAddRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qaLabel}>Selling Price (₹) *</Text>
                  <TextInput
                    style={styles.quickAddInput}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={quickPrice}
                    onChangeText={setQuickPrice}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qaLabel}>Purchase Price (₹)</Text>
                  <TextInput
                    style={styles.quickAddInput}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={quickCostPrice}
                    onChangeText={setQuickCostPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.quickAddRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qaLabel}>Unit *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.qaUnitRow}>
                    {quickUnits.map(u => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.qaUnitChip, quickUnit === u && styles.qaUnitChipActive]}
                        onPress={() => setQuickUnit(u)}
                      >
                        <Text style={[styles.qaUnitText, quickUnit === u && styles.qaUnitTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ width: 100 }}>
                  <Text style={styles.qaLabel}>Total Stock</Text>
                  <TextInput
                    style={styles.quickAddInput}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    value={quickStock}
                    onChangeText={setQuickStock}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.qaLabel}>Low Stock Alert At</Text>
              <TextInput
                style={styles.quickAddInput}
                placeholder="e.g. 5"
                placeholderTextColor="#9ca3af"
                value={quickLowStock}
                onChangeText={setQuickLowStock}
                keyboardType="numeric"
              />

              <View style={styles.quickAddActions}>
                <TouchableOpacity style={styles.quickAddCancel} onPress={() => { setShowQuickAdd(false); setQuickName(''); setQuickPrice(''); setQuickCostPrice(''); setQuickUnit('pc'); setQuickCategory(''); setQuickStock(''); setQuickLowStock(''); }}>
                  <Text style={styles.quickAddCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickAddSubmit, (!quickName.trim() || !quickPrice.trim() || quickSaving) && { opacity: 0.5 }]}
                  onPress={handleQuickAdd}
                  disabled={!quickName.trim() || !quickPrice.trim() || quickSaving}
                >
                  {quickSaving ? (
                    <Loader size={16} color="#fff" />
                  ) : (
                    <Text style={styles.quickAddSubmitText}>Save & Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.quickAddToggle} onPress={() => setShowQuickAdd(!showQuickAdd)}>
            <Ionicons name={showQuickAdd ? 'close-outline' : 'add-circle-outline'} size={20} color="#0891b2" />
            <Text style={styles.quickAddToggleText}>{showQuickAdd ? 'Cancel' : 'New Product'}</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.bottomLeft}>
            <Text style={styles.bottomLabel}>Items</Text>
            <Text style={styles.bottomCount}>{items.length}</Text>
            <View style={styles.bottomDivider} />
            <Text style={styles.bottomTotal}>₹{grandTotal}</Text>
          </View>
          <TouchableOpacity
            style={[styles.reviewBtn, items.length === 0 && { opacity: 0.4 }]}
            onPress={() => items.length > 0 && (router as any).push('/bill/review')}
            disabled={items.length === 0}
            activeOpacity={0.9}
          >
            <Text style={styles.reviewBtnText}>Review Bill</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Quantity Selection Modal */}
        <Modal
          visible={modalProduct !== null}
          transparent
          animationType="fade"
          onRequestClose={closeQtyModal}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeQtyModal}
          >
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={() => {}}
            >
              {modalProduct && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalIcon}>
                      <Ionicons name="cube-outline" size={28} color="#0891b2" />
                    </View>
                    <Text style={styles.modalTitle}>{modalProduct.name}</Text>
                    <Text style={styles.modalPrice}>
                      ₹{modalProduct.price} / {displayUnit(modalProduct.unit)}
                    </Text>
                  </View>

                  <View style={styles.modalQtySection}>
                    <Text style={styles.modalQtyLabel}>Quantity</Text>
                    <View style={styles.modalQtyControl}>
                      <TouchableOpacity
                        style={styles.modalQtyBtn}
                        onPress={() => handleModalQtyDelta(-1)}
                      >
                        <Ionicons name="remove" size={22} color="#6b7280" />
                      </TouchableOpacity>

                      {modalEditing ? (
                        <TextInput
                          style={styles.modalQtyInput}
                          value={modalQtyInput}
                          onChangeText={(text) => {
                            if (isIntegerUnit(modalProduct?.unit)) {
                              setModalQtyInput(text.replace(/[^0-9]/g, ''));
                            } else {
                              setModalQtyInput(text);
                            }
                          }}
                          keyboardType={isIntegerUnit(modalProduct?.unit) ? 'number-pad' : 'decimal-pad'}
                          autoFocus
                          onBlur={() => {
                            const num = parseFloat(modalQtyInput);
                            if (!isNaN(num) && num > 0) {
                              const final = isIntegerUnit(modalProduct?.unit) ? Math.round(num) : num;
                              setModalQty(final);
                            }
                            setModalEditing(false);
                          }}
                          onSubmitEditing={() => {
                            const num = parseFloat(modalQtyInput);
                            if (!isNaN(num) && num > 0) {
                              const final = isIntegerUnit(modalProduct?.unit) ? Math.round(num) : num;
                              setModalQty(final);
                            }
                            setModalEditing(false);
                          }}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setModalQtyInput(String(modalQty));
                            setModalEditing(true);
                          }}
                        >
                          <View style={styles.modalQtyValueWrap}>
                            <Text style={styles.modalQtyValue}>{isIntegerUnit(modalProduct?.unit) ? modalQty : Number(modalQty).toFixed(1)}</Text>
                            <Text style={styles.modalQtyUnit}>{displayUnit(modalProduct.unit)}</Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.modalQtyBtn}
                        onPress={() => handleModalQtyDelta(1)}
                      >
                        <Ionicons name="add" size={22} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.modalGstSection}>
                    <Text style={styles.modalGstLabel}>GST Rate (optional)</Text>
                    <View style={styles.modalGstRow}>
                      {GST_RATES.map(rate => (
                        <TouchableOpacity
                          key={rate}
                          style={[
                            styles.modalGstChip,
                            modalGstRate === rate && styles.modalGstChipActive,
                          ]}
                          onPress={() => setModalGstRate(rate)}
                        >
                          <Text style={[
                            styles.modalGstChipText,
                            modalGstRate === rate && styles.modalGstChipTextActive,
                          ]}>
                            {rate}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {modalGstRate > 0 && (
                      <Text style={styles.modalGstInfo}>
                        GST ₹{((modalProduct.price * modalQty) * modalGstRate / 100).toFixed(2)} (CGST ₹{((modalProduct.price * modalQty) * modalGstRate / 200).toFixed(2)} + SGST ₹{((modalProduct.price * modalQty) * modalGstRate / 200).toFixed(2)})
                      </Text>
                    )}
                  </View>

                  <View style={[styles.modalTotal, modalGstRate > 0 && { backgroundColor: '#fef3c7' }]}>
                    <Text style={styles.modalTotalLabel}>Line Total</Text>
                    <Text style={styles.modalTotalValue}>
                      ₹{(modalProduct.price * modalQty * (1 + modalGstRate / 100)).toFixed(2)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={confirmQty}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.modalConfirmText}>
                      {items.some(i => i.product_uuid === modalProduct.id)
                        ? 'Update Quantity'
                        : 'Add to Bill'
                      }
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={closeQtyModal}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, height: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eef1f4', gap: 4,
  },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#1c1c1e' },
  topSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, gap: 8,
    borderWidth: 1, borderColor: '#eef1f4',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1c1c1e' },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingTop: 8, paddingBottom: 120, gap: 10 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4,
  },
  addedSection: { gap: 8 },
  addedCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: '#0891b2',
    shadowColor: '#0891b2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addedIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center',
  },
  addedName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  addedRate: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  addedLineTotal: { fontSize: 16, fontWeight: '700', color: '#0891b2' },
  addedQtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  divider: { height: 1, backgroundColor: '#eef1f4', marginVertical: 6 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  productCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  productCardSelected: { borderWidth: 2, borderColor: '#16a34a' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center',
  },
  productIconSelected: { backgroundColor: '#16a34a' },
  productName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  productMeta: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    backgroundColor: '#f3f4f6', borderRadius: 12, padding: 3,
  },
  qtyBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10,
  },
  qtyAddBtn: { backgroundColor: '#0891b2' },
  qtyValueWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, minWidth: 44, justifyContent: 'center',
  },
  qtyValue: { fontSize: 16, fontWeight: '700', color: '#1c1c1e', textAlign: 'center' },
  qtyUnit: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  deleteBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: '#fef2f2',
  },
  quickAddCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  quickAddTitle: { fontSize: 16, fontWeight: '700', color: '#1c1c1e' },
  quickAddSubtitle: { fontSize: 13, color: '#6b7280', marginTop: -4, marginBottom: 4 },
  qaLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 2, marginTop: 4 },
  quickAddInput: {
    height: 46, backgroundColor: '#f8f9fa', borderRadius: 10,
    borderWidth: 1, borderColor: '#eef1f4', paddingHorizontal: 12,
    fontSize: 14, color: '#1c1c1e',
  },
  quickAddRow: { flexDirection: 'row', gap: 10 },
  qaUnitRow: { flexDirection: 'row', paddingVertical: 4, marginBottom: 4 },
  qaUnitChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#eef1f4',
    marginRight: 6,
  },
  qaUnitChipActive: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
  qaUnitText: { fontSize: 12, color: '#6b7280' },
  qaUnitTextActive: { color: '#fff', fontWeight: '600' },
  quickAddActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  quickAddCancel: {
    flex: 1, height: 46, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: '#eef1f4',
  },
  quickAddCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  quickAddSubmit: {
    flex: 1, height: 46, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: '#0891b2',
  },
  quickAddSubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  quickAddToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db',
  },
  quickAddToggleText: { fontSize: 15, fontWeight: '600', color: '#0891b2' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eef1f4',
    paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 24,
    gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 4,
  },
  bottomLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottomLabel: { fontSize: 13, color: '#6b7280' },
  bottomCount: { fontSize: 14, fontWeight: '700', color: '#1c1c1e' },
  bottomDivider: { width: 1, height: 16, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  bottomTotal: { fontSize: 15, fontWeight: '700', color: '#0891b2', flex: 1, textAlign: 'right' },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 14, backgroundColor: '#0891b2',
  },
  reviewBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%', maxWidth: 380,
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  modalHeader: { alignItems: 'center', gap: 8, marginBottom: 20 },
  modalIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', textAlign: 'center' },
  modalPrice: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  modalQtySection: { marginBottom: 16 },
  modalQtyLabel: {
    fontSize: 13, fontWeight: '600', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  modalQtyControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0,
    backgroundColor: '#f3f4f6', borderRadius: 16, padding: 6,
  },
  modalQtyBtn: {
    width: 52, height: 52, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: '#0891b2',
  },
  modalQtyValueWrap: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    paddingHorizontal: 20, minWidth: 100, justifyContent: 'center',
  },
  modalQtyValue: { fontSize: 28, fontWeight: '800', color: '#1c1c1e' },
  modalQtyUnit: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  modalQtyInput: {
    width: 120, height: 52, textAlign: 'center',
    fontSize: 28, fontWeight: '800', color: '#1c1c1e',
    paddingHorizontal: 12,
  },
  modalGstSection: { marginBottom: 16 },
  modalGstLabel: {
    fontSize: 13, fontWeight: '600', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  modalGstRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalGstChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  modalGstChipActive: { backgroundColor: '#0891b2', borderColor: '#0891b2' },
  modalGstChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  modalGstChipTextActive: { color: '#fff' },
  modalGstInfo: { fontSize: 12, color: '#6b7280', marginTop: 6, textAlign: 'center' },
  modalTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f0f9ff', borderRadius: 12, padding: 14, marginBottom: 16,
  },
  modalTotalLabel: { fontSize: 15, fontWeight: '600', color: '#0891b2' },
  modalTotalValue: { fontSize: 22, fontWeight: '800', color: '#0891b2' },
  modalConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 14, backgroundColor: '#0891b2', marginBottom: 10,
  },
  modalConfirmText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalCancelBtn: {
    height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#9ca3af' },
});
