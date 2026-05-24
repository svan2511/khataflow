import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast-provider';
import Loader from '@/components/Loader';

const OTP_TIMER = 30;

export default function LoginScreen() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<TextInput[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { signIn } = useAuth();
  const { showToast } = useToast();

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimer(OTP_TIMER);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (step === 'otp') {
      startTimer();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [step, startTimer]);

  const handleSendOtp = async () => {
    if (mobile.length !== 10) return;
    setLoading(true);
    try {
      await api.register(mobile);
      setStep('otp');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to send OTP', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setLoading(true);
    try {
      await api.register(mobile);
      startTimer();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to resend OTP', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) return;

    setOtpLoading(true);
    try {
      const signedInUser = await signIn(mobile, otpString);
      router.replace(signedInUser.has_shop ? '/(tabs)' : '/shop-setup');
    } catch (err: any) {
      showToast({ type: 'error', title: 'OTP verification failed', message: err.message });
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
  };

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.card}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Tokens.secondary} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <View style={styles.iconInner}>
                <Ionicons name="lock-closed" size={28} color={Tokens.secondary} />
              </View>
            </View>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.description}>
              Enter the 6-digit code sent to{' '}
              <Text style={styles.phoneHighlight}>+91 {mobile}</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { otpRefs.current[index] = ref as TextInput; }}
                  style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.verifyButton,
                otp.join('').length !== 6 && styles.buttonDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={otpLoading || otp.join('').length !== 6}
              activeOpacity={0.9}
            >
              {otpLoading ? (
                <Loader size={20} color="#fff" />
              ) : (
                <>
                  <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.resendSection}>
            {timer > 0 ? (
              <View style={styles.resendRow}>
                <Ionicons name="time-outline" size={16} color={Tokens['on-surface-variant']} />
                <Text style={styles.resendTimer}>
                  Resend in <Text style={styles.resendTimerBold}>{timer}s</Text>
                </Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleResendOtp} disabled={loading} style={styles.resendBtn}>
                {loading ? (
                  <Loader size={18} color={Tokens.secondary} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color={Tokens.secondary} />
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.brandBar}>
        <View style={styles.brandBadge}>
          <Ionicons name="storefront" size={18} color={Tokens['on-secondary-container']} />
        </View>
        <Text style={styles.brandName}>KhataFlow</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.headerSection}>
          <View style={styles.iconCircle}>
            <View style={styles.iconInner}>
              <Ionicons name="phone-portrait-outline" size={28} color={Tokens.secondary} />
            </View>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.description}>
            Enter your mobile number to access your store.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={[styles.inputContainer, mobile.length > 0 && styles.inputContainerFocused]}>
            <View style={styles.countryCode}>
              <Ionicons name="call-outline" size={16} color={Tokens.secondary} />
              <View style={styles.divider} />
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit number"
              placeholderTextColor={Tokens.outline}
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={setMobile}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.verifyButton,
              (mobile.length !== 10 || loading) && styles.buttonDisabled,
            ]}
            onPress={handleSendOtp}
            disabled={loading || mobile.length !== 10}
            activeOpacity={0.9}
          >
            {loading ? (
              <Loader size={20} color="#fff" />
            ) : (
              <>
                <Text style={styles.verifyButtonText}>Get OTP</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.supportSection}>
          <Text style={styles.supportText}>
            Need help?{' '}
            <Text style={styles.supportLink}>Contact Support</Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Tokens.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['margin-mobile'],
    paddingVertical: Spacing.lg,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  brandBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Tokens['secondary-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '700',
    color: Tokens.secondary,
    letterSpacing: 0.3,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Tokens.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens['surface-container-low'],
    marginBottom: Spacing.md,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Tokens['secondary-container'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Tokens['surface-container-lowest'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography['headline-lg-mobile'].fontSize,
    lineHeight: Typography['headline-lg-mobile'].lineHeight,
    fontWeight: Typography['headline-lg-mobile'].fontWeight,
    color: Tokens.primary,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: Typography['body-md'].fontSize,
    lineHeight: Typography['body-md'].lineHeight,
    color: Tokens['on-surface-variant'],
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  phoneHighlight: {
    fontWeight: '600',
    color: Tokens.secondary,
  },
  form: {
    gap: Spacing.md,
  },
  label: {
    fontSize: Typography['label-md'].fontSize,
    fontWeight: '600',
    color: Tokens['on-surface-variant'],
    marginLeft: 2,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
    borderRadius: BorderRadius.lg,
    backgroundColor: Tokens['surface-container-lowest'],
  },
  inputContainerFocused: {
    borderColor: Tokens.secondary,
    borderWidth: 1.5,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    height: '100%',
  },
  countryCodeText: {
    fontSize: Typography['body-md'].fontSize,
    fontWeight: '600',
    color: Tokens['on-surface'],
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Tokens['outline-variant'],
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: Typography['body-lg'].fontSize,
    color: Tokens['on-surface'],
    paddingRight: Spacing.md,
    paddingLeft: Spacing.sm,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: Tokens['outline-variant'],
    borderRadius: BorderRadius.lg,
    backgroundColor: Tokens['surface-container-lowest'],
    fontSize: Typography['headline-md'].fontSize,
    fontWeight: '700',
    color: Tokens['on-surface'],
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: Tokens.secondary,
    backgroundColor: Tokens['secondary-container'],
  },
  button: {
    height: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  verifyButton: {
    backgroundColor: Tokens.secondary,
    shadowColor: Tokens.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  verifyButtonText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '600',
    color: '#fff',
  },
  resendSection: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendTimer: {
    fontSize: Typography['body-md'].fontSize,
    color: Tokens['on-surface-variant'],
  },
  resendTimerBold: {
    fontWeight: '700',
    color: Tokens.secondary,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  resendText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '600',
    color: Tokens.secondary,
  },
  supportSection: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  supportText: {
    fontSize: Typography['body-md'].fontSize,
    color: Tokens['on-surface-variant'],
  },
  supportLink: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '600',
    color: Tokens.secondary,
    textDecorationLine: 'underline',
  },
});
