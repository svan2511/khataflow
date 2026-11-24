import { useEffect, useRef, useState } from 'react';
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

  const [language, setLanguage] = useState<Language>(() => (getCurrentLanguage() === 'en' ? 'en' : 'hi'));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
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
  const creatingRef = useRef(false);
  const creatingCustomerRef = useRef(false);

  const updateTranscript = (value: string) => {
    transcriptRef.current = value;
    setTranscript(value);
  };

  const updateInterim = (value: string) => {
    interimRef.current = value;
    setInterim(value);
  };

  useSpeechRecognitionEvent('start', () => setListening(true));

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    if (interimRef.current) {
      const pending = interimRef.current;
      updateInterim('');
      if (!transcriptRef.current) updateTranscript(pending);
    }
  });

  useSpeechRecognitionEvent('result', event => {
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (!text) return;
    if (event.isFinal) {
      updateInterim('');
      updateTranscript(transcriptRef.current ? `${transcriptRef.current} ${text}`.trim() : text);
    } else {
      updateInterim(text);
    }
  });

  useSpeechRecognitionEvent('error', event => {
    setListening(false);
    updateInterim('');
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
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
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
        contextualStrings: ['atta', 'doodh', 'chawal', 'dal', 'cheeni', 'udhaar', 'UPI', 'cash'],
      });
      setListening(true);
    } catch {
      setError(t('voice.recognitionFailed'));
    }
  };

  const applyResult = (data: VoiceParseResult) => {
    setParsedResult(data);
    setItems(
      data.items.map((item, index) => ({
        ...item,
        key: `${item.product_uuid ?? 'custom'}-${index}-${Date.now()}`,
      })),
    );
    setParsedCustomer(data.customer);
    setPayment(data.payment_method === 'mix' ? 'cash' : data.payment_method);
    setDiscount(data.discount);
  };

  const handleParse = async () => {
    const text = transcript.trim();
    if (text.length < 2) {
      setError(t('voice.speakFirst'));
      return;
    }
    if (!token) return;

    setParsing(true);
    setError('');
    setParsedResult(null);
    setItems([]);
    setParsedCustomer(null);
    setDiscount(null);

    try {
      const res = await api.parseVoiceBill(token, text, language);
      if (!res.data.items.length) {
        setError(t('voice.notUnderstood'));
        return;
      }
      applyResult(res.data);
    } catch (e) {
      try {
        const [productsRes, customersRes] = await Promise.all([
          api.searchProducts(token, undefined, 200),
          api.searchCustomers(token, undefined, 100),
        ]);
        const local = parseBillLocally(text, language, productsRes.data, customersRes.data);
        if (local.items.length) {
          applyResult(local);
        } else {
          setError(apiErrorMessage(e, t('voice.parseFailed')));
        }
      } catch {
        setError(apiErrorMessage(e, t('voice.parseFailed')));
      }
    } finally {
      setParsing(false);
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
  const canCreate =
    items.length > 0 &&
    notReadyCount === 0 &&
    (payment !== 'credit' || !!parsedCustomer) &&
    !creating;

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

  const handleCreate = async () => {
    if (creatingRef.current || !token) return;
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
    creatingRef.current = true;
    setCreating(true);
    setError('');
    try {
      const payload: any = {
        items: items.map(item => ({
          ...(item.product_uuid
            ? { product_uuid: item.product_uuid }
            : { product_name: item.name, unit_price: item.price }
          ),
          quantity: item.quantity,
          ...(item.gst_rate ? { gst_rate: item.gst_rate } : {}),
        })),
        payment_method: payment,
      };
      if (payment === 'credit') payload.paid_amount = 0;
      if (parsedCustomer?.uuid) payload.customer_uuid = parsedCustomer.uuid;
      if (discount) {
        payload.discount_type = discount.type;
        payload.discount_value = discount.value;
      }
      if (parsedResult?.notes) payload.notes = parsedResult.notes;

      const res = await api.createBill(token, payload);
      (router as any).replace({
        pathname: '/bill/success',
        params: { bill: JSON.stringify(res.data) },
      });
    } catch (e) {
      setError(apiErrorMessage(e, t('voice.createFailed')));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (items.length > 0 ? 170 : Spacing.xl) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
          <TouchableOpacity
            style={[styles.micButton, listening && styles.micButtonActive]}
            onPress={toggleListening}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={listening ? t('voice.tapToStop') : t('voice.tapToSpeak')}
          >
            <Ionicons name={listening ? 'stop' : 'mic'} size={40} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.micLabel, listening && styles.micLabelActive]}>
            {listening ? t('voice.listening') : t('voice.tapToSpeak')}
          </Text>
          {interim ? <Text style={styles.interimText}>{interim}</Text> : null}
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
            editable={!listening}
            value={transcript}
            onChangeText={updateTranscript}
            placeholder={t('voice.transcriptPlaceholder')}
            placeholderTextColor={Tokens['outline']}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.parseBtn, (parsing || transcript.trim().length < 2) && styles.btnDisabled]}
          onPress={handleParse}
          disabled={parsing || transcript.trim().length < 2}
          activeOpacity={0.9}
        >
          {parsing ? (
            <>
              <Loader size={18} color={Tokens['on-primary']} />
              <Text style={styles.parseBtnText}>{t('voice.parsing')}</Text>
            </>
          ) : (
            <>
              <Text style={styles.parseBtnText}>{t('voice.understand')}</Text>
              <Ionicons name="sparkles" size={18} color={Tokens['on-primary']} />
            </>
          )}
        </TouchableOpacity>

        {error && items.length === 0 ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={18} color={Tokens.tertiary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {items.length > 0 && (
          <View style={styles.draftSection}>
            <View style={styles.draftHeader}>
              <Text style={styles.sectionTitle}>{t('voice.draft')}</Text>
              <View style={styles.sourceBadge}>
                <Ionicons
                  name={parsedResult?.source === 'local' ? 'phone-portrait-outline' : 'sparkles'}
                  size={12}
                  color={Tokens['on-secondary-container']}
                />
                <Text style={styles.sourceBadgeText}>
                  {parsedResult?.source === 'local' ? t('voice.sourceLocal') : t('voice.sourceAi')}
                </Text>
              </View>
            </View>

            {parsedResult?.assistant_reply ? (
              <View style={styles.assistantCard}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={Tokens.secondary} />
                <Text style={styles.assistantText}>{parsedResult.assistant_reply}</Text>
              </View>
            ) : null}

            {items.map((item, index) => {
              const ready = isItemReady(item);
              return (
                <View key={item.key} style={styles.itemCard}>
                  <View style={[styles.itemStatus, ready ? styles.itemStatusOk : styles.itemStatusWarn]}>
                    <Ionicons
                      name={ready ? 'checkmark' : 'help'}
                      size={16}
                      color={ready ? Tokens.secondary : Tokens.tertiary}
                    />
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.resolved ? (
                      <Text style={styles.itemMeta}>
                        ₹{formatMoney(item.price)} / {item.unit}
                      </Text>
                    ) : (
                      <>
                        <TextInput
                          style={styles.priceInput}
                          value={item.priceText ?? (item.price > 0 ? String(item.price) : '')}
                          onChangeText={value => updatePrice(index, value)}
                          placeholder={t('voice.pricePlaceholder')}
                          placeholderTextColor={Tokens['on-surface-variant']}
                          keyboardType="decimal-pad"
                          maxLength={7}
                        />
                        <TouchableOpacity style={styles.chooseProductBtn} onPress={() => openPicker('product', index)}>
                          <Ionicons name="search" size={14} color={Tokens.secondary} />
                          <Text style={styles.chooseProductText}>{t('voice.chooseProduct')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  <View style={styles.itemRight}>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(index, -1)}>
                        <Ionicons name="remove" size={16} color={Tokens['on-surface']} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(index, 1)}>
                        <Ionicons name="add" size={16} color={Tokens['on-surface']} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.itemTotal}>₹{formatMoney(item.price * item.quantity)}</Text>
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(index)}>
                    <Ionicons name="close" size={16} color={Tokens['on-surface-variant']} />
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity style={styles.customerCard} onPress={() => openPicker('customer')}>
              <View style={styles.customerIcon}>
                <Ionicons name="person" size={18} color={Tokens.secondary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardLabel}>{t('voice.customer')}</Text>
                <Text style={styles.customerName} numberOfLines={1}>
                  {parsedCustomer?.name || t('bill.walkInCustomer')}
                </Text>
              </View>
              <Text style={styles.changeCustomerText}>
                {parsedCustomer ? t('voice.changeCustomer') : t('voice.addCustomer')}
              </Text>
            </TouchableOpacity>

            <View style={styles.paymentCard}>
              <Text style={styles.cardLabel}>{t('voice.payment')}</Text>
              <View style={styles.paymentGrid}>
                {PAYMENT_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.paymentOption, payment === option.key && styles.paymentOptionActive]}
                    onPress={() => setPayment(option.key)}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={payment === option.key ? Tokens['on-primary'] : Tokens['on-surface-variant']}
                    />
                    <Text style={[styles.paymentLabel, payment === option.key && styles.paymentLabelActive]}>
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {payment === 'credit' && !parsedCustomer ? (
                <View style={styles.udhaarActions}>
                  <View style={styles.customerHint}>
                    <Ionicons name="alert-circle-outline" size={14} color={Tokens.tertiary} />
                    <Text style={styles.customerHintText}>
                      {customerName
                        ? t('voice.customerNotFound', { name: customerName })
                        : t('voice.udhaarNeedsCustomer')}
                    </Text>
                  </View>
                  <View style={styles.udhaarActionRow}>
                    {customerName ? (
                      <TouchableOpacity
                        style={styles.udhaarBtn}
                        onPress={() => createCustomer()}
                        disabled={creatingCustomer}
                      >
                        {creatingCustomer ? (
                          <Loader size={20} color={Tokens['on-primary']} />
                        ) : (
                          <>
                            <Ionicons name="person-add" size={16} color={Tokens['on-primary']} />
                            <Text style={styles.udhaarBtnText} numberOfLines={1}>
                              {t('voice.createCustomer')}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.udhaarBtnOutline} onPress={() => openPicker('customer')}>
                      <Text style={styles.udhaarBtnOutlineText}>
                        {customerName ? t('voice.selectExisting') : t('voice.chooseOrCreateCustomer')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            {discount ? (
              <View style={styles.discountRow}>
                <Ionicons name="pricetag" size={16} color={Tokens.tertiary} />
                <Text style={styles.discountText}>
                  {discount.type === 'percentage'
                    ? t('voice.discountPercent', { value: discount.value })
                    : t('voice.discountFixed', { value: formatMoney(discount.value) })}
                </Text>
                <TouchableOpacity onPress={() => setDiscount(null)}>
                  <Text style={styles.discountClear}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('bill.subtotal')}</Text>
                <Text style={styles.summaryValue}>₹{formatMoney(subtotal)}</Text>
              </View>
              {discountAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('bill.discount')}</Text>
                  <Text style={[styles.summaryValue, { color: Tokens.secondary }]}>
                    -₹{formatMoney(discountAmount)}
                  </Text>
                </View>
              )}
              {taxAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('bill.gst')}</Text>
                  <Text style={styles.summaryValue}>₹{formatMoney(taxAmount)}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>{t('bill.grandTotal')}</Text>
                <Text style={styles.totalValue}>₹{formatMoney(grandTotal)}</Text>
              </View>
            </View>

            {notReadyCount > 0 ? (
              <View style={styles.unresolvedHint}>
                <Ionicons name="information-circle-outline" size={16} color={Tokens.tertiary} />
                <Text style={styles.unresolvedHintText}>
                  {t('voice.unresolvedHint', { count: notReadyCount })}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {items.length > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          {error ? (
            <Text style={styles.bottomError} numberOfLines={2}>
              {error}
            </Text>
          ) : null}
          <View style={styles.bottomRow}>
            <View style={styles.bottomSummary}>
              <Text style={styles.bottomLabel}>{t('bill.amountToCollect')}</Text>
              <Text style={styles.bottomAmount}>₹{formatMoney(grandTotal)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.createBtn, (!canCreate || creating) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={!canCreate || creating}
              activeOpacity={0.9}
            >
              {creating ? (
                <Loader size={20} color={Tokens['on-primary']} />
              ) : (
                <>
                  <Text style={styles.createBtnText}>{t('voice.createBill')}</Text>
                  <Ionicons name="checkmark-circle" size={18} color={Tokens['on-primary']} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

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
    width: 96, height: 96, borderRadius: 48, backgroundColor: Tokens['primary-container'],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Tokens['primary-container'], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
  },
  micButtonActive: { backgroundColor: '#dc2626', shadowColor: '#dc2626' },
  micLabel: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-surface-variant'],
  },
  micLabelActive: { color: '#dc2626' },
  interimText: {
    fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'],
    fontStyle: 'italic', textAlign: 'center', paddingHorizontal: Spacing.md,
  },
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
  draftSection: { gap: Spacing.sm },
  draftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: Typography['headline-sm'].fontSize,
    fontWeight: Typography['headline-sm'].fontWeight as any,
    color: Tokens['on-surface'],
  },
  sourceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Tokens['secondary-container'], borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sourceBadgeText: {
    fontSize: 10, fontWeight: '700', color: Tokens['on-secondary-container'],
    textTransform: 'uppercase',
  },
  assistantCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Tokens['secondary-container'], borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
  },
  assistantText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-secondary-container'], flex: 1 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 1,
  },
  itemStatus: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  itemStatusOk: { backgroundColor: Tokens['secondary-fixed'] },
  itemStatusWarn: { backgroundColor: Tokens['tertiary-fixed'] },
  itemBody: { flex: 1, minWidth: 0, gap: 2 },
  itemName: { fontSize: Typography['body-md'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  itemMeta: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'] },
  priceInput: {
    height: 38, borderRadius: BorderRadius.lg, backgroundColor: Tokens['surface'],
    paddingHorizontal: Spacing.sm, fontSize: Typography['body-md'].fontSize,
    color: Tokens['on-surface'], borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  chooseProductBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  chooseProductText: { fontSize: Typography['label-md'].fontSize, fontWeight: '600', color: Tokens.secondary },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Tokens['surface-container'],
    alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: Typography['body-md'].fontSize, fontWeight: '600', color: Tokens['on-surface'], minWidth: 20, textAlign: 'center' },
  itemTotal: { fontSize: Typography['body-md'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  removeBtn: { padding: 4 },
  customerCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 1,
  },
  customerIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: Tokens['secondary-fixed'],
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'] },
  customerName: { fontSize: Typography['body-lg'].fontSize, fontWeight: '600', color: Tokens['on-surface'] },
  changeCustomerText: { fontSize: Typography['label-md'].fontSize, fontWeight: '600', color: Tokens.secondary },
  paymentCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.sm, gap: Spacing.sm,
  },
  paymentGrid: { flexDirection: 'row', gap: 6 },
  paymentOption: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8,
    borderRadius: BorderRadius.lg, backgroundColor: Tokens['surface-container-low'],
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  paymentOptionActive: {
    backgroundColor: Tokens['primary-container'], borderColor: Tokens['primary-container'],
  },
  paymentLabel: {
    fontSize: Typography['label-md'].fontSize,
    fontWeight: Typography['label-md'].fontWeight as any,
    color: Tokens['on-surface-variant'],
  },
  paymentLabelActive: { color: Tokens['on-primary'] },
  customerHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.lg, padding: 8,
  },
  customerHintText: {
    fontSize: Typography['label-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'], flex: 1,
  },
  udhaarActions: { gap: 6 },
  udhaarActionRow: { flexDirection: 'row', gap: 6 },
  udhaarBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 40, borderRadius: BorderRadius.lg, backgroundColor: Tokens['primary-container'],
    paddingHorizontal: Spacing.sm,
  },
  udhaarBtnText: {
    fontSize: Typography['label-md'].fontSize, fontWeight: '600',
    color: Tokens['on-primary'], flexShrink: 1,
  },
  udhaarBtnOutline: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 40, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  udhaarBtnOutlineText: {
    fontSize: Typography['label-md'].fontSize, fontWeight: '600', color: Tokens['on-surface-variant'],
  },
  discountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.xl, padding: Spacing.sm,
  },
  discountText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'], flex: 1 },
  discountClear: { fontSize: Typography['label-md'].fontSize, fontWeight: '700', color: Tokens.tertiary },
  summaryCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, gap: 6,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'] },
  summaryValue: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'] },
  totalRow: {
    borderTopWidth: 1, borderTopColor: Tokens['outline-variant'], paddingTop: 6, marginTop: 2,
  },
  totalLabel: { fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'] },
  totalValue: { fontSize: Typography['headline-md'].fontSize, fontWeight: '700', color: Tokens.secondary },
  unresolvedHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.lg, padding: Spacing.sm,
  },
  unresolvedHintText: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'], flex: 1 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Tokens['surface-container-lowest'],
    paddingHorizontal: Spacing.gutter, paddingTop: Spacing.sm, gap: 6,
    borderTopWidth: 1, borderTopColor: Tokens['outline-variant'],
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bottomError: {
    fontSize: Typography['label-md'].fontSize, color: Tokens.error,
  },
  bottomSummary: { flex: 1 },
  bottomLabel: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-surface-variant'] },
  bottomAmount: {
    fontSize: Typography['headline-sm'].fontSize, fontWeight: '700', color: Tokens['on-surface'],
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['primary-container'],
  },
  createBtnText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-primary'],
  },
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

