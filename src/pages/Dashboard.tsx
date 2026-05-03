import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Calendar, Clock, User, Phone, MapPin, Package, CreditCard, FileText, Search, Receipt, TrendingUp, Maximize2, X } from "lucide-react";

// Add custom scrollbar styles
const customScrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: hsl(var(--secondary));
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground));
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--accent));
  }
`;

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? "http://localhost:4242" : window.location.origin);
const authStorageKey = "dashboard_auth_token";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

type PaymentMethodConfig = {
  id: string;
  label: string;
  type: "stripe" | "manual";
  enabled: boolean;
};

type PaymentConfig = {
  methods: PaymentMethodConfig[];
  gateway: {
    stripeEnabled: boolean;
    amount: number;
    currency: string;
  };
};

type OrderRecord = {
  id: string;
  clientName: string;
  clientPhone: string;
  printMaterial: string;
  paymentMethod: string;
  paymentStatus: "Pending" | "Paid" | "Unpaid" | "Cancelled";
  quantity: number;
  color: string;
  governorate: string;
  unitPrice: number;
  shippingCost: number;
  totalPrice: number;
  createdAt: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  weightGrams: number;
  deliveryAddress: string;
};

const Dashboard = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [config, setConfig] = useState<PaymentConfig>({
    methods: [],
    gateway: { stripeEnabled: true, amount: 1000, currency: "usd" },
  });
  const [methodsInput, setMethodsInput] = useState("");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<OrderRecord | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showLoginLogs, setShowLoginLogs] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loginLogs, setLoginLogs] = useState<any[]>([]);

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  // Inject custom scrollbar styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customScrollbarStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`${apiBaseUrl}/payment-config`)
      .then((res) => res.json())
      .then((data: PaymentConfig) => {
        setConfig(data);
        setMethodsInput(
          data.methods
            .map((method) => `${method.label} | ${method.type} | ${String(method.enabled)}`)
            .join("\n"),
        );
        void fetchOrders(token);
      })
      .catch((error) =>
        setStatus(error instanceof Error ? error.message : "Failed to load dashboard config."),
      )
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const fetchOrders = async (dashboardToken: string) => {
    setIsLoadingOrders(true);
    try {
      console.log('Fetching orders from:', `${apiBaseUrl}/dashboard/orders`);
      const res = await fetch(`${apiBaseUrl}/dashboard/orders`, {
        headers: {
          "x-dashboard-token": dashboardToken,
        },
      });
      const data = (await res.json()) as { orders?: OrderRecord[]; error?: string };
      console.log('Orders response:', data);
      if (!res.ok) {
        setStatus(data.error || "Failed to load orders.");
        return;
      }
      setOrders(data.orders || []);
      console.log('Orders loaded:', data.orders?.length);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setStatus(error instanceof Error ? error.message : "Failed to load orders.");
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    try {
      console.log('Logging in to:', `${apiBaseUrl}/dashboard-auth`);
      const res = await fetch(`${apiBaseUrl}/dashboard-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = (await res.json()) as { token?: string; error?: string; username?: string };
      console.log('Auth response:', data);
      if (!res.ok || !data.token) {
        setStatus(data.error || "Authentication failed.");
        return;
      }

      setToken(data.token);
      setUsername("");
      setPassword("");
      console.log('Login successful, fetching orders...');
      await fetchOrders(data.token);
    } catch (error) {
      console.error('Login error:', error);
      setStatus("Could not connect to dashboard auth server. Make sure `npm run dev` is running.");
    }
  };

  const handleLogout = () => {
    setToken("");
    setStatus("");
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    try {
      const res = await fetch(`${apiBaseUrl}/dashboard/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-token": token,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok) {
        setStatus(data.error || "Failed to change password.");
        return;
      }
      setStatus(data.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordChange(false);
    } catch (error) {
      setStatus("Failed to change password.");
    }
  };

  const handleFetchLoginLogs = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/dashboard/login-logs`, {
        headers: { "x-dashboard-token": token },
      });
      const data = (await res.json()) as { logs?: any[]; error?: string };
      if (!res.ok) {
        setStatus(data.error || "Failed to fetch login logs.");
        return;
      }
      setLoginLogs(data.logs || []);
      setShowLoginLogs(true);
    } catch (error) {
      setStatus("Failed to fetch login logs.");
    }
  };

  const saveConfig = async () => {
    setStatus("");
    const parsedMethods = methodsInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [labelRaw, typeRaw, enabledRaw] = line.split("|").map((part) => part.trim());
        const label = labelRaw || `Method ${index + 1}`;
        const type = typeRaw === "stripe" ? "stripe" : "manual";
        const enabled = enabledRaw !== "false";
        return {
          id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          label,
          type,
          enabled,
        } as PaymentMethodConfig;
      });

    const payload: PaymentConfig = {
      methods: parsedMethods,
      gateway: config.gateway,
    };

    const res = await fetch(`${apiBaseUrl}/payment-config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-dashboard-token": token,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as PaymentConfig & { error?: string };
    if (!res.ok) {
      setStatus(data.error || "Failed to save config.");
      return;
    }

    setConfig(data);
    setMethodsInput(
      data.methods
        .map((method) => `${method.label} | ${method.type} | ${String(method.enabled)}`)
        .join("\n"),
    );
    setStatus("Saved. Checkout now uses updated settings.");
    await fetchOrders(token);
  };

  const updateOrderStatus = async (orderId: string, paymentStatus: OrderRecord["paymentStatus"]) => {
    const res = await fetch(`${apiBaseUrl}/dashboard/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-dashboard-token": token,
      },
      body: JSON.stringify({ paymentStatus }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || "Failed to update order status.");
      return;
    }
    setStatus("Order status updated.");
    await fetchOrders(token);
  };

  const handleDownloadFile = async (order: OrderRecord) => {
    if (!order.fileName) {
      setStatus("No file available for this order.");
      return;
    }
    
    try {
      // Try to download the actual uploaded file first
      const response = await fetch(`${apiBaseUrl}/download/${order.id}/${encodeURIComponent(order.fileName)}`);
      
      if (response.ok) {
        // Successfully retrieved the actual file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = order.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setStatus(`Downloaded ${order.fileName} (${formatFileSize(order.fileSize)})`);
        return;
      }
    } catch (error) {
      console.warn("Failed to download actual file, falling back to placeholder:", error);
    }
    
    // Fallback to placeholder content if actual file is not available
    const fileExtension = order.fileName.split('.').pop()?.toLowerCase();
    let fileContent = '';
    
    switch (fileExtension) {
      case 'stl':
        fileContent = `solid 3DPrintShopModel_Order${order.id.slice(-8)}
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 10.0 0.0 0.0
      vertex 0.0 10.0 0.0
    endloop
  endfacet
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 10.0 0.0 0.0
      vertex 10.0 10.0 0.0
      vertex 0.0 10.0 0.0
    endloop
  endfacet
endsolid 3DPrintShopModel_Order${order.id.slice(-8)}`;
        break;
      case 'obj':
        fileContent = `# 3D Print Shop Model - Order ${order.id.slice(-8)}
# Customer: ${order.clientName}
# Material: ${order.printMaterial}
v 0.0 0.0 0.0
v 10.0 0.0 0.0
v 0.0 10.0 0.0
v 10.0 10.0 0.0
f 1 2 3
f 2 4 3`;
        break;
      default:
        fileContent = `3D Print Shop File - Order ${order.id.slice(-8)}
Customer: ${order.clientName}
Material: ${order.printMaterial}
Quantity: ${order.quantity}
Created: ${formatDate(order.createdAt)}
File Type: ${order.fileType}
Size: ${formatFileSize(order.fileSize)}

This is a placeholder file. The original file was not found.`;
    }
    
    // Create and download the placeholder file
    const blob = new Blob([fileContent], { type: order.fileType || 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = order.fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    setStatus(`Downloaded placeholder ${order.fileName} (${formatFileSize(order.fileSize)})`);
  };

  const handleGenerateReceipt = (order: OrderRecord) => {
    const receiptContent = `
========================================
           3D PRINT SHOP RECEIPT
========================================

Order ID: #${order.id.slice(-8)}
Date: ${formatDate(order.createdAt)}
Status: ${order.paymentStatus}

----------------------------------------
CUSTOMER INFORMATION
----------------------------------------
Name: ${order.clientName}
Phone: ${order.clientPhone}
Location: ${order.governorate}, Jordan
Delivery: ${order.deliveryAddress}

----------------------------------------
ORDER DETAILS
----------------------------------------
Material: ${order.printMaterial}
Quantity: ${order.quantity}
Color: ${order.color}
Weight: ${order.weightGrams.toFixed(2)}g

${order.fileName ? `
----------------------------------------
FILE INFORMATION
----------------------------------------
File: ${order.fileName}
Size: ${formatFileSize(order.fileSize)}
Type: ${order.fileType}` : ''}

----------------------------------------
PAYMENT INFORMATION
----------------------------------------
Method: ${order.paymentMethod}
Unit Price: ${order.unitPrice.toFixed(2)} JOD
Quantity: ${order.quantity}
Subtotal: ${(order.unitPrice * order.quantity).toFixed(2)} JOD
Shipping: ${order.shippingCost.toFixed(2)} JOD (${order.governorate})
Total Price: ${order.totalPrice.toFixed(2)} JOD

========================================
Thank you for choosing 3D Print Shop!
Contact: 079 945 8828
========================================
`;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt_${order.id.slice(-8)}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    setStatus(`Receipt generated for order #${order.id.slice(-8)}`);
  };

  // Filter orders based on search term
  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    
    const term = searchTerm.toLowerCase();
    return orders.filter(order => 
      order.clientName.toLowerCase().includes(term) ||
      order.clientPhone.includes(term) ||
      order.printMaterial.toLowerCase().includes(term) ||
      order.paymentMethod.toLowerCase().includes(term) ||
      order.governorate.toLowerCase().includes(term) ||
      order.fileName?.toLowerCase().includes(term) ||
      order.id.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  // Calculate total sales
  const totalSales = useMemo(() => {
    return orders
      .filter(order => order.paymentStatus === 'Paid')
      .reduce((total, order) => total + order.totalPrice, 0);
  }, [orders]);

  // Separate orders by payment status
  const unpaidOrders = useMemo(() => {
    return orders.filter(order => order.paymentStatus === 'Unpaid');
  }, [orders]);

  const paidOrders = useMemo(() => {
    return orders.filter(order => order.paymentStatus === 'Paid');
  }, [orders]);

  const otherOrders = useMemo(() => {
    return orders.filter(order => order.paymentStatus !== 'Paid' && order.paymentStatus !== 'Unpaid');
  }, [orders]);

  const handleMaximizeOrder = (order: OrderRecord) => {
    setExpandedOrder(order);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-dvh bg-secondary p-2 md:p-6 text-ink">
        <div className="bg-panel border border-line shadow-panel min-h-[calc(100dvh-1rem)] md:min-h-[calc(100dvh-3rem)]">
          <header className="flex items-center justify-between border-b border-line px-4 md:px-6 py-4 text-xs font-mono uppercase tracking-wider">
            <span className="font-bold text-sm tracking-widest">Dashboard Login</span>
            <Link to="/" className="inline-flex items-center gap-2 text-ink-muted hover:text-ink transition-colors">
              <ArrowLeft className="size-4" />
              Back to Home
            </Link>
          </header>
          <main className="max-w-md mx-auto p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                  required
                />
              </label>
              <button
                type="submit"
                className="w-full bg-ink text-panel px-6 py-3 font-mono text-sm uppercase tracking-widest hover:bg-accent transition-colors"
              >
                Login
              </button>
            </form>
            {status ? <p className="font-mono text-xs text-red-600 mt-4">{status}</p> : null}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-secondary p-2 md:p-6 text-ink">
      <div className="bg-panel border border-line shadow-panel min-h-[calc(100dvh-1rem)] md:min-h-[calc(100dvh-3rem)]">
        <header className="flex items-center justify-between border-b border-line px-4 md:px-6 py-4 text-xs font-mono uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="font-bold text-sm tracking-widest">Dashboard</span>
            <span className="text-ink-muted text-[10px]">API: {apiBaseUrl}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowPasswordChange(true)}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={handleFetchLoginLogs}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              Login Logs
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              Logout
            </button>
            <Link to="/" className="inline-flex items-center gap-2 text-ink-muted hover:text-ink transition-colors">
              <ArrowLeft className="size-4" />
              Back to Home
            </Link>
          </div>
        </header>
        <main className="p-4 md:p-6 space-y-6">
          <section>
            <h3 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-2">
              <CreditCard className="size-3" />
              Payment Methods
            </h3>
            <div className="space-y-2 text-sm font-mono mb-4">
              {config.methods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-2 border border-line rounded">
                  <span>{method.label}</span>
                  <span className={`px-2 py-1 text-xs rounded ${method.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {method.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs font-mono text-ink-muted">
              <p>Available payment methods:</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>Cash on Delivery - Manual payment on delivery</li>
                <li>Cliq - Mobile payment</li>
                <li>Zain Cash - Mobile payment</li>
                <li>Orange Money - Mobile payment</li>
              </ul>
            </div>
          </section>

          <section className="pt-2 border-t border-line">
            {/* Search and Stats Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-mono text-xs uppercase tracking-widest flex items-center gap-1">
                  <Package className="size-3" />
                  Orders ({orders.length})
                </h3>
                <div className="flex items-center gap-1 text-xs font-mono text-ink-muted">
                  <TrendingUp className="size-3" />
                  <span>Total Sales: {totalSales.toFixed(2)} JOD</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 size-3 text-ink-muted" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 pr-3 py-1 text-xs font-mono border border-line bg-panel text-ink rounded w-32 sm:w-48 focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchOrders(token)}
                  className="text-xs font-mono uppercase tracking-widest text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
                >
                  Refresh
                </button>
              </div>
            </div>

            {isLoadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <div className="font-mono text-xs text-ink-muted animate-pulse">Loading orders...</div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Unpaid Orders Queue */}
                {unpaidOrders.length > 0 && (
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-red-600 mb-2 flex items-center gap-1">
                      <Package className="size-3" />
                      Unpaid Queue ({unpaidOrders.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar border border-red-200 bg-red-50/5 rounded p-2">
                      {unpaidOrders.map((order) => (
                        <OrderRow 
                          key={order.id} 
                          order={order} 
                          onMaximize={handleMaximizeOrder}
                          onDownload={handleDownloadFile}
                          onReceipt={handleGenerateReceipt}
                          onUpdateStatus={updateOrderStatus}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Paid Orders */}
                {paidOrders.length > 0 && (
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-green-600 mb-2 flex items-center gap-1">
                      <Package className="size-3" />
                      Completed Orders ({paidOrders.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar border border-green-200 bg-green-50/5 rounded p-2">
                      {paidOrders.map((order) => (
                        <OrderRow 
                          key={order.id} 
                          order={order} 
                          onMaximize={handleMaximizeOrder}
                          onDownload={handleDownloadFile}
                          onReceipt={handleGenerateReceipt}
                          onUpdateStatus={updateOrderStatus}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Orders (Pending, Cancelled) */}
                {otherOrders.length > 0 && (
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-yellow-600 mb-2 flex items-center gap-1">
                      <Package className="size-3" />
                      Other Orders ({otherOrders.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar border border-yellow-200 bg-yellow-50/5 rounded p-2">
                      {otherOrders.map((order) => (
                        <OrderRow 
                          key={order.id} 
                          order={order} 
                          onMaximize={handleMaximizeOrder}
                          onDownload={handleDownloadFile}
                          onReceipt={handleGenerateReceipt}
                          onUpdateStatus={updateOrderStatus}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {orders.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="font-mono text-xs text-ink-muted">No orders yet.</div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Expanded Order Modal */}
          {expandedOrder && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-panel border border-line rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-line">
                  <h3 className="font-mono text-sm uppercase tracking-widest">Order Details #{expandedOrder.id.slice(-8)}</h3>
                  <button
                    onClick={() => setExpandedOrder(null)}
                    className="p-1 hover:bg-panel-muted rounded transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Customer Information */}
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-2">
                      <User className="size-3" />
                      Customer Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                      <div>
                        <span className="text-ink-muted">Name:</span> {expandedOrder.clientName}
                      </div>
                      <div>
                        <span className="text-ink-muted">Phone:</span> {expandedOrder.clientPhone}
                      </div>
                      <div>
                        <span className="text-ink-muted">Location:</span> {expandedOrder.governorate}, Jordan
                      </div>
                      <div>
                        <span className="text-ink-muted">Address:</span> {expandedOrder.deliveryAddress}
                      </div>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-2">
                      <Package className="size-3" />
                      Order Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                      <div>
                        <span className="text-ink-muted">Material:</span> {expandedOrder.printMaterial}
                      </div>
                      <div>
                        <span className="text-ink-muted">Quantity:</span> {expandedOrder.quantity}
                      </div>
                      <div>
                        <span className="text-ink-muted">Color:</span> {expandedOrder.color}
                      </div>
                      <div>
                        <span className="text-ink-muted">Weight:</span> {expandedOrder.weightGrams.toFixed(2)}g
                      </div>
                      <div>
                        <span className="text-ink-muted">Unit Price:</span> {expandedOrder.unitPrice.toFixed(2)} JOD
                      </div>
                      <div>
                        <span className="text-ink-muted">Total Price:</span> {expandedOrder.totalPrice.toFixed(2)} JOD
                      </div>
                    </div>
                  </div>

                  {/* File Information */}
                  {expandedOrder.fileName && (
                    <div>
                      <h4 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-2">
                        <FileText className="size-3" />
                        File Information
                      </h4>
                      <div className="grid grid-cols-1 gap-2 text-sm font-mono">
                        <div><span className="text-ink-muted">File:</span> {expandedOrder.fileName}</div>
                        <div><span className="text-ink-muted">Size:</span> {formatFileSize(expandedOrder.fileSize)}</div>
                        <div><span className="text-ink-muted">Type:</span> {expandedOrder.fileType}</div>
                      </div>
                    </div>
                  )}

                  {/* Payment Information */}
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-2">
                      <CreditCard className="size-3" />
                      Payment Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                      <div>
                        <span className="text-ink-muted">Method:</span> {expandedOrder.paymentMethod}
                      </div>
                      <div>
                        <span className="text-ink-muted">Status:</span> 
                        <span className={`ml-2 px-2 py-1 text-xs font-mono rounded ${
                          expandedOrder.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                          expandedOrder.paymentStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          expandedOrder.paymentStatus === 'Unpaid' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {expandedOrder.paymentStatus}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted">Unit Price:</span> {expandedOrder.unitPrice.toFixed(2)} JOD
                      </div>
                      <div>
                        <span className="text-ink-muted">Quantity:</span> {expandedOrder.quantity}
                      </div>
                      <div>
                        <span className="text-ink-muted">Subtotal:</span> {(expandedOrder.unitPrice * expandedOrder.quantity).toFixed(2)} JOD
                      </div>
                      <div>
                        <span className="text-ink-muted">Shipping:</span> {expandedOrder.shippingCost.toFixed(2)} JOD ({expandedOrder.governorate})
                      </div>
                      <div className="col-span-2">
                        <span className="text-ink-muted">Total Price:</span> 
                        <span className="ml-2 font-bold text-lg">{expandedOrder.totalPrice.toFixed(2)} JOD</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-ink-muted">Created:</span> {formatDate(expandedOrder.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-line">
                    {expandedOrder.fileName && (
                      <button
                        onClick={() => handleDownloadFile(expandedOrder)}
                        className="px-4 py-2 bg-accent text-accent-foreground text-xs font-mono rounded hover:bg-accent/80 transition-colors flex items-center gap-2"
                      >
                        <Download className="size-3" />
                        Download File
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerateReceipt(expandedOrder)}
                      className="px-4 py-2 bg-accent text-accent-foreground text-xs font-mono rounded hover:bg-accent/80 transition-colors flex items-center gap-2"
                    >
                      <Receipt className="size-3" />
                      Generate Receipt
                    </button>
                    <select
                      value={expandedOrder.paymentStatus}
                      onChange={(event) => {
                        updateOrderStatus(expandedOrder.id, event.target.value as OrderRecord["paymentStatus"]);
                        setExpandedOrder(null);
                      }}
                      className="px-3 py-2 border border-line bg-panel text-ink text-xs font-mono rounded"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Password Change Modal */}
        {showPasswordChange && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-panel border border-line rounded shadow-panel max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-sm uppercase tracking-widest">Change Password</h3>
                  <button
                    onClick={() => setShowPasswordChange(false)}
                    className="text-ink-muted hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                    Current Password
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
                    New Password
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="px-4 py-3 border border-line bg-panel text-ink normal-case tracking-normal text-sm"
                      required
                      minLength={6}
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full bg-ink text-panel px-6 py-3 font-mono text-sm uppercase tracking-widest hover:bg-accent transition-colors"
                  >
                    Change Password
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Login Logs Modal */}
        {showLoginLogs && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-panel border border-line rounded shadow-panel max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-mono text-sm uppercase tracking-widest">Login Logs</h3>
                  <button
                    onClick={() => setShowLoginLogs(false)}
                    className="text-ink-muted hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="text-left p-2">Timestamp</th>
                        <th className="text-left p-2">IP Address</th>
                        <th className="text-left p-2">Username</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.map((log, index) => (
                        <tr key={index} className="border-b border-line">
                          <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="p-2">{log.ip}</td>
                          <td className="p-2">{log.username}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {log.success ? 'Success' : 'Failed'}
                            </span>
                          </td>
                          <td className="p-2">{log.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Order Row Component
const OrderRow = ({ 
  order, 
  onMaximize, 
  onDownload, 
  onReceipt, 
  onUpdateStatus 
}: {
  order: OrderRecord;
  onMaximize: (order: OrderRecord) => void;
  onDownload: (order: OrderRecord) => void;
  onReceipt: (order: OrderRecord) => void;
  onUpdateStatus: (id: string, status: OrderRecord["paymentStatus"]) => void;
}) => (
  <div className="group relative border border-line rounded bg-panel hover:bg-panel-muted transition-all duration-200 hover:shadow-sm hover:border-accent overflow-hidden">
    <div className="flex items-center justify-between p-1">
      {/* Left: Order ID and Customer */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="font-mono text-xs font-bold text-ink truncate">#{order.id.slice(-8)}</span>
          <div className="flex items-center gap-1 text-ink-muted text-xs">
            <User className="size-2" />
            <span className="truncate">{order.clientName}</span>
          </div>
        </div>
      </div>

      {/* Middle: Order Details */}
      <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-ink-muted">
        <span className="hidden lg:block">{order.printMaterial}</span>
        <span>Qty: {order.quantity}</span>
        <span>{order.governorate}</span>
        {order.fileName && (
          <span className="hidden md:block truncate max-w-20">{order.fileName}</span>
        )}
      </div>

      {/* Right: Status, Price, Actions */}
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 text-xs font-mono rounded ${
          order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
          order.paymentStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
          order.paymentStatus === 'Unpaid' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {order.paymentStatus}
        </span>
        <span className="font-mono text-xs font-bold text-ink">
          {order.totalPrice.toFixed(2)} JOD
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMaximize(order)}
            className="p-1 bg-accent text-accent-foreground rounded hover:bg-accent/80 transition-colors"
            title="Maximize order"
          >
            <Maximize2 className="size-2" />
          </button>
          {order.fileName && (
            <button
              onClick={() => onDownload(order)}
              className="p-1 bg-accent text-accent-foreground rounded hover:bg-accent/80 transition-colors"
              title="Download file"
            >
              <Download className="size-2" />
            </button>
          )}
          <button
            onClick={() => onReceipt(order)}
            className="p-1 bg-accent text-accent-foreground rounded hover:bg-accent/80 transition-colors"
            title="Generate receipt"
          >
            <Receipt className="size-2" />
          </button>
          <select
            value={order.paymentStatus}
            onChange={(event) =>
              void onUpdateStatus(order.id, event.target.value as OrderRecord["paymentStatus"])
            }
            className="px-1 py-0.5 border border-line bg-panel text-ink text-xs font-mono rounded"
            title="Update status"
          >
            <option value="Pending">P</option>
            <option value="Paid">✓</option>
            <option value="Unpaid">✗</option>
            <option value="Cancelled">✕</option>
          </select>
        </div>
      </div>
    </div>
  </div>
);

export default Dashboard;
