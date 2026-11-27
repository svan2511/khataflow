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
import { parseBillLocally, preprocessQuantityUpdates, preprocessDeleteCommands, extractGstCommands, itemNameMatches } from '@/lib/voice-parser';

const CONTEXTUAL_STRINGS = [
  'chai', 'tea', 'paratha', 'prantha', 'roti', 'lassi', 'raita', 'momos',
  'atta', 'doodh', 'chawal', 'dal', 'cheeni', 'udhaar', 'UPI', 'cash',
  'gobhi', 'paratha', 'gst', 'percent', 'remove', 'delete', 'hatao', 'lagao', 'add', 'set', 'change', 'update', 'quantity', 'price', 'rate',
];

export default function BillReviewScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const {
    items, customer, paymentMode, discount, notes,
    subtotal, discountAmount, taxAmount, grandTotal,
    setPaymentMode, resetBill, addItem, setCustomer, setDiscount, setNotes, updateItemQuantity, removeItem, updateItemGstRate,
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

  // Voice recognition state for "Add More Items" - Push-to-talk with manual send
  const [voiceLanguage, setVoiceLanguage] = useState<'hi' | 'en'>(() => (getCurrentLanguage() === 'en' ? 'en' : 'hi'));
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceShowSend, setVoiceShowSend] = useState(false);
  const voiceTranscriptRef = useRef('');
  const voiceInterimRef = useRef('');
  const voiceParsingRef = useRef(false);
  const voiceSpeechErrorRef = useRef(false);
  const voiceMountedRef = useRef(true);

  const voicePulseAnim = useRef(new Animated.Value(0)).current;
  const voiceWaveAnim = useRef(new Animated.Value(0)).current;
  const voiceSendButtonAnim = useRef(new Animated.Value(0)).current;

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
    }).start(({ finished }) => { if (finished && voiceRecording) startVoicePulseAnimation(); });
  }, [voiceRecording]);

  useSpeechRecognitionEvent('start', () => {
    voiceSpeechErrorRef.current = false;
    setVoiceRecording(true);
    setVoiceShowSend(true);
    startVoicePulseAnimation();
    Animated.timing(voiceWaveAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    updateVoiceInterim('');
  });

  useSpeechRecognitionEvent('result', event => {
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (!text) return;
    if (event.isFinal) {
      updateVoiceInterim('');
      updateVoiceTranscript(voiceTranscriptRef.current ? `${voiceTranscriptRef.current} ${text}`.trim() : text);
    } else {
      updateVoiceInterim(text);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setVoiceRecording(false);
    voicePulseAnim.stopAnimation();
    voiceWaveAnim.stopAnimation();
    voiceWaveAnim.setValue(0);
    if (voiceInterimRef.current) {
      const pending = voiceInterimRef.current;
      updateVoiceInterim('');
      updateVoiceTranscript(voiceTranscriptRef.current ? `${voiceTranscriptRef.current} ${pending}`.trim() : pending);
    }
  });

  useSpeechRecognitionEvent('error', event => {
    voiceSpeechErrorRef.current = true;
    setVoiceRecording(false);
    updateVoiceInterim('');
    voiceWaveAnim.stopAnimation();
    voiceWaveAnim.setValue(0);
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
    Animated.timing(voiceSendButtonAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return () => {
      voiceMountedRef.current = false;
      voicePulseAnim.stopAnimation();
      voiceWaveAnim.stopAnimation();
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
    };
  }, []);

  const toggleVoiceRecording = async () => {
    if (voiceRecording) {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
      setVoiceRecording(false);
      return;
    }
    if (voiceProcessing) return;
    setVoiceError('');
    updateVoiceInterim('');
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
        contextualStrings: CONTEXTUAL_STRINGS,
      });
      setVoiceRecording(true);
    } catch { setVoiceError(t('voice.recognitionFailed')); }
  };

  const handleVoiceSend = () => {
    const finalText = voiceTranscriptRef.current.trim() || voiceInterimRef.current.trim();
    if (finalText.length < 2) {
      setVoiceError(t('voice.speakFirst'));
      return;
    }
    setVoiceShowSend(false);
    void parseVoiceText(finalText);
  };

  const startNewVoiceCapture = () => {
    updateVoiceTranscript('');
    updateVoiceInterim('');
    setVoiceError('');
    setVoiceShowSend(false);
  };

  const parseVoiceText = async (rawText: string) => {
    const text = rawText.trim();
    if (text.length < 2) { setVoiceError(t('voice.speakFirst')); return; }
    if (!token || voiceParsingRef.current) return;

    voiceParsingRef.current = true;
    setVoiceProcessing(true);
    setVoiceError('');

    const gstExtraction = extractGstCommands(text);
    let processedText = preprocessQuantityUpdates(gstExtraction.text);
    processedText = preprocessDeleteCommands(processedText);

    const hasSpecialCommands = processedText !== gstExtraction.text || gstExtraction.updates.length > 0;
    const hasProductText = processedText.trim().length >= 2;

    try {
      let parseResult: any = null;

      if (hasProductText) {
        if (hasSpecialCommands) {
          const [productsRes, customersRes] = await Promise.all([
            api.searchProducts(token, undefined, 100),
            api.searchCustomers(token, undefined, 100),
          ]);
          if (!voiceMountedRef.current) return;
          parseResult = parseBillLocally(processedText, voiceLanguage, productsRes.data, customersRes.data);
        } else {
          const res = await api.parseVoiceBill(token, gstExtraction.text, voiceLanguage, true);
          if (!voiceMountedRef.current) return;
          parseResult = res.data;
        }
      }

      if (!voiceMountedRef.current) return;

      const hasParsedWork = !!parseResult
        && (parseResult.items.length > 0 || (parseResult.deleteItems?.length ?? 0) > 0);
      if (!hasParsedWork && gstExtraction.updates.length === 0) {
        setVoiceError(t('voice.notUnderstood'));
        return;
      }
      mergeVoiceResult(parseResult ?? { items: [], deleteItems: [] }, gstExtraction.updates);
    } catch {
      if (!hasProductText) {
        if (gstExtraction.updates.length > 0) {
          mergeVoiceResult({ items: [], deleteItems: [] }, gstExtraction.updates);
        } else {
          setVoiceError(t('voice.notUnderstood'));
        }
        return;
      }
      try {
        const [productsRes, customersRes] = await Promise.all([
          api.searchProducts(token, undefined, 100),
          api.searchCustomers(token, undefined, 100),
        ]);
        if (!voiceMountedRef.current) return;
        const local = parseBillLocally(hasSpecialCommands ? processedText : text, voiceLanguage, productsRes.data, customersRes.data);
        const hasLocalWork = local.items.length > 0 || local.deleteItems?.length > 0 || gstExtraction.updates.length > 0;
        if (hasLocalWork) mergeVoiceResult(local, gstExtraction.updates);
        else setVoiceError(t('voice.notUnderstood'));
      } catch { setVoiceError('Voice parsing failed. Please try again.'); }
    } finally {
      voiceParsingRef.current = false;
      setVoiceProcessing(false);
    }
  };

  const mergeVoiceResult = (data: any, gstUpdates: { itemName: string; gstRate: number }[] = []) => {
    const resolvedItems = (data.items ?? []).filter(
      (item: any) => item.resolved && item.product_uuid,
    );
    const missing = (data.items ?? [])
      .filter((item: any) => !item.resolved || !item.product_uuid)
      .map((item: any) => item.spoken_name || item.name)
      .filter(Boolean);

    // Handle delete commands
    const deleteItems = data.deleteItems ?? [];
    let deletedCount = 0;
    if (deleteItems.length > 0) {
      for (const deleteName of deleteItems) {
        const existingIndex = items.findIndex(i => itemNameMatches(i.name, deleteName));
        if (existingIndex >= 0) {
          removeItem(items[existingIndex].id);
          deletedCount++;
        }
      }
    }

    // Handle GST updates
    const billWideGst = [...gstUpdates].reverse().find(update => !update.itemName)?.gstRate;
    const perItemGst = gstUpdates.filter(update => update.itemName);

    let updatedCount = 0;
    let addedCount = 0;
    let gstUpdatedCount = 0;

    resolvedItems.forEach((item: any, index: number) => {
      const productUuid = item.product_uuid;
      const itemName = item.name?.toLowerCase().trim();

      let existingIndex = -1;
      if (productUuid) {
        existingIndex = items.findIndex(i => i.product_uuid === productUuid);
      }
      if (existingIndex === -1 && itemName) {
        existingIndex = items.findIndex(i => itemNameMatches(i.name, item.name));
      }

      const newQuantity = Number(item.quantity || 1);
      const newRate = Number(item.price) || 0;
      const newUnit = item.unit || 'piece';
      const newGstRate = Number(item.gst_rate) || 0;

      if (existingIndex >= 0) {
        const currentItem = items[existingIndex];
        updateItemQuantity(currentItem.id, newQuantity);
        if (newGstRate > 0) updateItemGstRate(currentItem.id, newGstRate);
        updatedCount++;
      } else {
        const itemId = productUuid ?? `voice-${Date.now()}-${index}`;
        addItem({
          id: itemId,
          product_uuid: productUuid ?? undefined,
          name: item.name,
          rate: newRate,
          quantity: newQuantity,
          unit: newUnit,
          gstRate: billWideGst ?? newGstRate,
        });
        addedCount++;
      }
    });

    if (billWideGst !== undefined) {
      for (const item of items) {
        if ((item.gstRate ?? 0) !== billWideGst) {
          updateItemGstRate(item.id, billWideGst);
          gstUpdatedCount++;
        }
      }
    }

    for (const { itemName, gstRate } of perItemGst) {
      const existingIndex = items.findIndex(i => itemNameMatches(i.name, itemName));
      if (existingIndex >= 0) {
        const item = items[existingIndex];
        if ((item.gstRate ?? 0) !== gstRate) {
          updateItemGstRate(item.id, gstRate);
          gstUpdatedCount++;
        }
      }
    }

    if (missing.length > 0) {
      setVoiceError(t('voice.itemsNotFound', { items: missing.join(', ') }));
    }
    if (resolvedItems.length === 0 && deletedCount === 0 && gstUpdatedCount === 0) return;

    if (data.customer && !customer?.uuid) {
      setCustomer({ uuid: data.customer.uuid, name: data.customer.name, phone: data.customer.phone ?? undefined });
    }

    const modeMap: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Udhaar', mix: 'Cash' };
    if (data.payment_method && modeMap[data.payment_method]) setPaymentMode(modeMap[data.payment_method]);
    if (data.discount) setDiscount({ type: data.discount.type, value: data.discount.value });
    if (data.notes) setNotes(data.notes);

    updateVoiceTranscript('');
    updateVoiceInterim('');

    const parts: string[] = [];
    if (deletedCount > 0) parts.push(`${deletedCount} ${t('voice.itemRemoved')}`);
    if (gstUpdatedCount > 0) parts.push(`${gstUpdatedCount} ${t('voice.gstUpdated')}`);
    if (updatedCount > 0) parts.push(`${updatedCount} ${t('voice.itemUpdated')}`);
    if (addedCount > 0) parts.push(`${addedCount} ${t('voice.itemAdded')}`);

    if (parts.length > 0) {
      const title = (deletedCount > 0 || gstUpdatedCount > 0 || updatedCount > 0) ? t('voice.billUpdated') : t('voice.addedItems');
      showToast({ type: 'success', title, message: parts.join(', ') });
    }
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
  const voiceWaveOpacity = voiceWaveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
  const voiceWaveScale = voiceWaveAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const voiceSendButtonScale = voiceSendButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const voiceSendButtonOpacity = voiceSendButtonAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const voiceDisplayText = voiceTranscript || voiceInterim;
  const voiceHasText = voiceDisplayText.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('bill.reviewBill')}</Text>
        <View style={styles.topBarActions}>
          <Animated.View style={{ transform: [{ scale: voiceSendButtonScale }], opacity: voiceSendButtonOpacity }}>
            <TouchableOpacity
              style={[styles.iconButton, styles.micButtonTop, voiceRecording && styles.iconButtonActive]}
              onPress={toggleVoiceRecording}
              disabled={voiceProcessing}
              activeOpacity={0.85}
              accessibilityLabel={voiceRecording ? t('voice.tapToStop') : t('voice.addMoreItems')}
            >
              <Ionicons name={voiceRecording ? 'stop' : 'mic'} size={24} color={voiceRecording ? '#dc2626' : Tokens['on-surface-variant']} />
            </TouchableOpacity>
            {voiceRecording && (
              <Animated.View style={[{ transform: [{ scale: micScale }] }]}>
                <Animated.View style={[styles.pulseRingTop, { opacity: micOpacity }]} />
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}>
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {voiceRecording && (
            <Animated.View style={[
              styles.voiceRecordingBar,
              { opacity: voiceHasText ? 1 : 0 }
            ]}>
              <Animated.View
                style={[
                  styles.soundWaveTop,
                  { opacity: voiceWaveOpacity, transform: [{ scale: voiceWaveScale }] }
                ]}
              />
              <View style={styles.liveTranscriptBarTop}>
                <Ionicons name="mic-outline" size={14} color={Tokens.secondary} />
                <Text style={styles.liveTranscriptTextTop} numberOfLines={2}>
                  {voiceDisplayText}
                </Text>
              </View>
            </Animated.View>
          )}

          {voiceError ? (
            <View style={styles.voiceErrorBar}>
              <Ionicons name="alert-circle" size={16} color={Tokens.tertiary} />
              <Text style={styles.voiceErrorText}>{voiceError}</Text>
            </View>
          ) : null}

          {voiceHasText && !voiceRecording && !voiceProcessing && (
            <View style={styles.voiceActionBar}>
              <TouchableOpacity
                style={[styles.sendBtnTop, { transform: [{ scale: voiceSendButtonScale }], opacity: voiceSendButtonOpacity }]}
                onPress={handleVoiceSend}
                activeOpacity={0.9}
                disabled={voiceProcessing}
              >
                <Text style={styles.sendBtnTextTop}>{t('voice.send')}</Text>
                <Ionicons name="send" size={20} color={Tokens['on-primary']} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearBtnTop} onPress={startNewVoiceCapture}>
                <Ionicons name="refresh-outline" size={16} color={Tokens.secondary} />
                <Text style={styles.clearBtnTextTop}>{t('voice.clear')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {voiceProcessing && (
            <View style={styles.voiceProcessingBar}>
              <Loader size={16} color={Tokens.secondary} />
              <Text style={styles.voiceProcessingText}>{t('voice.understandingBill')}</Text>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.gutter, height: 56, backgroundColor: Tokens.surface, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'] },
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
  voiceRecordingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Tokens['secondary-fixed'], borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
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

  // Voice recording UI styles
  soundWaveTop: {
    position: 'absolute', top: '50%', marginTop: -28,
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: Tokens.secondary,
    alignSelf: 'center',
  },
  liveTranscriptBarTop: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Tokens['secondary-fixed'], borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    flex: 1,
  },
  liveTranscriptTextTop: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-secondary-fixed-variant'], flex: 1 },
  voiceActionBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sendBtnTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: BorderRadius.xl, backgroundColor: Tokens.secondary,
    flex: 1,
  },
  sendBtnTextTop: {
    fontSize: Typography['label-md'].fontSize,
    fontWeight: Typography['label-md'].fontWeight as any,
    color: Tokens['on-primary'],
  },
  clearBtnTop: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    backgroundColor: Tokens['surface-container'], borderRadius: BorderRadius.full,
  },
  clearBtnTextTop: { fontSize: Typography['label-md'].fontSize, fontWeight: '600', color: Tokens.secondary },
  voiceProcessingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Tokens['secondary-container'], borderRadius: BorderRadius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  voiceProcessingText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-secondary-container'], flex: 1 },
});