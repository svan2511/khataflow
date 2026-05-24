import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tokens } from '@/constants/theme';

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
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          fontFamily: 'Inter_500Medium',
          marginTop: 1,
        },
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
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="home"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="person"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: 'Profile',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="settings"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: 'Settings',
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="sync"
              size={22}
              color={focused ? Tokens['on-secondary-container'] : Tokens['on-surface-variant']}
            />
          ),
          tabBarLabel: 'Sync',
        }}
      />
    </Tabs>
  );
}
