import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

type ToastType = 'success' | 'error' | 'info';

interface ToastConfig {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  destructive?: boolean;
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
  showConfirm: (config: ConfirmConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS: Record<ToastType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: 'checkmark-circle', color: '#16a34a' },
  error: { name: 'alert-circle', color: '#dc2626' },
  info: { name: 'information-circle', color: Tokens.secondary },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ config: ToastConfig; id: number } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  const idRef = useRef(0);
  const { t } = useTranslation();

  const showToast = useCallback((config: ToastConfig) => {
    const id = ++idRef.current;
    setToast({ config, id });

    translateY.setValue(-80);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    const duration = config.duration ?? 3500;
    setTimeout(() => {
      hideToast(id);
    }, duration);
  }, [opacity, translateY, hideToast]);

  const hideToast = useCallback((id?: number) => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(prev => prev && prev.id === id ? null : prev);
    });
  }, [opacity, translateY]);

  const showConfirm = useCallback((config: ConfirmConfig) => {
    setConfirm(config);
  }, []);

  const icon = toast ? TOAST_ICONS[toast.config.type] : null;

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {toast && icon && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => hideToast(toast.id)}
            style={styles.toastContent}
          >
            <View style={[styles.toastAccent, { backgroundColor: icon.color }]} />
            <Ionicons name={icon.name} size={22} color={icon.color} style={styles.toastIcon} />
            <View style={styles.toastText}>
              <Text style={styles.toastTitle}>{toast.config.title}</Text>
              {toast.config.message && (
                <Text style={styles.toastMessage}>{toast.config.message}</Text>
              )}
            </View>
            <Ionicons name="close" size={16} color={Tokens['on-surface-variant']} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {confirm && (
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={() => setConfirm(null)}
          />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons
                name={confirm.destructive ? 'warning' : 'help-circle'}
                size={28}
                color={confirm.destructive ? '#dc2626' : Tokens.secondary}
              />
            </View>
            <Text style={styles.confirmTitle}>{confirm.title}</Text>
            <Text style={styles.confirmMessage}>{confirm.message}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setConfirm(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>{confirm.cancelText || t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmOkBtn,
                  confirm.destructive && styles.confirmOkBtnDanger,
                ]}
                onPress={() => {
                  setConfirm(null);
                  confirm.onConfirm();
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.confirmOkText}>{confirm.confirmText || t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: Spacing['margin-mobile'],
    right: Spacing['margin-mobile'],
    zIndex: 9999,
    elevation: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
    minHeight: 56,
  },
  toastAccent: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.xl,
  },
  toastIcon: {
    marginLeft: Spacing.md,
  },
  toastText: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  toastTitle: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '600',
    color: Tokens['on-surface'],
  },
  toastMessage: {
    fontSize: Typography['body-md'].fontSize,
    color: Tokens['on-surface-variant'],
    marginTop: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  confirmCard: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: Tokens['surface-container-lowest'],
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 20,
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Tokens['surface-container-low'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmTitle: {
    fontSize: Typography['headline-sm'].fontSize,
    fontWeight: '600',
    color: Tokens['on-surface'],
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: Typography['body-md'].fontSize,
    color: Tokens['on-surface-variant'],
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Tokens['outline-variant'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '600',
    color: Tokens['on-surface-variant'],
  },
  confirmOkBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Tokens.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOkBtnDanger: {
    backgroundColor: '#dc2626',
  },
  confirmOkText: {
    fontSize: Typography['label-lg'].fontSize,
    fontWeight: '600',
    color: '#fff',
  },
});
