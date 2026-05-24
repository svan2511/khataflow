import { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Tokens, Spacing } from '@/constants/theme';
import Loader from '@/components/Loader';
import FullScreenLoader from '@/components/FullScreenLoader';
import { useAuth } from '@/lib/auth-context';
import { api, type SyncStatusData } from '@/lib/api';
import { useToast } from '@/components/toast-provider';

const SYNC_CACHE_KEY = 'sync_status_cache';

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;

    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

export default function SyncScreen() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const { token } = useAuth();
  const { showToast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSyncStatus = useCallback(async (showLoader = false) => {
    if (!token) return;
    if (showLoader) setSyncing(true);

    try {
      const response = await api.getSyncStatus(token);
      setSyncStatus(response.data);
      setIsOnline(true);
      await SecureStore.setItemAsync(SYNC_CACHE_KEY, JSON.stringify(response.data));
      if (showLoader) {
        showToast({ type: 'success', title: 'Sync completed', duration: 1500 });
      }
    } catch {
      setIsOnline(false);
      if (showLoader) {
        showToast({ type: 'error', title: 'Sync failed', message: 'Check your internet connection' });
      }
      // try loading from cache
      try {
        const cached = await SecureStore.getItemAsync(SYNC_CACHE_KEY);
        if (cached && !syncStatus) {
          setSyncStatus(JSON.parse(cached));
        }
      } catch {
        // ignore cache errors
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [token, syncStatus, showToast]);

  useFocusEffect(
    useCallback(() => {
      fetchSyncStatus(false);

      intervalRef.current = setInterval(() => {
        fetchSyncStatus(false);
      }, 30000);

      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          fetchSyncStatus(false);
        }
      });

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        sub.remove();
      };
    }, [fetchSyncStatus])
  );

  const handleSync = useCallback(() => {
    if (syncing) return;
    fetchSyncStatus(true);
  }, [syncing, fetchSyncStatus]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FullScreenLoader />
      </SafeAreaView>
    );
  }

  const pendingCount = syncStatus?.pending_count ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>KhataFlow</Text>
        <TouchableOpacity style={styles.topBtn} onPress={handleSync}>
          <Ionicons name="sync" size={24} color={Tokens.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Data Synchronization</Text>
          <Text style={styles.headerSub}>
            Keep your shop's data backed up and up-to-date across all devices.
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.mainCard}>
            <View style={styles.dotPattern} />
            <View style={styles.mainCardContent}>
              <View style={[styles.iconContainer, syncing && styles.iconContainerSyncing]}>
                {syncing ? (
                  <Loader size={32} color={Tokens.secondary} />
                ) : !isOnline ? (
                  <Ionicons name="cloud-offline-outline" size={64} color={Tokens['on-error-container']} />
                ) : syncStatus?.is_synced ? (
                  <Ionicons name="cloud-done" size={64} color={Tokens['on-secondary-container']} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={64} color={Tokens.secondary} />
                )}
              </View>

              <Text style={styles.statusText}>
                {syncing
                  ? 'Syncing Data...'
                  : !isOnline
                    ? 'You are offline'
                    : syncStatus?.is_synced
                      ? 'All Data Synced'
                      : 'Pending sync'}
              </Text>

              <Text style={styles.statusTime}>
                {syncing
                  ? 'Please wait, do not close the app.'
                  : !isOnline
                    ? 'Changes will sync when online'
                    : syncStatus?.last_synced_at
                      ? `Last synced: ${formatTime(syncStatus.last_synced_at)}`
                      : 'No sync data yet'}
              </Text>

              <TouchableOpacity
                style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
                onPress={handleSync}
                disabled={syncing}
                activeOpacity={0.9}
              >
                {syncing ? (
                  <Loader size={14} color="#fff" />
                ) : (
                  <Ionicons name="sync" size={20} color={Tokens['on-primary']} />
                )}
                <Text style={styles.syncBtnText}>
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sideCards}>
            <View style={styles.sideCard}>
              <View style={[styles.sideIcon, {
                backgroundColor: pendingCount > 0 ? Tokens['tertiary-container'] : Tokens['secondary-container'],
              }]}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={24}
                  color={pendingCount > 0 ? Tokens['on-tertiary-container'] : Tokens['on-secondary-container']}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sideLabel}>Pending Items</Text>
                <Text style={styles.sideValue}>
                  {pendingCount} <Text style={styles.sideUnit}>records</Text>
                </Text>
                {pendingCount > 0 && (
                  <Text style={styles.sideHint}>Sync to backup data</Text>
                )}
              </View>
            </View>

            <View style={styles.sideCard}>
              <View style={[styles.sideIcon, {
                backgroundColor: isOnline ? '#e8f5e9' : Tokens['error-container'],
              }]}>
                <Ionicons
                  name={isOnline ? 'wifi' : 'wifi-outline'}
                  size={24}
                  color={isOnline ? '#2e7d32' : Tokens['on-error-container']}
                />
              </View>
              <View>
                <Text style={styles.sideLabel}>Connection</Text>
                <Text style={[styles.sideValue, {
                  color: isOnline ? Tokens['on-surface'] : Tokens.error,
                }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Tokens.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, height: 56, backgroundColor: Tokens.surface,
    borderBottomWidth: 1, borderBottomColor: Tokens['surface-variant'],
  },
  topBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  topTitle: { fontSize: 20, fontWeight: '700', color: Tokens.secondary, fontFamily: 'Lexend-SemiBold' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.gutter, paddingTop: Spacing.md, paddingBottom: 40, gap: Spacing.md },
  headerSection: { marginBottom: 4 },
  headerTitle: {
    fontSize: 22, fontWeight: '600', color: Tokens['on-surface'],
    fontFamily: 'Lexend-SemiBold',
  },
  headerSub: { fontSize: 14, color: Tokens['on-surface-variant'], marginTop: 4, lineHeight: 20 },
  grid: { gap: Spacing.md },

  mainCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: Spacing.md,
    minHeight: 300, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 4,
  },
  dotPattern: {
    position: 'absolute', inset: 0, opacity: 0.06, backgroundColor: Tokens.background,
  },
  mainCardContent: { alignItems: 'center', gap: 8, zIndex: 1, width: '100%' },
  iconContainer: {
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: Tokens['secondary-container'],
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 6,
  },
  iconContainerSyncing: { backgroundColor: Tokens['surface-variant'] },
  statusText: {
    fontSize: 20, fontWeight: '600', color: Tokens['on-surface'],
    fontFamily: 'Lexend-SemiBold', marginTop: 4,
  },
  statusTime: { fontSize: 14, color: Tokens['on-surface-variant'], marginBottom: 16 },
  syncBtn: {
    height: 56, paddingHorizontal: 32, borderRadius: 999,
    backgroundColor: Tokens.secondary, flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '100%', justifyContent: 'center',
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { fontSize: 15, fontWeight: '600', color: Tokens['on-primary'] },
  sideCards: { gap: Spacing.md },
  sideCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  sideIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sideLabel: { fontSize: 12, fontWeight: '500', color: Tokens['on-surface-variant'], marginBottom: 2, letterSpacing: 0.3 },
  sideValue: { fontSize: 17, fontWeight: '600', color: Tokens['on-surface'], fontFamily: 'Lexend' },
  sideUnit: { fontSize: 14, fontWeight: '400', color: Tokens['on-surface-variant'] },
  sideHint: { fontSize: 11, color: Tokens['on-surface-variant'], marginTop: 1 },
});
