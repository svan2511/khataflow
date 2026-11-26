import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api, apiErrorMessage, type VoiceParseResult } from '@/lib/api';
import { parseBillLocally } from '@/lib/voice-parser';
import { useBill } from '@/lib/bill-context';
import { getCurrentLanguage } from '@/lib/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTEXTUAL_STRINGS = [
  'chai', 'tea', 'paratha', 'prantha', 'roti', 'lassi', 'raita', 'momos',
  'atta', 'doodh', 'chawal', 'dal', 'cheeni', 'udhaar', 'UPI', 'cash',
];

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

  const [language, setLanguage] = useState<'hi' | 'en'>(() => (getCurrentLanguage() === 'en' ? 'en' : 'hi'));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('');
  const [error, setError] = useState('');

  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const parsingRef = useRef(false);
  const speechErrorRef = useRef(false);
  const mountedRef = useRef(true);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const loaderRingAnim1 = useRef(new Animated.Value(0)).current;
  const loaderRingAnim2 = useRef(new Animated.Value(0)).current;
  const loaderRingAnim3 = useRef(new Animated.Value(0)).current;
  const loaderPulseAnim = useRef(new Animated.Value(0)).current;
  const loaderTextAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const micPressAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;

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
    }).start(({ finished }) => {
      if (finished && listening) startPulseAnimation();
    });
  }, [listening]);

  const startLoaderAnimations = useCallback(() => {
    loaderRingAnim1.setValue(0);
    Animated.timing(loaderRingAnim1, {
      toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true,
    }).start(({ finished }) => { if (finished && processing) startLoaderAnimations(); });

    loaderRingAnim2.setValue(0);
    Animated.timing(loaderRingAnim2, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }).start();

    loaderRingAnim3.setValue(0);
    Animated.timing(loaderRingAnim3, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }).start();

    loaderPulseAnim.setValue(0);
    Animated.timing(loaderPulseAnim, {
      toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        loaderPulseAnim.setValue(0);
        Animated.timing(loaderPulseAnim, {
          toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }).start();
      }
    });

    loaderTextAnim.setValue(0);
    Animated.timing(loaderTextAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [processing]);

  const showLoader = useCallback((text: string) => {
    setProcessingText(text);
    setProcessing(true);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();
    startLoaderAnimations();
  }, [startLoaderAnimations]);

  const hideLoader = useCallback(() => {
    loaderRingAnim1.stopAnimation();
    loaderRingAnim2.stopAnimation();
    loaderRingAnim3.stopAnimation();
    loaderPulseAnim.stopAnimation();
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setProcessing(false);
    });
  }, []);

  const goToReview = useCallback((data: VoiceParseResult) => {
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
        ? { uuid: data.customer.uuid, name: data.customer.name, phone: data.customer.phone ?? undefined }
        : null,
    );
    const modeMap: Record<VoiceParseResult['payment_method'], string> = {
      cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Udhaar', mix: 'Cash',
    };
    const mode = data.payment_method === 'credit' && !data.customer ? 'Cash' : modeMap[data.payment_method] ?? 'Cash';
    setBillPaymentMode(mode);
    setBillDiscount(data.discount ? { type: data.discount.type, value: data.discount.value } : null);
    setBillNotes(data.notes ?? '');
    router.replace('/bill/review');
  }, [addItem, resetBill, setBillCustomer, setBillDiscount, setBillNotes, setBillPaymentMode]);

  const unresolvedNames = (data: VoiceParseResult) =>
    data.items
      .filter(item => !item.resolved || !item.product_uuid)
      .map(item => item.spoken_name || item.name)
      .filter(Boolean);

  const parseText = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (text.length < 2) { setError(t('voice.speakFirst')); return; }
    if (!token || parsingRef.current) return;

    parsingRef.current = true;
    setError('');
    showLoader(t('voice.understandingBill'));

    try {
      const res = await api.parseVoiceBill(token, text, language, true);
      if (!mountedRef.current) return;
      const missing = unresolvedNames(res.data);
      if (missing.length > 0) { hideLoader(); setError(t('voice.itemsNotFound', { items: missing.join(', ') })); return; }
      hideLoader();
      goToReview(res.data);
    } catch (e) {
      try {
        const [productsRes, customersRes] = await Promise.all([
          api.searchProducts(token, undefined, 100),
          api.searchCustomers(token, undefined, 100),
        ]);
        if (!mountedRef.current) return;
        const local = parseBillLocally(text, language, productsRes.data, customersRes.data);
        const missing = unresolvedNames(local);
        if (local.items.length > 0 && missing.length === 0) { hideLoader(); goToReview(local); }
        else { hideLoader(); setError(missing.length > 0 ? t('voice.itemsNotFound', { items: missing.join(', ') }) : apiErrorMessage(e, t('voice.parseFailed'))); }
      } catch {
        if (mountedRef.current) { hideLoader(); setError(apiErrorMessage(e, t('voice.parseFailed'))); }
      }
    } finally { parsingRef.current = false; }
  }, [token, language, t, showLoader, hideLoader, goToReview]);

  useSpeechRecognitionEvent('start', () => {
    speechErrorRef.current = false;
    setListening(true);
    startPulseAnimation();
    Animated.timing(waveAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
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

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    pulseAnim.stopAnimation();
    waveAnim.stopAnimation();
    waveAnim.setValue(0);
    if (interimRef.current) {
      const pending = interimRef.current;
      updateInterim('');
      updateTranscript(transcriptRef.current ? `${transcriptRef.current} ${pending}`.trim() : pending);
    }
    if (!mountedRef.current || speechErrorRef.current) return;
    const text = transcriptRef.current.trim();
    if (text.length >= 2) void parseText(text);
  });

  useSpeechRecognitionEvent('error', event => {
    speechErrorRef.current = true;
    setListening(false);
    updateInterim('');
    waveAnim.stopAnimation();
    waveAnim.setValue(0);
    const code = event.error;
    if (code === 'aborted') return;
    if (code === 'no-speech' || code === 'speech-timeout') setError(t('voice.noSpeech'));
    else if (code === 'not-allowed' || code === 'service-not-allowed') setError(t('voice.micPermissionMessage'));
    else if (code === 'network') setError(t('voice.speechNetworkError'));
    else if (code === 'language-not-supported') setError(t('voice.languageNotSupported'));
    else setError(t('voice.recognitionFailed'));
  });

  useEffect(() => {
    mountedRef.current = true;
    Animated.timing(heroAnim, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return () => {
      mountedRef.current = false;
      pulseAnim.stopAnimation();
      loaderRingAnim1.stopAnimation();
      loaderRingAnim2.stopAnimation();
      loaderRingAnim3.stopAnimation();
      loaderPulseAnim.stopAnimation();
      waveAnim.stopAnimation();
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
    };
  }, []);

  const startNewCapture = () => {
    updateTranscript('');
    updateInterim('');
    setError('');
  };

  const toggleListening = async () => {
    if (listening) {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
      setListening(false);
      return;
    }
    if (processing) return;
    startNewCapture();
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
        interimResults: true, continuous: false, maxAlternatives: 1, addsPunctuation: true,
        contextualStrings: CONTEXTUAL_STRINGS,
      });
      setListening(true);
    } catch { setError(t('voice.recognitionFailed')); }
  };

  const micScale = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] });
  const micPressScale = micPressAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const micShadow = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [20, 30, 20] });
  const micShadowOpacity = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.4, 0.2] });
  const waveOpacity = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
  const waveScale = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const waveOpacity2 = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.36, 0] });
  const waveScale2 = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.53] });
  const waveOpacity3 = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0] });
  const waveScale3 = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.26] });

  const ring1Scale = loaderRingAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] });
  const ring1Opacity = loaderRingAnim1.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.4, 0] });
  const ring2Scale = loaderRingAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] });
  const ring2Opacity = loaderRingAnim2.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.3, 0] });
  const ring3Scale = loaderRingAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] });
  const ring3Opacity = loaderRingAnim3.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.2, 0] });
  const pulseScale = loaderPulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] });
  const pulseOpacity = loaderPulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.6, 0.3] });
  const textOpacity = loaderTextAnim;
  const textTranslateY = loaderTextAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const heroFade = heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const heroTranslateY = heroAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });

  const canUnderstand = transcript.trim().length > 0 && !listening && !processing;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Animated Background Blobs */}
      <Animated.View style={[styles.bgBlob1, { opacity: heroFade }]} />
      <Animated.View style={[styles.bgBlob2, { opacity: heroFade }]} />

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
        <Animated.View
          style={[
            styles.heroCard,
            { opacity: heroFade, transform: [{ translateY: heroTranslateY }] }
          ]}
        >
          <View style={styles.heroIconWrap}>
            <Ionicons name="mic" size={28} color={Tokens.secondary} />
          </View>
          <Text style={styles.heroTitle}>{t('voice.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('voice.heroSubtitle')}</Text>
          <View style={styles.exampleChip}>
            <Ionicons name="bulb-outline" size={14} color={Tokens.tertiary} />
            <Text style={styles.exampleText}>{t('voice.example')}</Text>
          </View>
        </Animated.View>

        <View style={styles.micSection}>
          {/* Sound waves when listening */}
          {listening && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.soundWave,
                  { opacity: waveOpacity, transform: [{ scale: waveScale }] }
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.soundWave,
                  { opacity: waveOpacity2, transform: [{ scale: waveScale2 }] }
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.soundWave,
                  { opacity: waveOpacity3, transform: [{ scale: waveScale3 }] }
                ]}
              />
            </>
          )}

          <Animated.View style={[styles.micButton, { transform: [{ scale: micPressScale }] }]}>
            <TouchableOpacity
              style={styles.micButtonInner}
              onPress={toggleListening}
              onPressIn={() => Animated.timing(micPressAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start()}
              onPressOut={() => Animated.timing(micPressAnim, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()}
              onLongPress={toggleListening}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={listening ? t('voice.tapToStop') : t('voice.tapToSpeak')}
              disabled={processing}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Ionicons name={listening ? 'stop' : 'mic'} size={42} color="#fff" />
            </TouchableOpacity>
            {listening && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  { transform: [{ scale: micScale }] }
                ]}
              />
            )}
            <Animated.View
              style={[
                styles.micGlow,
                { shadowRadius: micShadow, shadowOpacity: micShadowOpacity }
              ]}
            />
          </Animated.View>

          <Text style={[styles.micLabel, listening && styles.micLabelActive]}>
            {listening ? t('voice.listening') : t('voice.tapToSpeak')}
          </Text>
          {interim && !processing && <Text style={styles.interimText}>{interim}</Text>}
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

        {canUnderstand && (
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
          <Animated.View style={styles.loaderRingContainer}>
            <Animated.View style={[styles.loaderRing, { transform: [{ scale: ring1Scale }], opacity: ring1Opacity }]} />
            <Animated.View style={[styles.loaderRing, { transform: [{ scale: ring2Scale }], opacity: ring2Opacity }]} />
            <Animated.View style={[styles.loaderRing, { transform: [{ scale: ring3Scale }], opacity: ring3Opacity }]} />
          </Animated.View>

          <Animated.View style={styles.loaderCenter}>
            <Animated.View style={[styles.loaderPulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
            <Ionicons name="mic-circle" size={52} color={Tokens.secondary} style={styles.loaderIcon} />
          </Animated.View>

          <Animated.View style={[styles.loaderTextWrapper, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
            <Text style={styles.loaderText}>{processingText}</Text>
            <Text style={styles.loaderSubtext}>{t('voice.pleaseWait')}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Tokens.background },
  bgBlob1: {
    position: 'absolute', top: -120, right: -80, width: 280, height: 280,
    borderRadius: 140, backgroundColor: Tokens['primary-container'],
    opacity: 0.15, zIndex: 0,
  },
  bgBlob2: {
    position: 'absolute', bottom: -100, left: -60, width: 220, height: 220,
    borderRadius: 110, backgroundColor: Tokens['secondary-container'],
    opacity: 0.12, zIndex: 0,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, height: 56, backgroundColor: Tokens.surface,
    borderBottomWidth: 1, borderBottomColor: Tokens['outline-variant'], zIndex: 10,
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
  scrollContent: { padding: Spacing.gutter, gap: Spacing.lg, zIndex: 5 },
  heroCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.lg, gap: Spacing.sm,
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 4,
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 18, backgroundColor: Tokens['secondary-fixed'],
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs, alignSelf: 'center',
  },
  heroTitle: {
    fontSize: Typography['headline-lg'].fontSize,
    fontWeight: Typography['headline-lg'].fontWeight as any,
    color: Tokens['on-surface'], textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: { fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface-variant'], textAlign: 'center', lineHeight: 24 },
  exampleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.xs,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignSelf: 'center',
  },
  exampleText: { fontSize: Typography['label-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'] },
  micSection: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, zIndex: 10 },
  soundWave: {
    position: 'absolute', top: '50%', marginTop: -56,
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 2, borderColor: Tokens.secondary,
    alignSelf: 'center',
    zIndex: 1,
  },
  micButton: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: Tokens.secondary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0, shadowRadius: 0, elevation: 0,
    zIndex: 10,
  },
  micButtonInner: {
    width: '100%', height: '100%', borderRadius: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute', top: -12, left: -12, right: -12, bottom: -12,
    borderRadius: 68, borderWidth: 2, borderColor: Tokens.secondary,
  },
  micGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 56,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 0 },
  },
  micLabel: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-surface-variant'],
  },
  micLabelActive: { color: Tokens.secondary, fontWeight: '700' },
  interimText: {
    fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'],
    fontStyle: 'italic', textAlign: 'center', paddingHorizontal: Spacing.md,
  },
  transcriptCard: {
    backgroundColor: Tokens['surface-container-lowest'], borderRadius: BorderRadius.xl,
    padding: Spacing.md, gap: Spacing.sm,
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 3,
    borderWidth: 1, borderColor: Tokens['outline-variant'],
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
    minHeight: 96, fontSize: Typography['body-lg'].fontSize, color: Tokens['on-surface'],
    backgroundColor: Tokens['surface'], borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  parseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, borderRadius: BorderRadius.xl, backgroundColor: Tokens.secondary,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  parseBtnManual: { marginTop: Spacing.sm },
  parseBtnText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: Typography['label-lg'].fontWeight as any,
    color: Tokens['on-primary'],
  },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Tokens['tertiary-fixed'], borderRadius: BorderRadius.xl, padding: Spacing.md,
  },
  errorText: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-tertiary-fixed-variant'], flex: 1 },
  fullScreenLoader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000,
  },
  loaderContent: {
    alignItems: 'center', gap: Spacing.lg,
    padding: Spacing.xl, borderRadius: BorderRadius.xl,
    backgroundColor: Tokens['surface-container-lowest'],
    shadowColor: Tokens['surface-tint'], shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 40, elevation: 16,
    borderWidth: 1, borderColor: Tokens['outline-variant'],
  },
  loaderRingContainer: { position: 'relative', width: 120, height: 120 },
  loaderRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 60, borderWidth: 3, borderColor: Tokens.secondary,
  },
  loaderCenter: { position: 'relative', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  loaderPulseRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 36, borderWidth: 2, borderColor: Tokens.secondary,
  },
  loaderIcon: { zIndex: 1 },
  loaderTextWrapper: { alignItems: 'center', gap: Spacing.xs },
  loaderText: {
    fontSize: Typography['headline-sm'].fontSize, fontWeight: '600', color: Tokens['on-surface'],
    textAlign: 'center',
  },
  loaderSubtext: { fontSize: Typography['body-md'].fontSize, color: Tokens['on-surface-variant'], textAlign: 'center' },
});