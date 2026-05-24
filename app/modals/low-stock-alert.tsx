import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api, ProductData } from '@/lib/api';

export default function LowStockAlertModal() {
  const { token } = useAuth();
  const [lowStockItems, setLowStockItems] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchLowStock();
  }, [token]);

  const fetchLowStock = async () => {
    if (!token) return;
    try {
      const res = await api.listProducts(token, { low_stock: true, per_page: 50 });
      setLowStockItems(res.data);
    } catch (e: any) {
      console.error('Failed to fetch low stock items', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.warningIcon}>
              <Ionicons name="warning" size={22} color={Tokens['on-error-container']} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Low Stock Alert</Text>
              <Text style={styles.headerSub}>
                {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} require{lowStockItems.length === 1 ? 's' : ''} attention.
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
        </View>

        {/* Content List */}
        {loading ? (
          <ActivityIndicator size="large" color={Tokens.secondary} style={{ margin: 40 }} />
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {lowStockItems.length === 0 ? (
              <Text style={styles.emptyText}>All products are well-stocked!</Text>
            ) : (
              lowStockItems.map((item, i) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={styles.itemLeft}>
                    <View style={styles.itemThumb}>
                      {item.image ? (
                        <View style={styles.thumbPlaceholder} />
                      ) : (
                        <View style={styles.thumbPlaceholder} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemMeta}>
                        {item.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
                        <Text style={styles.itemRemaining}>
                          <Ionicons name="arrow-down" size={12} color={Tokens.error} />
                          {' '}Only {Number(item.stock_quantity)} {item.unit} left
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, Number(item.stock_quantity) <= 0 ? styles.urgentBtn : styles.stockBtn]}
                    onPress={() => { router.back(); setTimeout(() => (router as any).push('/inventory/stock-in'), 300); }}
                  >
                    <Ionicons
                      name={Number(item.stock_quantity) <= 0 ? 'basket-outline' : 'add-circle-outline'}
                      size={18}
                      color={Number(item.stock_quantity) <= 0 ? Tokens['on-error'] : Tokens['on-primary']}
                    />
                    <Text style={[styles.actionText, Number(item.stock_quantity) <= 0 && { color: Tokens['on-error'] }]}>
                      {Number(item.stock_quantity) <= 0 ? 'Urgent Order' : 'Stock In'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.dismissBtn} onPress={() => router.back()}>
            <Text style={styles.dismissText}>Dismiss Alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inventoryBtn} onPress={() => (router as any).replace('/inventory')}>
            <Ionicons name="cube-outline" size={18} color={Tokens['on-primary']} />
            <Text style={styles.inventoryBtnText}>View Full Inventory</Text>
          </TouchableOpacity>
        </View>
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
    width: '100%', maxWidth: 560, maxHeight: 795,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: 16,
    overflow: 'hidden', flexDirection: 'column',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
    backgroundColor: 'rgba(255,218,214,0.2)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  warningIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Tokens['error-container'], alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend-SemiBold' },
  headerSub: { fontSize: 14, color: Tokens['on-surface-variant'] },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  list: { flex: 1, padding: Spacing.md },
  emptyText: { textAlign: 'center', color: Tokens['on-surface-variant'], marginTop: 40, fontSize: 16 },
  listItem: {
    flexDirection: 'column', padding: Spacing.md, backgroundColor: Tokens.surface,
    borderWidth: 1, borderColor: Tokens['outline-variant'], borderRadius: 12,
    gap: 12, marginBottom: 12,
  },
  itemLeft: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  itemThumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: Tokens['surface-container-high'], overflow: 'hidden' },
  thumbPlaceholder: { width: '100%', height: '100%', backgroundColor: Tokens['surface-container-high'] },
  itemName: { fontSize: 15, fontWeight: '600', color: Tokens['on-surface'], flex: 1 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  itemSku: { fontSize: 13, color: Tokens['on-surface-variant'] },
  itemRemaining: { fontSize: 13, fontWeight: '500', color: Tokens.error, flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    height: 48, paddingHorizontal: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
  },
  stockBtn: { backgroundColor: Tokens.secondary },
  urgentBtn: { backgroundColor: Tokens.error },
  actionText: { fontSize: 14, fontWeight: '600', color: Tokens['on-primary'] },
  footer: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 12,
    padding: Spacing.md, borderTopWidth: 1, borderTopColor: Tokens['outline-variant'],
    backgroundColor: Tokens.surface,
  },
  dismissBtn: { height: 48, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 14, fontWeight: '600', color: Tokens.secondary },
  inventoryBtn: {
    height: 48, paddingHorizontal: 16, borderRadius: 8,
    backgroundColor: Tokens['surface-tint'], flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  inventoryBtnText: { fontSize: 14, fontWeight: '600', color: Tokens['on-primary'] },
});
