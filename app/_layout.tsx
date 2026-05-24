import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_400Regular_Italic, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import { View } from 'react-native';
import { Tokens } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast-provider';
import FullScreenLoader from '@/components/FullScreenLoader';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return <ToastProvider>{children}</ToastProvider>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter': Inter_400Regular,
    'Inter-Italic': Inter_400Regular_Italic,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Lexend': Lexend_500Medium,
    'Lexend-SemiBold': Lexend_600SemiBold,
    'Lexend-Bold': Lexend_700Bold,
  });

  if (!fontsLoaded) {
    return <FullScreenLoader />;
  }

  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="splash" />
          <Stack.Screen name="login" />
          <Stack.Screen name="shop-setup" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="inventory" options={{ headerShown: false }} />
          <Stack.Screen name="customers" options={{ headerShown: false }} />
          <Stack.Screen name="reports" options={{ headerShown: false }} />
          <Stack.Screen name="modals/low-stock-alert" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modals/expense-add" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="dark" />
      </AuthGate>
    </AuthProvider>
  );
}
