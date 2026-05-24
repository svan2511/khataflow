import { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions,
  StyleSheet, SafeAreaView, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tokens } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const SIDEBAR_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 340);

interface SidebarItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const menuItems: SidebarItem[] = [
  { label: 'Dashboard', icon: 'home-outline', route: '/(tabs)' },
  { label: 'Inventory', icon: 'cube-outline', route: '/inventory' },
  { label: 'Customers', icon: 'people-outline', route: '/customers' },
  { label: 'Reports', icon: 'bar-chart-outline', route: '/reports' },
];

const bottomItems: SidebarItem[] = [
  { label: 'Profile', icon: 'person-outline', route: '/(tabs)/profile' },
  { label: 'Settings', icon: 'settings-outline', route: '/(tabs)/settings' },
  { label: 'Sync', icon: 'cloudy-outline', route: '/(tabs)/sync' },
];

const menuIcons: Record<string, { focused: keyof typeof Ionicons.glyphMap; bg: string }> = {
  '/(tabs)': { focused: 'home', bg: '#e8f5e9' },
  '/inventory': { focused: 'cube', bg: '#e3f2fd' },
  '/customers': { focused: 'people', bg: '#fff3e0' },
  '/reports': { focused: 'bar-chart', bg: '#f3e8ff' },
  '/(tabs)/profile': { focused: 'person', bg: '#fce4ec' },
  '/(tabs)/settings': { focused: 'settings', bg: '#e0f2fe' },
  '/(tabs)/sync': { focused: 'cloudy', bg: '#e8f5e9' },
};

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  activeRoute?: string;
}

export default function SidebarDrawer({ visible, onClose, activeRoute }: SidebarDrawerProps) {
  const { token, user } = useAuth();
  const [shopName, setShopName] = useState('KhataFlow');
  const [shopLogo, setShopLogo] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const itemsAnim = useRef(menuItems.map(() => new Animated.Value(0))).current;
  const bottomAnim = useRef(bottomItems.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (token) {
      api.getProfile(token).then(res => {
        if (res.data.shop?.shop_name) setShopName(res.data.shop.shop_name);
        if (res.data.shop?.logo) setShopLogo(res.data.shop.logo);
      }).catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0, duration: 350, useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 350, useNativeDriver: true,
        }),
      ]).start();

      Animated.stagger(60, itemsAnim.map(anim =>
        Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true })
      )).start();

      setTimeout(() => {
        Animated.stagger(50, bottomAnim.map(anim =>
          Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true })
        )).start();
      }, 250);
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH, duration: 250, useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0, duration: 250, useNativeDriver: true,
        }),
      ]).start();
      itemsAnim.forEach(a => a.setValue(0));
      bottomAnim.forEach(a => a.setValue(0));
    }
  }, [visible]);

  const navigate = useCallback((route: string) => {
    onClose();
    setTimeout(() => (router as any).push(route), 250);
  }, [onClose]);

  const isActive = (route: string) => {
    if (!activeRoute) return false;
    return activeRoute.startsWith(route) || activeRoute === route;
  };

  const initial = user?.name?.charAt(0).toUpperCase() || 'S';

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.overlay, { opacity: fadeAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <SafeAreaView style={styles.drawerInner}>
          {/* Decorative top accent */}
          <View style={styles.accentBar} />

          {/* Profile Section */}
          <View style={styles.profileSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={() => navigate('/(tabs)/profile')}>
              {shopLogo ? (
                <Image source={{ uri: shopLogo }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>Premium Member</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={Tokens['on-surface-variant']} />
            </TouchableOpacity>
          </View>

          <View style={styles.dividerWide} />

          {/* Main Menu */}
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionLabel}>Main Menu</Text>
            {menuItems.map((item, i) => {
              const active = isActive(item.route);
              const icons = menuIcons[item.route];
              return (
                <Animated.View key={item.route} style={{ opacity: itemsAnim[i], transform: [{ translateX: itemsAnim[i].interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
                  <TouchableOpacity
                    style={[styles.menuItem, active && styles.menuItemActive]}
                    onPress={() => navigate(item.route)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: active ? Tokens.secondary : icons.bg }]}>
                      <Ionicons
                        name={active ? icons.focused : item.icon}
                        size={20}
                        color={active ? '#fff' : Tokens['on-surface-variant']}
                      />
                    </View>
                    <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                      {item.label}
                    </Text>
                    {active && <View style={styles.activeBar} />}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* Other Menu */}
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionLabel}>Other</Text>
            {bottomItems.map((item, i) => {
              const active = isActive(item.route);
              const icons = menuIcons[item.route];
              return (
                <Animated.View key={item.route} style={{ opacity: bottomAnim[i], transform: [{ translateX: bottomAnim[i].interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
                  <TouchableOpacity
                    style={[styles.menuItem, active && styles.menuItemActive]}
                    onPress={() => navigate(item.route)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: active ? Tokens.secondary : icons.bg }]}>
                      <Ionicons
                        name={active ? icons.focused : item.icon}
                        size={20}
                        color={active ? '#fff' : Tokens['on-surface-variant']}
                      />
                    </View>
                    <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>KhataFlow v1.0</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 99,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 100,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  drawerInner: { flex: 1 },

  // Accent bar
  accentBar: {
    height: 4,
    backgroundColor: Tokens.secondary,
  },

  // Profile
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  avatarWrap: { shadowColor: Tokens.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Tokens.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 52, height: 52, borderRadius: 14 },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff', fontFamily: 'Lexend-Bold' },
  shopName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1c1e',
    fontFamily: 'Lexend-SemiBold',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Dividers
  dividerWide: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20, marginVertical: 4 },

  // Menu
  menuSection: { paddingVertical: 4 },
  menuSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    borderRadius: 14,
  },
  menuItemActive: {
    backgroundColor: 'rgba(0,107,89,0.08)',
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
    fontFamily: 'Inter-Medium',
  },
  menuLabelActive: {
    fontWeight: '600',
    color: Tokens.secondary,
    fontFamily: 'Lexend',
  },
  activeBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: Tokens.secondary,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: { fontSize: 12, color: '#d1d5db', letterSpacing: 0.3 },
});
