import { Stack } from 'expo-router';
import { BillProvider } from '@/lib/bill-context';

export default function BillLayout() {
  return (
    <BillProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="items" />
        <Stack.Screen name="search" />
        <Stack.Screen name="review" />
        <Stack.Screen name="success" />
        <Stack.Screen name="history" />
        <Stack.Screen name="detail" />
        <Stack.Screen name="modals/quick-add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/payment-mode" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/customer-select" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/discount" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modals/record-payment" options={{ presentation: 'modal' }} />
      </Stack>
    </BillProvider>
  );
}
