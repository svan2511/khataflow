const API_BASE = 'http://192.168.1.9:8000/api';

//const API_BASE = 'https://khata-flow-api.onrender.com/api';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface RegisterResponse {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  phone_verified_at: string | null;
  has_shop: boolean;
  created_at: string;
}

export interface VerifyOtpResponse {
  user: RegisterResponse;
  token: string;
  token_type: string;
}

export interface ShopData {
  id: string;
  shop_name: string;
  shop_slug: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  logo: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DashboardData {
  today_sales: number;
  total_credit: number;
  low_stock_count: number;
  today_bills_count: number;
  today_bills: BillListItem[];
  credit_customers: Array<{
    id: string;
    name: string;
    phone: string | null;
    total_credit: number;
  }>;
  has_shop: boolean;
}

export interface BillListItem {
  id: string;
  bill_number: string;
  customer_name: string | null;
  total: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
  items_count: number;
  created_at: string;
}

export interface SyncStatusData {
  is_synced: boolean;
  pending_count: number;
  last_synced_at: string;
}

export interface UserProfileData {
  user: RegisterResponse;
  shop: ShopData | null;
}

// Phase 2 - Product types
export interface ProductData {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  price: number;
  cost_price: number;
  mrp: number;
  unit: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  image: string | null;
  category: { id: string; name: string } | null;
  created_at: string;
}

// Phase 2 - Customer types
export interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_credit: number;
  bills_count?: number;
  created_at: string;
}

// Phase 2 - Bill types
export interface BillItemData {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_type: string;
  discount_value: number;
  discount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  tax: number;
  subtotal: number;
  total: number;
}

export interface PaymentData {
  id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  created_at: string;
}

export interface BillDetail {
  id: string;
  bill_number: string;
  customer: CustomerData | null;
  items: BillItemData[];
  payments: PaymentData[];
  subtotal: number;
  discount_type: string;
  discount_value: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
  payment_method: string;
  notes: string | null;
  gst_breakup: Array<{
    gst_rate: number;
    taxable_value: number;
    cgst: number;
    sgst: number;
    total_tax: number;
  }>;
  items_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Phase 3: Customer Detail ──────────────────────────────────────

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_credit: number;
  credit_summary: {
    total_billed: number;
    total_paid: number;
    outstanding: number;
  };
  bills: BillListItem[];
  created_at: string;
}

// ─── Phase 3: Report types ─────────────────────────────────────────

export interface DailyReport {
  date: string;
  total_sales: number;
  total_bills: number;
  average_bill_value: number;
  total_paid: number;
  total_due: number;
  total_credit: number;
  payment_breakdown: {
    cash: number;
    upi: number;
    card: number;
    mix: number;
    credit: number;
  };
  top_products: Array<{
    product_name: string;
    total_quantity: number;
    total_revenue: number;
    unit: string;
  }>;
}

export interface MonthlyReport {
  current_month: {
    month: string;
    total_sales: number;
    total_bills: number;
    average_per_day: number;
    total_credit: number;
    payment_breakdown: {
      cash: number; upi: number; card: number; mix: number; credit: number;
    };
    top_products: Array<{
      product_name: string;
      total_quantity: number;
      total_revenue: number;
      unit: string;
    }>;
  };
  previous_month: {
    month: string;
    total_sales: number;
    total_bills: number;
    average_per_day: number;
  };
  comparison: {
    sales_growth_percentage: number;
    bills_growth_percentage: number;
  };
}

// ─── Phase 3: Expense types ────────────────────────────────────────

export interface ExpenseData {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  payment_method: string;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized?.();
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

export const api = {
  register(phone: string) {
    return request<RegisterResponse>('/register', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyOtp(phone: string, otp: string, purpose: string = 'registration') {
    return request<VerifyOtpResponse>('/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, purpose }),
    });
  },

  setupShop(token: string, data: Record<string, any>) {
    return request<ShopData>('/shop/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  setupShopWithLogo(token: string, formData: FormData) {
    return request<ShopData>('/shop/setup', {
      method: 'POST',
      body: formData,
    }, token);
  },

  getDashboard(token: string) {
    return request<DashboardData>('/dashboard', {}, token);
  },

  getProfile(token: string) {
    return request<UserProfileData>('/user/profile', {}, token);
  },

  updateProfile(token: string, data: Record<string, any>) {
    const isFormData = data instanceof FormData;
    const body = isFormData ? data : JSON.stringify(data);
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    return request<UserProfileData>('/user/profile', {
      method: isFormData ? 'POST' : 'PUT',
      body,
      headers,
    }, token);
  },

  getSyncStatus(token: string) {
    return request<SyncStatusData>('/sync/status', {}, token);
  },

  logout(token: string) {
    return request<null>('/logout', {
      method: 'POST',
    }, token);
  },

  searchProducts(token: string, query?: string, limit: number = 100) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', String(limit));
    return request<ProductData[]>('/products/search?' + params.toString(), {}, token);
  },

  getProduct(token: string, uuid: string) {
    return request<ProductData>('/products/' + uuid, {}, token);
  },

  searchCustomers(token: string, query?: string, limit: number = 50) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', String(limit));
    return request<CustomerData[]>('/customers/search?' + params.toString(), {}, token);
  },

  quickAddCustomer(token: string, data: { name: string; phone?: string; email?: string; address?: string }) {
    return request<CustomerData>('/customers/quick', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  createProduct(token: string, data: { name: string; price: number; unit: string }) {
    return request<ProductData>('/products/quick', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  // ─── Phase 2: Bills ─────────────────────────────────────────────

  createBill(token: string, data: {
    items: Array<{
      product_uuid: string;
      quantity: number;
      discount_type?: string;
      discount_value?: number;
      gst_rate?: number;
    }>;
    customer_uuid?: string;
    discount_type?: string;
    discount_value?: number;
    paid_amount?: number;
    payment_method: string;
    notes?: string;
  }) {
    return request<BillDetail>('/bills', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  listBills(token: string, params?: {
    per_page?: number;
    date_from?: string;
    date_to?: string;
    search?: string;
    payment_status?: string;
  }) {
    const query = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return request<BillListItem[]>('/bills' + query, {}, token);
  },

  getBill(token: string, uuid: string) {
    return request<BillDetail>('/bills/' + uuid, {}, token);
  },

  addPayment(token: string, uuid: string, data: {
    amount: number;
    payment_method: string;
    reference?: string;
    notes?: string;
  }) {
    return request<BillDetail>('/bills/' + uuid + '/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  // ─── Phase 3: Products CRUD ──────────────────────────────────────

  listProducts(token: string, params?: {
    per_page?: number;
    search?: string;
    category_id?: number;
    low_stock?: boolean;
    is_active?: boolean;
  }) {
    const query = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return request<ProductData[]>('/products' + query, {}, token);
  },

  createProductFull(token: string, formData: FormData) {
    return request<ProductData>('/products', {
      method: 'POST',
      body: formData,
    }, token);
  },

  updateProductFull(token: string, uuid: string, formData: FormData) {
    return request<ProductData>('/products/' + uuid, {
      method: 'POST',
      body: formData,
    }, token);
  },

  deleteProduct(token: string, uuid: string) {
    return request<null>('/products/' + uuid, {
      method: 'DELETE',
    }, token);
  },

  // ─── Phase 3: Customers CRUD ─────────────────────────────────────

  listCustomers(token: string, params?: {
    per_page?: number;
    search?: string;
  }) {
    const query = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return request<CustomerData[]>('/customers' + query, {}, token);
  },

  createCustomer(token: string, data: { name: string; phone?: string; email?: string; address?: string }) {
    return request<CustomerData>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  getCustomer(token: string, uuid: string) {
    return request<CustomerDetail>('/customers/' + uuid, {}, token);
  },

  updateCustomerFull(token: string, uuid: string, data: { name: string; phone?: string; email?: string; address?: string }) {
    return request<CustomerData>('/customers/' + uuid, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token);
  },

  // ─── Phase 3: Stock In ───────────────────────────────────────────

  stockIn(token: string, data: {
    product_uuid: string;
    quantity: number;
    cost_price?: number;
    notes?: string;
  }) {
    return request<ProductData>('/stock/in', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  // ─── Phase 3: Reports ────────────────────────────────────────────

  getDailyReport(token: string, date?: string) {
    const query = date ? '?date=' + date : '';
    return request<DailyReport>('/reports/daily' + query, {}, token);
  },

  getMonthlyReport(token: string, year?: number, month?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    const query = params.toString() ? '?' + params.toString() : '';
    return request<MonthlyReport>('/reports/monthly' + query, {}, token);
  },

  // ─── Phase 3: Expenses ───────────────────────────────────────────

  createExpense(token: string, data: {
    title: string;
    amount: number;
    expense_date: string;
    category?: string;
    payment_method?: string;
    notes?: string;
  }) {
    return request<ExpenseData>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  listExpenses(token: string, params?: {
    per_page?: number;
    date_from?: string;
    date_to?: string;
    category?: string;
  }) {
    const query = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return request<ExpenseData[]>('/expenses' + query, {}, token);
  },
};
