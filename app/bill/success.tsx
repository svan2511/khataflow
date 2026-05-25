import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { File, Directory, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api, type BillDetail } from '@/lib/api';
import { shareInvoicePdf, shareOnWhatsApp } from '@/lib/bill-pdf';
import Loader from '@/components/Loader';

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    credit: 'Credit (Udhaar)',
    mix: 'Split Payment',
  };
  return map[method] || method;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    paid: 'Paid',
    partial: 'Partial',
    pending: 'Pending',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

export default function BillSuccessScreen() {
  const { bill: billJson } = useLocalSearchParams<{ bill: string }>();
  const bill: BillDetail | null = billJson ? JSON.parse(billJson) : null;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const [sharing, setSharing] = useState(false);
  const [shopName, setShopName] = useState('KhataFlow');
  const [shopLogoBase64, setShopLogoBase64] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
    if (token) {
      api.getProfile(token).then(async res => {
        if (res.data.shop) {
          const s = res.data.shop;
          if (s.shop_name) setShopName(s.shop_name);
          if (s.logo) {
            try {
              const destDir = new Directory(Paths.cache, 'success-shop-logos');
              destDir.create({ intermediates: true, idempotent: true });
              const destFile = new File(destDir, `logo-${Date.now()}.png`);
              const file = await File.downloadFileAsync(s.logo, destFile);
              const b64 = await file.base64();
              setShopLogoBase64('data:image/png;base64,' + b64);
            } catch (e) { console.error('Failed to load shop logo', e); }
          }
          const addr = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ');
          setShopAddress(addr);
        }
      }).catch(() => {});
    }
  }, []);

  const handleHome = () => {
    (router as any).replace('/');
  };

  const handleShare = async () => {
    if (!bill) return;
    setSharing(true);
    try {
      if (bill.customer?.phone) {
        await shareOnWhatsApp(bill, shopName, shopLogoBase64 || undefined, shopAddress || undefined);
      } else {
        await shareInvoicePdf(bill, shopName, shopLogoBase64 || undefined, shopAddress || undefined);
      }
    } catch {
      await shareInvoicePdf(bill, shopName, shopLogoBase64 || undefined, shopAddress || undefined).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  const paymentMethod = bill ? formatPaymentMethod(bill.payment_method) : 'Cash';
  const paymentStatus = bill ? formatStatus(bill.payment_status) : 'Pending';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Animated.View style={[styles.successIcon, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark-circle" size={52} color={Tokens.secondary} />
        </Animated.View>
        <Text style={styles.title}>Bill Generated!</Text>
        <Text style={styles.subtitle}>Bill {bill?.bill_number || ''} has been created successfully</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryLabel}>Bill Number</Text>
              <Text style={styles.summaryBillNo}>{bill?.bill_number || 'N/A'}</Text>
            </View>
            <View style={[styles.statusBadge, bill?.payment_status === 'paid' ? styles.statusPaid : styles.statusPending]}>
              <Text style={[styles.statusText, bill?.payment_status === 'paid' ? { color: Tokens['on-secondary-fixed'] } : { color: Tokens.tertiary }]}>{paymentStatus}</Text>
            </View>
          </View>

          <View style={styles.summaryMeta}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>
                {bill?.created_at
                  ? new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Customer</Text>
              <Text style={styles.metaValue}>{bill?.customer?.name || 'Walk-in Customer'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment</Text>
              <Text style={styles.metaValue}>{paymentMethod}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.paymentBreakdown}>
            <View style={styles.pbRow}>
              <Text style={styles.pbLabel}>Total Amount</Text>
              <Text style={styles.pbValue}>₹{bill?.total || 0}</Text>
            </View>
            <View style={styles.pbRow}>
              <Text style={[styles.pbLabel, { color: Tokens.secondary }]}>Paid</Text>
              <Text style={[styles.pbValue, { color: Tokens.secondary }]}>₹{bill?.paid_amount || 0}</Text>
            </View>
            {(bill?.due_amount ?? 0) > 0 && (
              <View style={styles.pbRow}>
                <Text style={[styles.pbLabel, { color: Tokens.tertiary }]}>Due (Udhaar)</Text>
                <Text style={[styles.pbValue, { color: Tokens.tertiary }]}>₹{bill?.due_amount || 0}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
            activeOpacity={0.9}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <Loader size={20} color="#fff" />
            ) : (
              <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            )}
            <Text style={styles.shareBtnText}>
              {sharing ? 'Generating PDF...' : 'Share Invoice'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.homeLink} onPress={handleHome} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={Tokens.secondary} />
          <Text style={styles.homeLinkText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Tokens.background },
  container: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xl },
  successIcon: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: Tokens['secondary-fixed'],
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  title: { fontSize: Typography['headline-lg-mobile'].fontSize, fontWeight: Typography['headline-lg-mobile'].fontWeight as any, color: Tokens['on-surface'], textAlign: 'center' },
  subtitle: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface-variant'], textAlign: 'center', marginTop: 4 },
  summaryCard: {
    width: '100%', backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, marginTop: Spacing.md, shadowColor: Tokens['surface-tint'],
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
  },
  summaryLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  summaryBillNo: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusPaid: { backgroundColor: Tokens['secondary-fixed'] },
  statusPending: { backgroundColor: Tokens['tertiary-fixed'] },
  statusText: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any },
  summaryMeta: { paddingVertical: Spacing.sm, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'] },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  metaValue: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'] },
  summaryTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  totalLabel: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  totalValue: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens.secondary },
  summaryDivider: { height: 1, backgroundColor: Tokens['outline-variant'], marginVertical: Spacing.sm },
  paymentBreakdown: { gap: Spacing.sm },
  pbRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pbLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  pbValue: { fontSize: Typography['body-lg'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  actionsSection: { width: '100%', marginTop: Spacing.md, gap: Spacing.sm },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 56, backgroundColor: '#25D366', borderRadius: BorderRadius.xl,
    shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  shareBtnDisabled: { opacity: 0.7 },
  shareBtnText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: '#fff' },
  homeLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: Spacing.lg, paddingVertical: 8, paddingHorizontal: 20,
  },
  homeLinkText: { fontSize: Typography['body-md'].fontSize, fontWeight: '600', color: Tokens.secondary },
});
