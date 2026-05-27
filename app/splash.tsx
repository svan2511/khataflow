import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { Redirect } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing } from 'react-native-reanimated';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { token, user, isLoading } = useAuth();
  const { t } = useTranslation();
  const canNavigateRef = useRef(false);
  const [ready, setReady] = useState(false);

  const ringScale = useSharedValue(1.4);
  const ringOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.6);
  const logoFade = useSharedValue(0);
  const textFade = useSharedValue(0);
  const textSlide = useSharedValue(30);
  const tagFade = useSharedValue(0);
  const tagSlide = useSharedValue(20);
  const footerFade = useSharedValue(0);
  const footerSlide = useSharedValue(20);

  useEffect(() => {
    if (isLoading) return;
    canNavigateRef.current = true;

    logoFade.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 70, mass: 1 });

    ringScale.value = withDelay(400, withTiming(1.6, { duration: 1000 }));
    ringOpacity.value = withDelay(400, withTiming(0.5, { duration: 300 }));
    ringOpacity.value = withDelay(700, withTiming(0, { duration: 700 }));

    textFade.value = withDelay(1000, withTiming(1, { duration: 700 }));
    textSlide.value = withDelay(1000, withTiming(0, { duration: 700, easing: Easing.out(Easing.ease) }));

    tagFade.value = withDelay(1500, withTiming(1, { duration: 600 }));
    tagSlide.value = withDelay(1500, withTiming(0, { duration: 600 }));

    footerFade.value = withDelay(2100, withTiming(1, { duration: 600 }));
    footerSlide.value = withDelay(2100, withTiming(0, { duration: 600 }));

    const animTimer = setTimeout(() => setReady(true), 3800);
    const safetyTimer = setTimeout(() => setReady(true), 5000);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(safetyTimer);
    };
  }, [isLoading]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoFade.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textFade.value,
    transform: [{ translateY: textSlide.value }],
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagFade.value,
    transform: [{ translateY: tagSlide.value }],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerFade.value,
    transform: [{ translateY: footerSlide.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.bgGradient1} />
      <View style={styles.bgGradient2} />

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <View style={styles.logoBox}>
          <Image source={require('../assets/images/logo.png')} style={{ width: 120, height: 120, borderRadius: 10 }} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.ring, ringStyle]} />
      </Animated.View>

      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.title}>KhataFlow</Text>
      </Animated.View>

      <Animated.View style={[styles.tagBlock, tagStyle]}>
        <Text style={styles.tagline}>{t('splash.tagline')}</Text>
      </Animated.View>

      <Animated.View style={[styles.footer, footerStyle]}>
        <Text style={styles.version}>{t('splash.version')}</Text>
      </Animated.View>

      {ready && canNavigateRef.current && (
        token && user ? (
          user.has_shop ? <Redirect href="/(tabs)" /> : <Redirect href="/shop-setup" />
        ) : (
          <Redirect href="/language-select" />
        )
      )}
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
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.xl,
    shadowColor: Tokens.secondary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  logoBox: {
    width: 140,
    height: 140,
    backgroundColor: Tokens['primary-container'],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  ring: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: BorderRadius.xl + 8,
    borderWidth: 2.5,
    borderColor: Tokens.secondary,
  },
  textBlock: {
    marginTop: Spacing.lg,
  },
  title: {
    fontSize: Typography['headline-xl'].fontSize,
    lineHeight: Typography['headline-xl'].lineHeight,
    fontWeight: Typography['headline-xl'].fontWeight,
    fontFamily: Typography['headline-xl'].fontFamily,
    color: Tokens.primary,
    letterSpacing: -0.5,
  },
  tagBlock: {
    marginTop: Spacing.sm,
  },
  tagline: {
    fontSize: Typography['body-lg-mobile'].fontSize,
    lineHeight: Typography['body-lg-mobile'].lineHeight,
    fontWeight: Typography['body-lg-mobile'].fontWeight,
    fontFamily: Typography['body-lg-mobile'].fontFamily,
    color: Tokens['on-surface-variant'],
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: Spacing['margin-mobile'],
  },
  version: {
    fontSize: Typography['label-md'].fontSize,
    lineHeight: Typography['label-md'].lineHeight,
    fontWeight: Typography['label-md'].fontWeight,
    fontFamily: Typography['label-md'].fontFamily,
    color: Tokens.outline,
  },
});
