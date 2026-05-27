import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tokens } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

function TabLabel({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <Text style={{ fontSize: 10, fontWeight: '600', fontFamily: 'Inter_500Medium', marginTop: 1 }}>{t(labelKey)}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Tokens['surface-container'],
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          borderTopWidth: 0,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: Tokens['on-secondary-container'],
        tabBarInactiveTintColor: Tokens['on-surface-variant'],
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarItemStyle: {
          height: 52,
          paddingVertical: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name="home"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: () => <TabLabel labelKey="common.home" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name="person"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: () => <TabLabel labelKey="common.profile" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name="settings"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: () => <TabLabel labelKey="common.settings" />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name="sync"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: () => <TabLabel labelKey="common.sync" />,
        }}
      />
    </Tabs>
  );
}
