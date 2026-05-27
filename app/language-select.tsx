import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Redirect } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { changeLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
];

export default function LanguageSelectScreen() {
  const [selected, setSelected] = useState('en');
  const [ready, setReady] = useState(false);

  const fade = useSharedValue(0);
  const slide = useSharedValue(40);

  useEffect(() => {
    fade.value = withDelay(200, withTiming(1, { duration: 800 }));
    slide.value = withDelay(200, withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: slide.value }],
  }));

  const handleContinue = async () => {
    await changeLanguage(selected);
    setReady(true);
  };

  if (ready) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgGradient1} />
      <View style={styles.bgGradient2} />

      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Ionicons name="language" size={40} color={Tokens.secondary} />
          </View>
        </View>

        <Text style={styles.title}>Choose your language</Text>
        <Text style={styles.subtitle}>अपनी भाषा चुनें</Text>

        <View style={styles.options}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.option,
                selected === lang.code && styles.optionActive,
              ]}
              onPress={() => setSelected(lang.code)}
              activeOpacity={0.8}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionLabel, selected === lang.code && styles.optionLabelActive]}>
                  {lang.label}
                </Text>
                <Text style={[styles.optionNative, selected === lang.code && styles.optionNativeActive]}>
                  {lang.native}
                </Text>
              </View>
              {selected === lang.code && (
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark-circle" size={24} color={Tokens['on-primary']} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinue}
          activeOpacity={0.9}
        >
          <Text style={styles.continueText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.footer}>You can change this later in Settings</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Tokens.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bgGradient1: {
    position: 'absolute',
    top: -width * 0.25,
    left: -width * 0.25,
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: Tokens['surface-variant'],
    opacity: 0.2,
  },
  bgGradient2: {
    position: 'absolute',
    bottom: -width * 0.1,
    right: -width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: Tokens['secondary-container'],
    opacity: 0.2,
  },
  content: {
    paddingHorizontal: Spacing.gutter,
    width: '100%',
    alignItems: 'center',
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Tokens['secondary-container'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Tokens.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Tokens['surface-container-lowest'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography['headline-lg-mobile'].fontSize,
    lineHeight: Typography['headline-lg-mobile'].lineHeight,
    fontWeight: Typography['headline-lg-mobile'].fontWeight,
    fontFamily: Typography['headline-lg-mobile'].fontFamily,
    color: Tokens.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography['body-md'].fontSize,
    lineHeight: Typography['body-md'].lineHeight,
    color: Tokens['on-surface-variant'],
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  options: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Tokens['outline-variant'],
    backgroundColor: Tokens['surface-container-lowest'],
  },
  optionActive: {
    borderColor: Tokens.secondary,
    backgroundColor: Tokens['secondary-container'],
  },
  flag: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: Typography['body-lg'].fontSize,
    fontWeight: '600',
    color: Tokens['on-surface'],
  },
  optionLabelActive: {
    color: Tokens['on-secondary-container'],
  },
  optionNative: {
    fontSize: Typography['body-md'].fontSize,
    color: Tokens['on-surface-variant'],
    marginTop: 2,
  },
  optionNativeActive: {
    color: Tokens['on-secondary-container'],
    opacity: 0.8,
  },
  checkCircle: {
    marginLeft: Spacing.sm,
  },
  continueBtn: {
    width: '100%',
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: Tokens.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: Tokens.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  continueText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    fontSize: Typography['body-md'].fontSize,
    color: Tokens['on-surface-variant'],
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
