import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface LineItem {
  id: string;
  product_uuid?: string;
  name: string;
  rate: number;
  quantity: number;
  unit?: string;
  gstRate?: number;
}

export interface Customer {
  uuid?: string;
  name: string;
  phone?: string;
}

export interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
}

interface BillState {
  items: LineItem[];
  customer: Customer | null;
  paymentMode: string;
  discount: Discount | null;
  notes: string;
}

interface BillContextType extends BillState {
  addItem: (item: LineItem) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setPaymentMode: (mode: string) => void;
  setDiscount: (discount: Discount | null) => void;
  setNotes: (notes: string) => void;
  resetBill: () => void;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

const initialState: BillState = {
  items: [],
  customer: null,
  paymentMode: 'Cash',
  discount: null,
  notes: '',
};

const BillContext = createContext<BillContextType | null>(null);

export function BillProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<LineItem[]>(initialState.items);
  const [customer, setCustomer] = useState<Customer | null>(initialState.customer);
  const [paymentMode, setPaymentMode] = useState<string>(initialState.paymentMode);
  const [discount, setDiscount] = useState<Discount | null>(initialState.discount);
  const [notes, setNotes] = useState<string>(initialState.notes);

  const addItem = useCallback((item: LineItem) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...item };
        return updated;
      }
      return [...prev, item];
    });
  }, []);

  const updateItemQuantity = useCallback((id: string, quantity: number) => {
    setItems(prev =>
      quantity <= 0
        ? prev.filter(i => i.id !== id)
        : prev.map(i => (i.id === id ? { ...i, quantity } : i)),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const resetBill = useCallback(() => {
    setItems([]);
    setCustomer(null);
    setPaymentMode('Cash');
    setDiscount(null);
    setNotes('');
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.rate * item.quantity, 0);

  const discountAmount = discount
    ? discount.type === 'percentage'
      ? subtotal * (discount.value / 100)
      : Math.min(discount.value, subtotal)
    : 0;

  const taxAmount = items.reduce((sum, item) => {
    const rate = item.gstRate ?? 0;
    return sum + Math.round(item.rate * item.quantity * rate / 100);
  }, 0);
  const grandTotal = Math.round(subtotal - discountAmount + taxAmount);

  return (
    <BillContext.Provider
      value={{
        items,
        customer,
        paymentMode,
        discount,
        notes,
        addItem,
        updateItemQuantity,
        removeItem,
        setCustomer,
        setPaymentMode,
        setDiscount,
        setNotes,
        resetBill,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
      }}
    >
      {children}
    </BillContext.Provider>
  );
}

export function useBill() {
  const context = useContext(BillContext);
  if (!context) throw new Error('useBill must be used within BillProvider');
  return context;
}
