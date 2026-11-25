import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, Image, Alert, Linking, Animated, Easing
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useBill } from '@/lib/bill-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast-provider';
import { api } from '@/lib/api';
import Loader from '@/components/Loader';
import { useTranslation } from 'react-i18next';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { getCurrentLanguage } from '@/lib/i18n';
import { parseBillLocally } from '@/lib/voice-parser';

export default function BillReviewScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const {
    items, customer, paymentMode, discount, notes,
    subtotal, discountAmount, taxAmount, grandTotal,
    setPaymentMode, resetBill, addItem, setCustomer, setDiscount, setNotes, updateItemQuantity,
  } = useBill();

  const PAYMENT_MODES = [
    { key: 'Cash', icon: 'cash', label: t('paymentMethods.cash') },
    { key: 'UPI', icon: 'phone-portrait', label: t('paymentMethods.upi') },
    { key: 'Card', icon: 'card', label: t('paymentMethods.card') },
    { key: 'Udhaar', icon: 'book', label: t('paymentMethods.udhaar') },
  ] as const;
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const [error, setError] = useState('');
  const [shopName, setShopName] = useState('KhataFlow');
  const [shopLogo, setShopLogo] = useState<string | null>(null);

  const [paidAmount, setPaidAmount] = useState(grandTotal);
  const [paidInput, setPaidInput] = useState(String(grandTotal));

  useEffect(() => {
    const next = paymentMode === 'Udhaar' ? 0 : grandTotal;
    setPaidAmount(next);
    setPaidInput(String(next));
  }, [paymentMode, grandTotal]);

  useEffect(() => {
    if (token) {
      api.getProfile(token).then(res => {
        if (res.data.shop?.shop_name) setShopName(res.data.shop.shop_name);
        if (res.data.shop?.logo) setShopLogo(res.data.shop.logo);
      }).catch(() => {});
    }
  }, [token]);

  // Voice recognition state for "Add More Items"
  const [voiceLanguage, setVoiceLanguage] = useState<'hi' | 'en'>(() => (getCurrentLanguage() === 'en' ? 'en' : 'hi'));
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceParsing, setVoiceParsing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const voiceTranscriptRef = useRef('');
  const voiceInterimRef = useRef('');
  const voiceAutoParseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceParsingRef = useRef(false);
  const voiceSpeechErrorRef = useRef(false);
  const voiceMountedRef = useRef(true);
  const voicePauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicePauseDetectedRef = useRef(false);

  const voicePulseAnim = useRef(new Animated.Value(0)).current;
  const voiceFadeAnim = useRef(new Animated.Value(0)).current;

  const updateVoiceTranscript = useCallback((value: string) => {
    voiceTranscriptRef.current = value;
    setVoiceTranscript(value);
  }, []);

  const updateVoiceInterim = useCallback((value: string) => {
    voiceInterimRef.current = value;
    setVoiceInterim(value);
  }, []);

  const startVoicePulseAnimation = useCallback(() => {
    voicePulseAnim.setValue(0);
    Animated.timing(voicePulseAnim, {
      toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    }).start(() => { if (voiceListening) startVoicePulseAnimation(); });
  }, [voiceListening]);

  useSpeechRecognitionEvent('start', () => {
    voiceSpeechErrorRef.current = false;
    voicePauseDetectedRef.current = false;
    setVoiceListening(true);
    startVoicePulseAnimation();
  });

  useSpeechRecognitionEvent('end', () => {
    setVoiceListening(false);
    voicePulseAnim.stopAnimation();
    if (voiceInterimRef.current) {
      const pending = voiceInterimRef.current;
      updateVoiceInterim('');
      if (!voiceTranscriptRef.current) updateVoiceTranscript(pending);
    }
    if (!voiceMountedRef.current || voiceSpeechErrorRef.current) return;
    if (voiceAutoParseTimer.current) clearTimeout(voiceAutoParseTimer.current);
    if (voicePauseTimer.current) clearTimeout(voicePauseTimer.current);
    voicePauseDetectedRef.current = true;
    voicePauseTimer.current = setTimeout(() => {
      if (!voiceMountedRef.current || voiceSpeechErrorRef.current) return;
      const text = voiceTranscriptRef.current.trim();
      if (text.length >= 2) void parseVoiceText(text);
    }, 3000);
  });

  useSpeechRecognitionEvent('result', event => {
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (!text) return;
    if (event.isFinal) {
      updateVoiceInterim('');
      updateVoiceTranscript(voiceTranscriptRef.current ? `${voiceTranscriptRef.current} ${text}`.trim() : text);
      if (voicePauseTimer.current) clearTimeout(voicePauseTimer.current);
      voicePauseDetectedRef.current = false;
    } else {
      updateVoiceInterim(text);
    }
  });

  useSpeechRecognitionEvent('error', event => {
    voiceSpeechErrorRef.current = true;
    setVoiceListening(false);
    updateVoiceInterim('');
    if (voicePauseTimer.current) clearTimeout(voicePauseTimer.current);
    const code = event.error;
    if (code === 'aborted') return;
    if (code === 'no-speech' || code === 'speech-timeout') setVoiceError(t('voice.noSpeech'));
    else if (code === 'not-allowed' || code === 'service-not-allowed') setVoiceError(t('voice.micPermissionMessage'));
    else if (code === 'network') setVoiceError(t('voice.speechNetworkError'));
    else if (code === 'language-not-supported') setVoiceError(t('voice.languageNotSupported'));
    else setVoiceError(t('voice.recognitionFailed'));
  });

  useEffect(() => {
    voiceMountedRef.current = true;
    return () => {
      voiceMountedRef.current = false;
      if (voiceAutoParseTimer.current) clearTimeout(voiceAutoParseTimer.current);
      if (voicePauseTimer.current) clearTimeout(voicePauseTimer.current);
      voicePulseAnim.stopAnimation();
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
    };
  }, []);

  const toggleVoiceListening = async () => {
    if (voiceListening) {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
      setVoiceListening(false);
      return;
    }
    setVoiceError('');
    updateVoiceInterim('');
    if (voiceAutoParseTimer.current) clearTimeout(voiceAutoParseTimer.current);
    if (voicePauseTimer.current) clearTimeout(voicePauseTimer.current);
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('voice.micPermissionTitle'), t('voice.micPermissionMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.settings'), onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: voiceLanguage === 'hi' ? 'hi-IN' : 'en-IN',
        interimResults: true, continuous: false, maxAlternatives: 1, addsPunctuation: true,
        contextualStrings: ['chai', 'tea', 'paratha', 'prantha', 'roti', 'lassi', 'raita', 'momos', 'atta', 'doodh', 'chawal', 'dal', 'cheeni', 'udhaar', 'UPI', 'cash'],
      });
      setVoiceListening(true);
    } catch { setVoiceError(t('voice.recognitionFailed')); }
  };

  const parseVoiceText = async (rawText: string) => {
    const text = rawText.trim();
    if (text.length < 2) { setVoiceError(t('voice.speakFirst')); voicePauseDetectedRef.current = false; return; }
    if (!token || voiceParsingRef.current) return;
    if (voiceAutoParseTimer.current) clearTimeout(voiceAutoParseTimer.current);
    if (voicePauseTimer.current) clearTimeout(voicePauseTimer.current);
    voiceParsingRef.current = true;
    setVoiceParsing(true);
    setVoiceError('');

    try {
      const res = await api.parseVoiceBill(token, text, voiceLanguage);
      if (!voiceMountedRef.current) return;
      if (!res.data.items.length) { setVoiceError(t('voice.notUnderstood')); return; }
      mergeVoiceResult(res.data);
    } catch (e) {
      try {
        const [productsRes, customersRes] = await Promise.all([
          api.searchProducts(token, undefined, 200),
          api.searchCustomers(token, undefined, 100),
        ]);
        if (!voiceMountedRef.current) return;
        const local = parseBillLocally(text, voiceLanguage, productsRes.data, customersRes.data);
        if (local.items.length) mergeVoiceResult(local);
        else setVoiceError('Voice parsing failed. Please try again.');
      } catch { if (voiceMountedRef.current) setVoiceError('Voice parsing failed. Please try again.'); }
    } finally {
      voiceParsingRef.current = false;
      setVoiceParsing(false);
      voicePauseDetectedRef.current = false;
    }
  };

  const mergeVoiceResult = (data: any) => {
    data.items.forEach((item: any, index: number) => {
      const productUuid = item.product_uuid;
      const itemName = item.name?.toLowerCase().trim();
      
      let existingIndex = -1;
      if (productUuid) {
        existingIndex = items.findIndex(i => i.product_uuid === productUuid);
      }
      if (existingIndex === -1 && itemName) {
        existingIndex = items.findIndex(i => i.name.toLowerCase().trim() === itemName);
      }
      
      const newQuantity = Number(item.quantity || 1);
      const newRate = Number(item.price) || 0;
      const newUnit = item.unit || 'piece';
      const newGstRate = Number(item.gst_rate) || 0;
      
      if (existingIndex >= 0) {
        const currentItem = items[existingIndex];
        const updatedQuantity = Number(currentItem.quantity) + newQuantity;
        updateItemQuantity(currentItem.id, updatedQuantity);
      } else {
        const itemId = productUuid ?? `voice-${Date.now()}-${index}`;
        addItem({
          id: itemId,
          product_uuid: productUuid ?? undefined,
          name: item.name,
          rate: newRate,
          quantity: newQuantity,
          unit: newUnit,
          gstRate: newGstRate,
        });
      }
    });

    if (data.customer && !customer?.uuid) {
      setCustomer({ uuid: data.customer.uuid, name: data.customer.name, phone: data.customer.phone ?? undefined });
    }

    const modeMap: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Udhaar', mix: 'Cash' };
    if (data.payment_method && modeMap[data.payment_method]) setPaymentMode(modeMap[data.payment_method]);
    if (data.discount) setDiscount({ type: data.discount.type, value: data.discount.value });
    if (data.notes) setNotes(data.notes);

    updateVoiceTranscript('');
    updateVoiceInterim('');
    showToast({ type: 'success', title: t('voice.addedItems'), message: `${data.items.length} ${t('voice.itemAdded')}` });
  };

  const dueAmount = Math.max(0, grandTotal - paidAmount);

  const confirmPaidInput = () => {
    const trimmed = paidInput.replace(/[^0-9.]/g, '');
    if (!trimmed || trimmed === '.') { setPaidAmount(0); setPaidInput('0'); return; }
    const num = parseFloat(trimmed);
    if (isNaN(num) || num <= 0) { setPaidAmount(0); setPaidInput('0'); }
    else if (num > grandTotal) { setPaidAmount(grandTotal); setPaidInput(String(grandTotal)); }
    else { setPaidAmount(num); setPaidInput(trimmed); }
  };

  const handleConfirm = async () => {
    if (!token) return;
    if (dueAmount > 0 && !customer?.uuid) {
      showToast({ type: 'error', title: t('bill.customerRequired'), message: t('bill.customerRequiredForUdhaar', { amount: dueAmount.toFixed(2) }) });
      return;
    }
    setSubmitting(true); setError('');
    try {
      const isCredit = paymentMode === 'Udhaar';
      const payload: any = {
        items: items.map(item => ({ ...(item.product_uuid ? { product_uuid: item.product_uuid } : { product_name: item.name, unit_price: item.rate }), quantity: item.quantity, ...(item.gstRate ? { gst_rate: item.gstRate } : {}) })),
        payment_method: isCredit ? 'credit' : paymentMode.toLowerCase(), paid_amount: paidAmount, notes: notes || undefined,
      };
      if (customer?.uuid) payload.customer_uuid = customer.uuid;
      if (discount) { payload.discount_type = discount.type; payload.discount_value = discount.value; }
      const res = await api.createBill(token, payload);
      resetBill();
      (router as any).replace({ pathname: '/bill/success', params: { bill: JSON.stringify(res.data) } });
    } catch (e: any) { setError(e.message || t('bill.failedToCreateBill')); }
    finally { setSubmitting(false); }
  };

  const micScale = voicePulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] });
  const micOpacity = voicePulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Animated.View style={[styles.topBar, { borderBottomColor: Tokens['outline-variant'] }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('bill.reviewBill')}</Text>
        <View style={styles.topBarActions}>
          <Animated.View style={[{ transform: [{ scale: micScale }] }]}>
            <TouchableOpacity
              style={[styles.iconButton, styles.micButtonTop, voiceListening && styles.iconButtonActive]}
              onPress={toggleVoiceListening}
              disabled={voiceParsing}
              activeOpacity={0.85}
              accessibilityLabel={voiceListening ? t('voice.tapToStop') : t('voice.addMoreItems')}
            >
              <Ionicons name={voiceListening ? 'stop' : 'mic'} size={24} color={voiceListening ? '#dc2626' : Tokens['on-surface-variant']} />
            </TouchableOpacity>
            {voiceListening && <Animated.View style={[styles.pulseRingTop, { opacity: micOpacity }]} />}
          </Animated.View>
        </View>
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}>
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {voiceListening || voiceInterim ? (
            <Animated.View style={[styles.voiceListeningBar, { opacity: voiceFadeAnim }]}>
              <Ionicons name="mic" size={16} color={Tokens.secondary} />
              <Text style={styles.voiceListeningText}>{voiceInterim || voiceTranscript || t('voice.listening')}</Text>
              {voiceParsing && <Loader size={14} color={Tokens.secondary} />}
            </Animated.View>
          ) : null}
          {voiceError ? (
            <View style={styles.voiceErrorBar}>
              <Ionicons name="alert-circle" size={16} color={Tokens.tertiary} />
              <Text style={styles.voiceErrorText}>{voiceError}</Text>
            </View>
          ) : null}
          {voicePauseDetectedRef.current && !voiceParsing && (
            <View style={styles.pauseIndicatorBar}>
              <Loader size={14} color={Tokens.secondary} />
              <Text style={styles.pauseIndicatorText}>{t('voice.waitingForMore')}</Text>
            </View>
          )}

          <View style={styles.billCard}>
            <View style={styles.billHeader}>
              <View style={styles.billLogo}>
                {shopLogo ? <Image source={{ uri: shopLogo }} style={{ width: 40, height: 40, borderRadius: 12 }} /> : <Ionicons name="receipt" size={30} color={Tokens['primary-container']} />}
              </View>
              <Text style={styles.billStoreName}>{shopName}</Text>
              <Text style={styles.billDate}>{t('bill.generatedOn')} {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
            </View>

            <View style={styles.billCustomer}>
              <Ionicons name="person-outline" size={18} color={Tokens['on-surface-variant']} />
              <View>
                <Text style={styles.billSectionLabel}>{t('common.customer')}</Text>
                <Text style={styles.billSectionValue}>{customer?.name || t('bill.walkInCustomer')}</Text>
              </View>
            </View>

            <View style={styles.billItemsSection}>
              <Text style={styles.billSectionLabel}>{t('bill.items')} ({items.length})</Text>
              {items.map(item => {
                const itemSubtotal = item.rate * item.quantity;
                const gstAmt = (item.gstRate ?? 0) > 0 ? Math.round(itemSubtotal * (item.gstRate ?? 0) / 100) : 0;
                return (
                  <View key={item.id} style={styles.billItemRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.billItemName}>{item.name}</Text>
                      <Text style={styles.billItemSubtext}>{item.quantity} × ₹{item.rate}{(item.gstRate ?? 0) > 0 ? ` | GST ${item.gstRate}%` : ''}</Text>
                    </View>
                    <Text style={styles.billItemAmount}>₹{itemSubtotal + gstAmt}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.billSummary}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('bill.subtotal')}</Text><Text style={styles.summaryValue}>₹{subtotal}</Text></View>
              {discount && (
                <View style={styles.summaryRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.summaryLabel}>{t('bill.discount')}</Text>
                    <View style={styles.discountBadge}><Text style={styles.discountBadgeText}>{discount.type === 'percentage' ? `${discount.value}% OFF` : `₹${discount.value} OFF`}</Text></View>
                  </View>
                  <Text style={[styles.summaryValue, { color: Tokens.secondary }]}>-₹{discountAmount}</Text>
                </View>
              )}
              {taxAmount > 0 && <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('bill.gst')}</Text><Text style={styles.summaryValue}>₹{taxAmount}</Text></View>}
              <View style={[styles.summaryRow, styles.totalRow]}><Text style={styles.totalLabel}>{t('bill.grandTotal')}</Text><Text style={styles.totalValue}>₹{grandTotal}</Text></View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('bill.paymentMode')}</Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_MODES.map(mode => (
                <TouchableOpacity key={mode.key} style={[styles.paymentOption, paymentMode === mode.key && styles.paymentOptionActive]} onPress={() => setPaymentMode(mode.key)}>
                  <Ionicons name={mode.icon as any} size={24} color={paymentMode === mode.key ? Tokens['on-primary'] : Tokens['on-surface-variant']} />
                  <Text style={[styles.paymentLabel, paymentMode === mode.key && styles.paymentLabelActive]}>{mode.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {paymentMode !== 'Udhaar' && (
            <View style={styles.paidSection}>
              <Text style={styles.paidSectionTitle}><Ionicons name="card" size={18} color={Tokens.secondary} style={{marginRight: 6}} /> {t('bill.amountPaid')}</Text>
              <View style={styles.paidInputContainer}>
                <Text style={styles.paidCurrencySign}>₹</Text>
                <TextInput style={styles.paidInput} value={paidInput} onChangeText={t => setPaidInput(t.replace(/[^0-9.]/g, ''))} onSubmitEditing={confirmPaidInput} onEndEditing={confirmPaidInput} keyboardType="decimal-pad" returnKeyType="done" placeholder="0" placeholderTextColor={Tokens['outline-variant']} selectTextOnFocus />
                <View style={styles.paidTotalBadge}><Text style={styles.paidTotalBadgeText}>{t('common.of')} ₹{grandTotal}</Text></View>
              </View>
              <View style={styles.paidHintRow}>
                <Ionicons name="information-circle-outline" size={14} color={Tokens['on-surface-variant']} />
                <Text style={styles.paidHintText}>{paidAmount >= grandTotal ? t('bill.fullPayment') : t('bill.willGoAsUdhaar', { amount: dueAmount.toFixed(2) })}</Text>
              </View>
              {dueAmount > 0 && !customer?.name && <View style={styles.dueWarning}><Ionicons name="alert-circle" size={16} color={Tokens.tertiary} /><Text style={styles.dueWarningText}>{t('bill.selectCustomerForUdhaar')}</Text></View>}
            </View>
          )}

          {paymentMode === 'Udhaar' && (
            <View style={styles.paidSection}>
              <View style={styles.udhaarNotice}>
                <View style={styles.udhaarIconWrap}><Ionicons name="book" size={22} color={Tokens.tertiary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.udhaarNoticeTitle}>{t('bill.fullUdhaar')}</Text>
                  <Text style={styles.udhaarNoticeText}>{customer?.name ? t('bill.fullUdhaarText', { amount: grandTotal, name: customer.name }) : t('bill.fullUdhaarTextGeneric', { amount: grandTotal })}</Text>
                </View>
              </View>
            </View>
          )}

          {notes && <View style={styles.notesCard}><Ionicons name="document-text-outline" size={18} color={Tokens['on-surface-variant']} /><Text style={styles.notesText}>{notes}</Text></View>}
          {error && <View style={styles.errorCard}><Ionicons name="alert-circle" size={18} color={Tokens.tertiary} /><Text style={styles.errorText}>{error}</Text></View>}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: (Spacing as any).md + insets.bottom }]}>
        <View style={styles.bottomSummary}><Text style={styles.bottomLabel}>{t('bill.amountToCollect')}</Text><Text style={styles.bottomAmount}>₹{grandTotal}</Text></View>
        <TouchableOpacity style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]} onPress={handleConfirm} activeOpacity={0.9} disabled={submitting}>
          {submitting ? <Loader size={20} color={Tokens['on-primary']} /> : <> <Text style={styles.confirmBtnText}>{t('bill.confirmGenerate')}</Text> <Ionicons name="checkmark-circle" size={20} color={Tokens['on-primary']} /> </>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Tokens.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.gutter, height: 56, backgroundColor: Tokens.surface, borderBottomWidth: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.full },
  iconButtonActive: { backgroundColor: 'rgba(220, 38, 38, 0.1)' },
  topBarTitle: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  micButtonTop: { backgroundColor: Tokens['surface-container'], borderWidth: 1, borderColor: Tokens['outline-variant'] },
  pulseRingTop: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 26, borderWidth: 2, borderColor: '#dc2626' },
  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, paddingBottom: 180, gap: Spacing.md },
  billCard: { backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl, overflow: 'hidden', shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3 },
  billHeader: { padding: Spacing.md, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'] },
  billLogo: { width: 48, height: 48, borderRadius: BorderRadius.xl, backgroundColor: Tokens['primary-container'], alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  billStoreName: { fontSize: Typography['headline-sm'].fontSize, fontWeight: Typography['headline-sm'].fontWeight as any, color: Tokens['on-surface'] },
  billDate: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'], marginTop: 2 },
  billCustomer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'] },
  billSectionLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  billSectionValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'], fontWeight: '500' },
  billItemsSection: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'], gap: Spacing.sm },
  billItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  billItemName: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'], fontWeight: '500' },
  billItemSubtext: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'], marginTop: 2 },
  billItemAmount: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  billSummary: { padding: Spacing.md, gap: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  summaryValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'] },
  discountBadge: { backgroundColor: Tokens['secondary-fixed'], paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  discountBadgeText: { fontSize: 10, fontWeight: '600', color: Tokens['on-secondary-fixed'] },
  totalRow: { borderTopWidth: 1, borderTopColor: Tokens['outline-variant'], paddingTop: Spacing.sm },
  totalLabel: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  totalValue: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens.secondary },
  section: {},
  sectionTitle: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'], marginBottom: Spacing.sm },
  paymentGrid: { flexDirection: 'row', gap: Spacing.sm },
  paymentOption: { flex: 1, alignItems: 'center', gap: 6, padding: Spacing.sm, borderRadius: BorderRadius.xl, backgroundColor: Tokens['surface-container-lowest'], borderWidth: 1, borderColor: Tokens['outline-variant'] },
  paymentOptionActive: { backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'] },
  paymentLabel: { fontSize: Typography['label-md'].fontSize, fontWeight: Typography['label-md'].fontWeight as any, color: Tokens['on-surface-variant'] },
  paymentLabelActive: { color: Tokens['on-primary'] },
  notesCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3 },
  notesText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'], flex: 1 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.xl, padding: Spacing.md },
  errorText: { fontSize: Typography['body-md'].fontSize, color: Tokens.tertiary, flex: 1 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Tokens['surface-container-lowest'], borderTopWidth: 1, borderTopColor: Tokens['outline-variant'], paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.sm, paddingBottom: Spacing.md },
  bottomSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  bottomLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  bottomAmount: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, backgroundColor: Tokens['primary-container'], borderRadius: BorderRadius.xl, shadowColor: Tokens['primary-container'], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-primary'] },
  voiceListeningBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Tokens['secondary-fixed'], borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  voiceListeningText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-secondary-fixed-variant'], flex: 1 },
  voiceErrorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  voiceErrorText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'], flex: 1 },
  pauseIndicatorBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Tokens['secondary-container'], borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  pauseIndicatorText: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-secondary-container'] },
  paidSection: { backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 3 },
  paidSectionTitle: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens['on-surface'], marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
  paidInputContainer: { flexDirection: 'row', alignItems: 'center', height: 56, backgroundColor: Tokens['surface'], borderRadius: BorderRadius.xl, borderWidth: 2, borderColor: Tokens['primary-container'], paddingHorizontal: Spacing.md, gap: 4 },
  paidCurrencySign: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens['on-surface'], marginRight: 4 },
  paidInput: { flex: 1, height: '100%', fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens['on-surface'], paddingVertical: 0 },
  paidTotalBadge: { backgroundColor: Tokens['surface-container'], borderRadius: BorderRadius.lg, paddingHorizontal: 10, paddingVertical: 4 },
  paidTotalBadgeText: { fontSize: Typography['label-md'].fontSize, fontWeight: '600', color: Tokens['on-surface-variant'] },
  paidHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  paidHintText: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'], flex: 1 },
  dueWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.lg, padding: Spacing.sm, marginTop: Spacing.sm },
  dueWarningText: { fontSize: Typography['body-md'].fontSize, color: Tokens.tertiary, flex: 1 },
  udhaarNotice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  udhaarIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Tokens['tertiary-fixed'], alignItems: 'center', justifyContent: 'center' },
  udhaarNoticeTitle: { fontSize: Typography['label-lg'].fontSize, fontWeight: Typography['label-lg'].fontWeight as any, color: Tokens.tertiary },
  udhaarNoticeText: { fontSize: Typography['body-md'].fontSize, color: Tokens.tertiary, flex: 1 },
});