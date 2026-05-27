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
import { useTranslation } from 'react-i18next';

function formatPaymentMethod(t: any, method: string): string {
  const map: Record<string, string> = {
    cash: t('paymentMethods.cash'),
    upi: t('paymentMethods.upi'),
    card: t('paymentMethods.card'),
    credit: t('paymentMethods.credit'),
    mix: t('paymentMethods.mix'),
  };
  return map[method] || method;
}

function formatStatus(t: any, status: string): string {
  const map: Record<string, string> = {
    paid: t('bill.statusPaid'),
    partial: t('bill.statusPartial'),
    pending: t('bill.statusPending'),
    cancelled: t('bill.statusCancelled'),
  };
  return map[status] || status;
}

export default function BillSuccessScreen() {
  const { t } = useTranslation();
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

  const paymentMethod = bill ? formatPaymentMethod(t, bill.payment_method) : t('paymentMethods.cash');
  const paymentStatus = bill ? formatStatus(t, bill.payment_status) : t('bill.statusPending');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Animated.View style={[styles.successIcon, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark-circle" size={52} color={Tokens.secondary} />
        </Animated.View>
        <Text style={styles.title}>{t('bill.billGenerated')}</Text>
        <Text style={styles.subtitle}>{t('bill.billCreated', { number: bill?.bill_number || '' })}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryLabel}>{t('bill.billNumber')}</Text>
              <Text style={styles.summaryBillNo}>{bill?.bill_number || 'N/A'}</Text>
            </View>
            <View style={[styles.statusBadge, bill?.payment_status === 'paid' ? styles.statusPaid : styles.statusPending]}>
              <Text style={[styles.statusText, bill?.payment_status === 'paid' ? { color: Tokens['on-secondary-fixed'] } : { color: Tokens.tertiary }]}>{paymentStatus}</Text>
            </View>
          </View>

          <View style={styles.summaryMeta}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('bill.dateLabel')}</Text>
              <Text style={styles.metaValue}>
                {bill?.created_at
                  ? new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('bill.customerLabel')}</Text>
              <Text style={styles.metaValue}>{bill?.customer?.name || t('bill.walkInCustomer')}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('bill.paymentLabel')}</Text>
              <Text style={styles.metaValue}>{paymentMethod}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.paymentBreakdown}>
            <View style={styles.pbRow}>
              <Text style={styles.pbLabel}>{t('bill.totalAmount')}</Text>
              <Text style={styles.pbValue}>₹{bill?.total || 0}</Text>
            </View>
            <View style={styles.pbRow}>
              <Text style={[styles.pbLabel, { color: Tokens.secondary }]}>{t('bill.paid')}</Text>
              <Text style={[styles.pbValue, { color: Tokens.secondary }]}>₹{bill?.paid_amount || 0}</Text>
            </View>
            {(bill?.due_amount ?? 0) > 0 && (
              <View style={styles.pbRow}>
                <Text style={[styles.pbLabel, { color: Tokens.tertiary }]}>{t('bill.dueUdhaar')}</Text>
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
              {sharing ? t('bill.generatingPdf') : t('bill.shareInvoice')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.homeLink} onPress={handleHome} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={Tokens.secondary} />
          <Text style={styles.homeLinkText}>{t('bill.backToHome')}</Text>
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
