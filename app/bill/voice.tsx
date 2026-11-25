import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  apiErrorMessage,
  type CustomerData,
  type ProductData,
  type VoiceParseItem,
  type VoiceParseResult,
} from '@/lib/api';
import { parseBillLocally } from '@/lib/voice-parser';
import { useBill } from '@/lib/bill-context';
import { getCurrentLanguage } from '@/lib/i18n';
import Loader from '@/components/Loader';

type Language = 'hi' | 'en';
type PickerMode = 'product' | 'customer';
type DraftItem = VoiceParseItem & { key: string; priceText?: string };

const PAYMENT_OPTIONS = [
  { key: 'cash', labelKey: 'paymentMethods.cash', icon: 'cash' },
  { key: 'upi', labelKey: 'paymentMethods.upi', icon: 'phone-portrait' },
  { key: 'card', labelKey: 'paymentMethods.card', icon: 'card' },
  { key: 'credit', labelKey: 'paymentMethods.udhaar', icon: 'book' },
] as const;

function formatMoney(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default function VoiceBillScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    resetBill,
    addItem,
    setCustomer: setBillCustomer,
    setPaymentMode: setBillPaymentMode,
    setDiscount: setBillDiscount,
    setNotes: setBillNotes,
  } = useBill();

  const [language, setLanguage] = useState<Language>(() => (getCurrentLanguage() === 'en' ? 'en' : 'hi'));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [error, setError] = useState('');
  const [parsedResult, setParsedResult] = useState<VoiceParseResult | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [parsedCustomer, setParsedCustomer] = useState<VoiceParseResult['customer']>(null);
  const [payment, setPayment] = useState<VoiceParseResult['payment_method']>('cash');
  const [discount, setDiscount] = useState<VoiceParseResult['discount']>(null);
  const [picker, setPicker] = useState<{ visible: boolean; mode: PickerMode; index: number | null }>({
    visible: false,
    mode: 'product',
    index: null,
  });
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductData[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerData[]>([]);

  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoParseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsingRef = useRef(false);
  const speechErrorRef = useRef(false);
  const mountedRef = useRef(true);
  const creatingCustomerRef = useRef(false);
  const pauseDetectedRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const loaderAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const updateTranscript = useCallback((value: string) => {
    transcriptRef.current = value;
    setTranscript(value);
  }, []);

  const updateInterim = useCallback((value: string) => {
    interimRef.current = value;
    setInterim(value);
  }, []);

  const startPulseAnimation = useCallback(() => {
    pulseAnim.setValue(0);
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (listening) startPulseAnimation();
    });
  }, [listening]);

  const startLoaderAnimation = useCallback(() => {
    loaderAnim.setValue(0);
    Animated.timing(loaderAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      if (processing) startLoaderAnimation();
    });
  }, [processing]);

  const showFullScreenLoader = useCallback((text: string) => {
    setProcessingText(text);
    setProcessing(true);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();
    startLoaderAnimation();
  }, [startLoaderAnimation]);

  const hideFullScreenLoader = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setProcessing(false);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
    });
  }, []);

  useSpeechRecognitionEvent('start', () => {
    speechErrorRef.current = false;
    pauseDetectedRef.current = false;
    setListening(true);
    startPulseAnimation();
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    pulseAnim.stopAnimation();
    if (interimRef.current) {
      const pending = interimRef.current;
      updateInterim('');
      if (!transcriptRef.current) updateTranscript(pending);
    }
    if (!mountedRef.current || speechErrorRef.current) return;
    
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    if (autoParseTimer.current) clearTimeout(autoParseTimer.current);
    
    pauseDetectedRef.current = true;
    pauseTimer.current = setTimeout(() => {
      if (!mountedRef.current || speechErrorRef.current) return;
      const text = transcriptRef.current.trim();
      if (text.length >= 2) {
        void parseText(text);
      } else {
        pauseDetectedRef.current = false;
      }
    }, 3000);
  });

  useSpeechRecognitionEvent('result', event => {
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (!text) return;
    if (event.isFinal) {
      updateInterim('');
      updateTranscript(transcriptRef.current ? `${transcriptRef.current} ${text}`.trim() : text);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      pauseDetectedRef.current = false;
    } else {
      updateInterim(text);
    }
  });

  useSpeechRecognitionEvent('error', event => {
    speechErrorRef.current = true;
    setListening(false);
    updateInterim('');
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    const code = event.error;
    if (code === 'aborted') return;
    if (code === 'no-speech' || code === 'speech-timeout') {
      setError(t('voice.noSpeech'));
    } else if (code === 'not-allowed' || code === 'service-not-allowed') {
      setError(t('voice.micPermissionMessage'));
    } else if (code === 'network') {
      setError(t('voice.speechNetworkError'));
    } else if (code === 'language-not-supported') {
      setError(t('voice.languageNotSupported'));
    } else {
      setError(t('voice.recognitionFailed'));
    }
  });

  useEffect(() => {
    mountedRef.current = true;
    fadeAnim.setValue(1);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    return () => {
      mountedRef.current = false;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      if (autoParseTimer.current) clearTimeout(autoParseTimer.current);
      pulseAnim.stopAnimation();
      loaderAnim.stopAnimation();
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
    };
  }, []);

  const toggleListening = async () => {
    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
      setListening(false);
      return;
    }
    setError('');
    updateInterim('');
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    if (autoParseTimer.current) clearTimeout(autoParseTimer.current);
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
        lang: language === 'hi' ? 'hi-IN' : 'en-IN',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
        contextualStrings: [
          'chai', 'tea', 'paratha', 'prantha', 'roti', 'lassi', 'raita', 'momos',
          'atta', 'doodh', 'chawal', 'dal', 'cheeni', 'udhaar', 'UPI', 'cash',
        ],
      });
      setListening(true);
    } catch {
      setError(t('voice.recognitionFailed'));
    }
  };

  const goToReview = (data: VoiceParseResult) => {
    resetBill();
    data.items.forEach((item, index) => {
      addItem({
        id: item.product_uuid ?? `voice-${Date.now()}-${index}`,
        product_uuid: item.product_uuid ?? undefined,
        name: item.name,
        rate: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'piece',
        gstRate: Number(item.gst_rate) || 0,
      });
    });
    setBillCustomer(
      data.customer
        ? {
            uuid: data.customer.uuid,
            name: data.customer.name,
            phone: data.customer.phone ?? undefined,
          }
        : null,
    );
    const modeMap: Record<VoiceParseResult['payment_method'], string> = {
      cash: 'Cash',
      upi: 'UPI',
      card: 'Card',
      credit: 'Udhaar',
      mix: 'Cash',
    };
    setBillPaymentMode(modeMap[data.payment_method] ?? 'Cash');
    setBillDiscount(data.discount ? { type: data.discount.type, value: data.discount.value } : null);
    setBillNotes(data.notes ?? '');
    router.push('/bill/review');
  };

  const parseText = async (rawText: string) => {
    const text = rawText.trim();
    if (text.length < 2) {
      setError(t('voice.speakFirst'));
      pauseDetectedRef.current = false;
      return;
    }
    if (!token || parsingRef.current) return;

    if (autoParseTimer.current) clearTimeout(autoParseTimer.current);
    parsingRef.current = true;
    showFullScreenLoader(t('voice.understandingBill'));

    try {
      const res = await api.parseVoiceBill(token, text, language);
      if (!mountedRef.current) return;
      if (!res.data.items.length) {
        hideFullScreenLoader();
        setError(t('voice.notUnderstood'));
        return;
      }
      hideFullScreenLoader();
      goToReview(res.data);
    } catch (e) {
      try {
        const [productsRes, customersRes] = await Promise.all([
          api.searchProducts(token, undefined, 200),
          api.searchCustomers(token, undefined, 100),
        ]);
        if (!mountedRef.current) return;
        const local = parseBillLocally(text, language, productsRes.data, customersRes.data);
        if (local.items.length) {
          hideFullScreenLoader();
          goToReview(local);
        } else {
          hideFullScreenLoader();
          setError(apiErrorMessage(e, t('voice.parseFailed')));
        }
      } catch {
        if (mountedRef.current) {
          hideFullScreenLoader();
          setError(apiErrorMessage(e, t('voice.parseFailed')));
        }
      }
    } finally {
      parsingRef.current = false;
      pauseDetectedRef.current = false;
    }
  };

  const loadOptions = async (mode: PickerMode, query: string) => {
    if (!token) return;
    setPickerLoading(true);
    try {
      if (mode === 'product') {
        const res = await api.searchProducts(token, query || undefined, 30);
        setProductOptions(res.data);
      } else {
        const res = await api.searchCustomers(token, query || undefined, 30);
        setCustomerOptions(res.data);
      }
    } catch {
      if (mode === 'product') setProductOptions([]);
      else setCustomerOptions([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const openPicker = (mode: PickerMode, index: number | null = null) => {
    setPicker({ visible: true, mode, index });
    const initialQuery =
      mode === 'product' && index !== null
        ? items[index]?.spoken_name || items[index]?.name || ''
        : '';
    setPickerQuery(initialQuery);
    loadOptions(mode, initialQuery);
  };

  const closePicker = () => setPicker(prev => ({ ...prev, visible: false }));

  const onPickerQueryChange = (value: string) => {
    setPickerQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadOptions(picker.mode, value), 350);
  };

  const selectProduct = (product: ProductData) => {
    if (picker.index === null) {
      closePicker();
      return;
    }
    setItems(prev =>
      prev.map((item, index) =>
        index === picker.index
          ? {
              ...item,
              product_uuid: product.id,
              name: product.name,
              price: Number(product.price) || 0,
              priceText: undefined,
              unit: product.unit || item.unit,
              gst_rate: 0,
              confidence: 1,
              resolved: true,
            }
          : item,
      ),
    );
    closePicker();
  };

  const selectCustomer = (customer: CustomerData) => {
    setParsedCustomer({ uuid: customer.id, name: customer.name, phone: customer.phone });
    closePicker();
  };

  const updateQuantity = (index: number, delta: number) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = Math.max(0.01, Math.round((item.quantity + delta) * 100) / 100);
        return { ...item, quantity: Math.min(999999, next) };
      }),
    );
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updatePrice = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    const priceText = rest.length > 0 ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
    const parsed = Number(priceText);
    const price = Number.isFinite(parsed) ? Math.min(999999, Math.max(0, parsed)) : 0;
    setItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, price, priceText } : item)),
    );
  };

  const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const discountAmount = discount
    ? discount.type === 'percentage'
      ? round2(subtotal * (discount.value / 100))
      : round2(Math.min(discount.value, subtotal))
    : 0;
  const taxAmount = round2(
    items.reduce((sum, item) => sum + (item.price * item.quantity * item.gst_rate) / 100, 0),
  );
  const grandTotal = round2(Math.max(0, subtotal - discountAmount + taxAmount));
  const isItemReady = (item: DraftItem) => item.resolved || item.price > 0;
  const notReadyCount = items.filter(item => !isItemReady(item)).length;
  const customerName = (parsedResult?.customer_name ?? '').trim();
  const canReview =
    items.length > 0 &&
    notReadyCount === 0 &&
    (payment !== 'credit' || !!parsedCustomer);

  const createCustomer = async (name = customerName) => {
    const cleanName = name.trim();
    if (!token || !cleanName || creatingCustomerRef.current) return;
    creatingCustomerRef.current = true;
    setCreatingCustomer(true);
    setError('');
    try {
      const res = await api.quickAddCustomer(token, { name: cleanName });
      setParsedCustomer({ uuid: res.data.id, name: res.data.name, phone: res.data.phone });
      closePicker();
    } catch (e) {
      closePicker();
      setError(apiErrorMessage(e, t('voice.createFailed')));
    } finally {
      creatingCustomerRef.current = false;
      setCreatingCustomer(false);
    }
  };

  const handleReview = () => {
    if (items.length === 0) {
      setError(t('voice.speakFirst'));
      return;
    }
    if (notReadyCount > 0) {
      setError(t('voice.priceRequired', { count: notReadyCount }));
      return;
    }
    if (payment === 'credit' && !parsedCustomer) {
      setError(t('voice.customerRequiredForUdhaar'));
      return;
    }
    const draft: VoiceParseResult = {
      items: items.map(({ key, priceText, ...item }) => item),
      customer: parsedCustomer,
      customer_name: parsedResult?.customer_name ?? parsedCustomer?.name ?? '',
      payment_method: payment,
      discount,
      notes: parsedResult?.notes ?? '',
      assistant_reply: parsedResult?.assistant_reply ?? '',
      source: parsedResult?.source ?? 'gemini',
    };
    goToReview(draft);
  };

  const startNewCapture = () => {
    updateTranscript('');
    updateInterim('');
    setError('');
    setParsedResult(null);
    setItems([]);
    setParsedCustomer(null);
    setPayment('cash');
    setDiscount(null);
  };

  const pickerData = picker.mode === 'product' ? productOptions : customerOptions;
  const pickerCustomerName = picker.mode === 'customer' ? pickerQuery.trim() : '';
  const hasExactCustomer = customerOptions.some(
    customer => customer.name.trim().toLowerCase() === pickerCustomerName.toLowerCase(),
  );
  const canQuickCreateCustomer = pickerCustomerName.length >= 2 && !hasExactCustomer;

  const micScale = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.12, 1],
  });

  const loaderRotate = loaderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2 * Math.PI],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens['on-surface-variant']} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('voice.title')}</Text>
        <View style={styles.languageToggle}>
          {(['hi', 'en'] as const).map(lang => (
            <TouchableOpacity
              key={lang}
              style={[styles.languageChip, language === lang && styles.languageChipActive]}
              onPress={() => setLanguage(lang)}
            >
              <Text style={[styles.languageChipText, language === lang && styles.languageChipTextActive]}>
                {lang === 'hi' ? 'हिं' : 'EN'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!processing}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="mic" size={26} color={Tokens.secondary} />
          </View>
          <Text style={styles.heroTitle}>{t('voice.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('voice.heroSubtitle')}</Text>
          <View style={styles.exampleChip}>
            <Ionicons name="bulb-outline" size={14} color={Tokens.tertiary} />
            <Text style={styles.exampleText}>{t('voice.example')}</Text>
          </View>
        </View>

        <View style={styles.micSection}>
          <Animated.View style={[styles.micButton, { transform: [{ scale: micScale }] }]}>
            <TouchableOpacity
              style={styles.micButtonInner}
              onPress={toggleListening}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={listening ? t('voice.tapToStop') : t('voice.tapToSpeak')}
              disabled={processing}
            >
              <Ionicons name={listening ? 'stop' : 'mic'} size={40} color="#fff" />
            </TouchableOpacity>
            {listening && (
              <Animated.View style={styles.pulseRing} />
            )}
          </Animated.View>
          <Text style={[styles.micLabel, listening && styles.micLabelActive]}>
            {listening ? t('voice.listening') : t('voice.tapToSpeak')}
          </Text>
          {interim && !processing && <Text style={styles.interimText}>{interim}</Text>}
          {pauseDetectedRef.current && !processing && (
            <View style={styles.pauseIndicator}>
              <Loader size={16} color={Tokens.secondary} />
              <Text style={styles.pauseText}>{t('voice.waitingForMore')}</Text>
            </View>
          )}
        </View>

        <View style={styles.transcriptCard}>
          <View style={styles.transcriptHeader}>
            <Text style={styles.cardTitle}>{t('voice.transcript')}</Text>
            {transcript.length > 0 && (
              <TouchableOpacity onPress={startNewCapture} style={styles.clearBtn}>
                <Ionicons name="refresh-outline" size={14} color={Tokens.secondary} />
                <Text style={styles.clearBtnText}>{t('voice.clear')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.transcriptInput}
            multiline
            editable={!listening && !processing}
            value={transcript}
            onChangeText={updateTranscript}
            placeholder={t('voice.transcriptPlaceholder')}
            placeholderTextColor={Tokens['outline']}
            textAlignVertical="top"
          />
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={Tokens.tertiary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {transcript.trim().length > 0 && !listening && !processing && !items.length && (
          <TouchableOpacity
            style={[styles.parseBtn, styles.parseBtnManual]}
            onPress={() => void parseText(transcript)}
            activeOpacity={0.9}
          >
            <Text style={styles.parseBtnText}>{t('voice.understand')}</Text>
            <Ionicons name="sparkles" size={18} color={Tokens['on-primary']} />
          </TouchableOpacity>
        )}
      </ScrollView>

      <Animated.View
        style={[styles.fullScreenLoader, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
        pointerEvents={processing ? 'auto' : 'none'}
      >
        <View style={styles.loaderContent}>
          <Animated.View style={styles.loaderRing}>
            <Animated.View style={{ transform: [{ rotate: loaderRotate }] }}>
              <Ionicons name="mic-circle" size={60} color={Tokens.secondary} style={styles.loaderIcon} />
            </Animated.View>
          </Animated.View>
          <Text style={styles.loaderText}>{processingText}</Text>
          <Text style={styles.loaderSubtext}>{t('voice.pleaseWait')}</Text>
        </View>
      </Animated.View>

      <Modal visible={picker.visible} transparent animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {picker.mode === 'product' ? t('voice.selectProduct') : t('voice.selectCustomer')}
              </Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={closePicker}>
                <Ionicons name="close" size={22} color={Tokens['on-surface-variant']} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.pickerSearch}
              value={pickerQuery}
              onChangeText={onPickerQueryChange}
              placeholder={
                picker.mode === 'product'
                  ? t('voice.searchProductsPlaceholder')
                  : t('voice.searchCustomersPlaceholder')
              }
              placeholderTextColor={Tokens['outline']}
              autoCorrect={false}
            />
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
              {picker.mode === 'customer' ? (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setParsedCustomer(null);
                    closePicker();
                  }}
                >
                  <View style={styles.createCustomerIcon}>
                    <Ionicons name="walk" size={16} color={Tokens.secondary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.pickerRowTitle}>{t('bill.walkInCustomer')}</Text>
                  </View>
                  {!parsedCustomer ? (
                    <Ionicons name="checkmark-circle" size={20} color={Tokens.secondary} />
                  ) : null}
                </TouchableOpacity>
              ) : null}
              {canQuickCreateCustomer ? (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => createCustomer(pickerCustomerName)}
                  disabled={creatingCustomer}
                >
                  <View style={styles.createCustomerIcon}>
                    <Ionicons name="person-add" size={16} color={Tokens.secondary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.pickerRowTitle} numberOfLines={1}>{t('voice.createCustomer')}</Text>
                    <Text style={styles.pickerRowMeta} numberOfLines={1}>{pickerCustomerName}</Text>
                  </View>
                  {creatingCustomer ? (
                    <Loader size={18} color={Tokens.secondary} />
                  ) : (
                    <Ionicons name="add-circle" size={20} color={Tokens.secondary} />
                  )}
                </TouchableOpacity>
              ) : null}
              {pickerLoading ? (
                <View style={styles.pickerLoading}>
                  <Loader size={22} color={Tokens.secondary} />
                </View>
              ) : pickerData.length === 0 ? (
                <Text style={styles.pickerEmpty}>{t('common.noResults')}</Text>
              ) : picker.mode === 'product' ? (
                productOptions.map(product => (
                  <TouchableOpacity key={product.id} style={styles.pickerRow} onPress={() => selectProduct(product)}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.pickerRowTitle} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.pickerRowMeta}>₹{formatMoney(Number(product.price) || 0)} / {product.unit}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Tokens['on-surface-variant']} />
                  </TouchableOpacity>
                ))
              ) : (
                customerOptions.map(customer => (
                  <TouchableOpacity key={customer.id} style={styles.pickerRow} onPress={() => selectCustomer(customer)}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.pickerRowTitle} numberOfLines={1}>{customer.name}</Text>
                      <Text style={styles.pickerRowMeta}>{customer.phone || t('bill.noPhone')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Tokens['on-surface-variant']} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  iconButton: {
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  topBarTitle: {
    fontSize: Typography['headline-sm'].fontSize,
    fontWeight: Typography['headline-sm'].fontWeight as any,
    color: Tokens['on-surface'],
  },
  languageToggle: {
    flexDirection: 'row', backgroundColor: Tokens['surface-container'],
    borderRadius: BorderRadius.full, padding: 2,
  },
  languageChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  languageChipActive: { backgroundColor: Tokens['primary-container'] },
  languageChipText: {
    fontSize: Typography['label-md'].fontSize, fontWeight: '600',
    color: Tokens['on-surface-variant'],
  },
  languageChipTextActive: { color: Tokens['on-primary'] },
  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, gap: Spacing.md },
  heroCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, gap: 6,
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  heroIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Tokens['secondary-fixed'],
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  heroTitle: {
    fontSize: Typography['headline-sm'].fontSize,
    fontWeight: Typography['headline-sm'].fontWeight as any,
    color: Tokens['on-surface'],
  },
  heroSubtitle: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  exampleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  exampleText: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'], flex: 1 },
  micSection: { alignItems: 'center', gap: 8, paddingVertical: Spacing.sm },
  micButton: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Tokens['primary-container'],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Tokens['primary-container'], shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  micButtonInner: {
    width: '100%', height: '100%', borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 58, borderWidth: 2, borderColor: Tokens.secondary,
  },
  micLabel: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-surface-variant'],
  },
  micLabelActive: { color: Tokens.secondary },
  interimText: {
    fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'],
    fontStyle: 'italic', textAlign: 'center', paddingHorizontal: Spacing.md,
  },
  pauseIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Tokens['secondary-container'], borderRadius: BorderRadius.full,
  },
  pauseText: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-secondary-container'] },
  transcriptCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, gap: Spacing.sm,
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
  },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-surface'],
  },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clearBtnText: { fontSize: Typography['label-md'].fontSize, fontWeight: '600', color: Tokens.secondary },
  transcriptInput: {
    minHeight: 88, fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'],
    backgroundColor: Tokens['surface'], borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  parseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: BorderRadius.xl, backgroundColor: Tokens.secondary,
  },
  parseBtnManual: { marginTop: Spacing.sm },
  parseBtnText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-primary'],
  },
  btnDisabled: { opacity: 0.5 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.xl, padding: Spacing.md,
  },
  errorText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'], flex: 1 },
  fullScreenLoader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000,
  },
  loaderContent: {
    alignItems: 'center', gap: Spacing.md,
    padding: Spacing.xl, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['surface-container-lowest'],
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 30, elevation: 12,
  },
  loaderRing: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  loaderRingImg: { width: 80, height: 80 },
  loaderIcon: { position: 'absolute' },
  loaderText: {
    fontSize: Typography['headline-sm'].fontSize, fontWeight: '600', color: Tokens['on-surface'],
    textAlign: 'center',
  },
  loaderSubtext: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    maxHeight: '80%', backgroundColor: Tokens['surface-container-lowest'],
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: {
    fontSize: Typography['headline-sm'].fontSize,
    fontWeight: Typography['headline-sm'].fontWeight as any,
    color: Tokens['on-surface'],
  },
  modalCloseBtn: { padding: 4 },
  pickerSearch: {
    height: 44, borderRadius: BorderRadius.lg, backgroundColor: Tokens['surface'],
    paddingHorizontal: Spacing.sm, fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface'],
  },
  pickerList: { maxHeight: 380 },
  pickerLoading: { padding: Spacing.lg, alignItems: 'center' },
  pickerEmpty: { padding: Spacing.lg, textAlign: 'center', color: Tokens['on-surface-variant'] },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'],
  },
  pickerRowTitle: { fontSize: Typography['body-md'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  pickerRowMeta: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'] },
  createCustomerIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Tokens['secondary-fixed'],
    alignItems: 'center', justifyContent: 'center',
  },
});