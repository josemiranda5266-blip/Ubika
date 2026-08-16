import React, { useState, useEffect } from 'react';
import {
  Utensils,
  ShoppingBag,
  Clock,
  Check,
  X,
  Plus,
  Edit2,
  Trash2,
  Truck,
  Building2,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Sliders,
  Store,
  MapPin,
  QrCode,
  ShieldCheck,
  LayoutDashboard,
  Layers,
  FileText,
  Phone,
  CreditCard,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import {
  FoodOrder,
  FoodStore,
  FoodCategory,
  FoodProduct,
  FoodShippingRate,
  Driver,
} from '../../types';

interface FoodMerchantPanelProps {
  companyId?: string;
  token?: string;
  drivers?: Driver[];
  onOpenCustomerView?: () => void;
}

export type FoodMerchantTab = 'OVERVIEW' | 'ORDERS' | 'PRODUCTS' | 'CATEGORIES' | 'SETTINGS' | 'SHIPPING';

export const FoodMerchantPanel: React.FC<FoodMerchantPanelProps> = ({
  companyId = 'comp_food_don_pedro_01',
  token = '',
  drivers = [],
  onOpenCustomerView,
}) => {
  const [activeTab, setActiveTab] = useState<FoodMerchantTab>('ORDERS');
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [orderFilter, setOrderFilter] = useState<string>('ALL');

  // Config State
  const [store, setStore] = useState<FoodStore | null>(null);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [shippingRate, setShippingRate] = useState<FoodShippingRate | null>(null);

  // Modals for editing Menu & Actions
  const [editingCategory, setEditingCategory] = useState<Partial<FoodCategory> | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<FoodProduct> | null>(null);
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState<Record<string, string>>({});
  const [pickupCodeInput, setPickupCodeInput] = useState<Record<string, string>>({});
  const [pickupError, setPickupError] = useState<Record<string, string>>({});

  // Form states
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Load Merchant Orders
  const fetchOrders = () => {
    if (!token) return;
    setLoadingOrders(true);
    fetch('/api/food/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar pedidos');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
        setLoadingOrders(false);
      })
      .catch(() => setLoadingOrders(false));
  };

  // Load Merchant Config
  const fetchConfig = () => {
    if (!token) return;
    fetch('/api/food/store/config', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar configuración');
        return res.json();
      })
      .then((data) => {
        if (data.store) setStore(data.store);
        if (data.categories) setCategories(data.categories);
        if (data.products) setProducts(data.products);
        if (data.shippingRate) setShippingRate(data.shippingRate);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (token) {
      fetchOrders();
      fetchConfig();
      const interval = setInterval(fetchOrders, 6000); // Polling every 6s
      return () => clearInterval(interval);
    }
  }, [token, companyId]);

  // Update Order Status
  const handleUpdateOrderStatus = async (
    orderId: string,
    orderStatus?: string,
    driverId?: string
  ) => {
    try {
      const res = await fetch(`/api/food/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderStatus, driverId }),
      });

      if (res.ok) {
        showNotification('Estado del pedido actualizado correctamente.');
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al actualizar el estado del pedido');
      }
    } catch (err) {
      alert('Error de conexión con el servidor');
    }
  };

  // Approve Payment
  const handleApprovePayment = async (orderId: string) => {
    try {
      const res = await fetch(`/api/food/orders/${orderId}/payment/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        showNotification('Pago aprobado y registrado con éxito.');
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al aprobar el pago');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  // Validate Pickup Code at Counter
  const handleValidatePickupCode = async (orderId: string) => {
    const code = pickupCodeInput[orderId];
    if (!code) {
      setPickupError({ ...pickupError, [orderId]: 'Ingrese el código de retiro' });
      return;
    }

    try {
      const res = await fetch(`/api/food/orders/${orderId}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pickupCode: code.trim().toUpperCase() }),
      });

      if (res.ok) {
        showNotification('¡Código verificado! Pedido entregado al cliente.');
        setPickupCodeInput({ ...pickupCodeInput, [orderId]: '' });
        setPickupError({ ...pickupError, [orderId]: '' });
        fetchOrders();
      } else {
        const data = await res.json();
        setPickupError({ ...pickupError, [orderId]: data.error || 'Código incorrecto' });
      }
    } catch (err) {
      setPickupError({ ...pickupError, [orderId]: 'Error de conexión' });
    }
  };

  // Toggle Store Manual Open
  const handleToggleStoreOpen = async () => {
    if (!store) return;
    try {
      const updatedOpen = !store.isOpenManual;
      const res = await fetch('/api/food/store/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isOpenManual: updatedOpen }),
      });
      if (res.ok) {
        showNotification(updatedOpen ? 'Cocina y local abiertos al público.' : 'Cocina cerrada para nuevos pedidos.');
        fetchConfig();
      }
    } catch (err) {}
  };

  // Save Store General Settings
  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/food/store/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(store),
      });
      setSavingConfig(false);
      if (res.ok) {
        showNotification('Configuración del comercio guardada con éxito.');
        fetchConfig();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar la configuración');
      }
    } catch (err) {
      setSavingConfig(false);
      alert('Error de conexión');
    }
  };

  // Category Save / Toggle / Reorder / Delete
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name?.trim()) {
      alert('El nombre de la categoría es obligatorio');
      return;
    }
    const isNew = !editingCategory.id;
    const url = isNew ? '/api/food/categories' : `/api/food/categories/${editingCategory.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const payload = {
      ...editingCategory,
      name: editingCategory.name.trim(),
      displayOrder: typeof editingCategory.displayOrder === 'number' ? editingCategory.displayOrder : categories.length + 1,
      active: editingCategory.active !== false,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showNotification(isNew ? 'Categoría creada exitosamente.' : 'Categoría actualizada exitosamente.');
        setEditingCategory(null);
        fetchConfig();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar categoría');
      }
    } catch (err) {
      alert('Error de conexión al guardar categoría');
    }
  };

  const handleToggleCategoryActive = async (cat: FoodCategory) => {
    const newStatus = !cat.active;
    try {
      const res = await fetch(`/api/food/categories/${cat.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: newStatus }),
      });
      if (res.ok) {
        showNotification(`Categoría "${cat.name}" ${newStatus ? 'activada' : 'desactivada'} en el menú.`);
        fetchConfig();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al actualizar el estado de la categoría');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const handleMoveCategoryOrder = async (cat: FoodCategory, direction: 'UP' | 'DOWN') => {
    const currentOrder = cat.displayOrder || 1;
    const newOrder = direction === 'UP' ? Math.max(1, currentOrder - 1) : currentOrder + 1;
    if (newOrder === currentOrder) return;

    try {
      const res = await fetch(`/api/food/categories/${cat.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayOrder: newOrder }),
      });
      if (res.ok) {
        fetchConfig();
      }
    } catch (err) {}
  };

  const handleDeleteCategory = async (cat: FoodCategory) => {
    const productCount = products.filter((p) => p.categoryId === cat.id).length;
    if (productCount > 0) {
      alert(
        `No se puede eliminar la categoría "${cat.name}" porque tiene ${productCount} producto(s) asociado(s).\n\nPodés desactivarla para ocultarla del menú digital de tus clientes sin perder tus productos.`
      );
      return;
    }

    if (!confirm(`¿Seguro que deseas eliminar definitivamente la categoría "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/food/categories/${cat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification(`Categoría "${cat.name}" eliminada.`);
        fetchConfig();
      } else {
        const data = await res.json();
        alert(data.error || 'No se pudo eliminar la categoría');
      }
    } catch (err) {
      alert('Error de conexión al eliminar categoría');
    }
  };

  // Product Save / Delete
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.categoryId || editingProduct?.price === undefined) {
      alert('Nombre, Categoría y Precio son obligatorios');
      return;
    }
    const isNew = !editingProduct.id;
    const url = isNew ? '/api/food/products' : `/api/food/products/${editingProduct.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingProduct),
      });
      if (res.ok) {
        showNotification('Producto guardado exitosamente.');
        setEditingProduct(null);
        fetchConfig();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar producto');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/food/products/${prodId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification('Producto eliminado.');
        fetchConfig();
      }
    } catch (err) {}
  };

  // Shipping Rate Save
  const handleSaveShippingRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingRate) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/food/shipping-rate', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(shippingRate),
      });
      setSavingConfig(false);
      if (res.ok) {
        showNotification('Tarifas de delivery guardadas con éxito.');
        fetchConfig();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar tarifas');
      }
    } catch (err) {
      setSavingConfig(false);
      alert('Error de conexión');
    }
  };

  // Metrics Calculation
  const totalSales = orders
    .filter((o) => o.paymentStatus === 'APPROVED')
    .reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const activeOrdersCount = orders.filter(
    (o) => o.orderStatus !== 'PICKED_UP' && o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED'
  ).length;
  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'PENDING').length;
  const preparingOrdersCount = orders.filter((o) => o.orderStatus === 'PREPARING').length;
  const readyOrdersCount = orders.filter((o) => o.orderStatus === 'READY' || o.orderStatus === 'READY_FOR_PICKUP').length;

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'PENDING') return o.orderStatus === 'PENDING';
    if (orderFilter === 'PREPARING') return o.orderStatus === 'PREPARING';
    if (orderFilter === 'READY') return o.orderStatus === 'READY' || o.orderStatus === 'READY_FOR_PICKUP';
    if (orderFilter === 'DELIVERED') return o.orderStatus === 'PICKED_UP' || o.orderStatus === 'DELIVERED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl text-xs font-black shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Tab Navigation */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl shadow-md shadow-orange-200">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">
                {store?.name || 'Hamburguesería Don Pedro'}
              </h2>
              {store && (
                <button
                  id="btn-toggle-store-open"
                  onClick={handleToggleStoreOpen}
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-xs ${
                    store.isOpenManual
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${store.isOpenManual ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`}></span>
                  <span>{store.isOpenManual ? 'Local Abierto' : 'Local Cerrado'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Panel Integral de Administración Gastronómica y Cocina en Tiempo Real
            </p>
          </div>
        </div>

        {/* 6 Sub-Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full xl:w-auto overflow-x-auto">
          <button
            id="tab-merchant-overview"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-amber-400" />
            <span>Inicio</span>
          </button>

          <button
            id="tab-merchant-orders"
            onClick={() => setActiveTab('ORDERS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'ORDERS'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Pedidos ({activeOrdersCount})</span>
          </button>

          <button
            id="tab-merchant-products"
            onClick={() => setActiveTab('PRODUCTS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'PRODUCTS'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-amber-400" />
            <span>Productos ({products.length})</span>
          </button>

          <button
            id="tab-merchant-categories"
            onClick={() => setActiveTab('CATEGORIES')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'CATEGORIES'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Categorías ({categories.length})</span>
          </button>

          <button
            id="tab-merchant-settings"
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'SETTINGS'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Configuración</span>
          </button>

          <button
            id="tab-merchant-shipping"
            onClick={() => setActiveTab('SHIPPING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'SHIPPING'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4 text-amber-400" />
            <span>Tarifas / Delivery</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: OVERVIEW (INICIO) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pedidos Activos</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900">{activeOrdersCount}</div>
              <p className="text-xs text-slate-500 font-medium">
                {pendingOrdersCount} pendientes • {preparingOrdersCount} en cocina
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Facturación Cobrada</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-emerald-600">
                ${totalSales.toLocaleString('es-AR')}
              </div>
              <p className="text-xs text-slate-500 font-medium">Total de pedidos con pago confirmado</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Menú Gastronómico</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Utensils className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900">{products.length}</div>
              <p className="text-xs text-slate-500 font-medium">{categories.length} categorías activas</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cadetes Propios</span>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900">{drivers.length}</div>
              <p className="text-xs text-slate-500 font-medium">Asignados a este comercio</p>
            </div>
          </div>

          {/* Quick Actions & Recent Orders Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">Últimos Pedidos Recibidos</h3>
                <button
                  onClick={() => setActiveTab('ORDERS')}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700"
                >
                  Ver todos los pedidos →
                </button>
              </div>

              <div className="space-y-3">
                {orders.slice(0, 4).map((order) => (
                  <div
                    key={order.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">#{order.orderNumber}</span>
                        <span className="text-xs font-bold text-slate-600">{order.recipientName}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {order.deliveryType === 'FOOD_DELIVERY' ? '🛵 Delivery' : '🏪 Retiro'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-sm">
                        ${order.totalAmount.toLocaleString('es-AR')}
                      </div>
                      <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {order.orderStatus}
                      </span>
                    </div>
                  </div>
                ))}

                {orders.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs font-medium">
                    No hay pedidos registrados en este momento.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Navigation Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">Accesos Rápidos</span>
                <h4 className="text-lg font-black mt-1">Gestión del Menú y Cocina</h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Podés actualizar precios, agregar opciones a las hamburguesas o ajustar los horarios de atención al cliente.
                </p>
              </div>

              <div className="space-y-2 pt-4">
                <button
                  onClick={() => setActiveTab('PRODUCTS')}
                  className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-between"
                >
                  <span>Administrar Menú / Platos</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => setActiveTab('SETTINGS')}
                  className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-between"
                >
                  <span>Datos del Comercio y Banco</span>
                  <span>→</span>
                </button>
                {onOpenCustomerView && (
                  <button
                    onClick={onOpenCustomerView}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center justify-between shadow-md"
                  >
                    <span>Ver Menú Digital como Cliente</span>
                    <span>↗</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ORDERS BOARD (PEDIDOS) */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          {/* Order Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { key: 'ALL', label: `Todos (${orders.length})` },
              { key: 'PENDING', label: `Nuevos / Pendientes (${pendingOrdersCount})` },
              { key: 'PREPARING', label: `En Cocina (${preparingOrdersCount})` },
              { key: 'READY', label: `Listos (${readyOrdersCount})` },
              { key: 'DELIVERED', label: 'Entregados' },
            ].map((f) => (
              <button
                key={f.key}
                id={`filter-orders-${f.key.toLowerCase()}`}
                onClick={() => setOrderFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  orderFilter === f.key
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}

            <button
              onClick={fetchOrders}
              className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 ml-auto"
              title="Refrescar"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const isDelivery = order.deliveryType === 'FOOD_DELIVERY';
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs flex flex-col justify-between"
                >
                  {/* Order Header */}
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">#{order.orderNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isDelivery
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isDelivery ? '🛵 Delivery' : '🏪 Retiro Local'}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          order.orderStatus === 'PENDING'
                            ? 'bg-rose-100 text-rose-700 animate-pulse'
                            : order.orderStatus === 'PREPARING'
                            ? 'bg-amber-100 text-amber-800'
                            : order.orderStatus === 'READY' || order.orderStatus === 'READY_FOR_PICKUP'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {order.orderStatus}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="mt-3 text-xs text-slate-600 space-y-1">
                      <div className="font-bold text-slate-900 text-sm">{order.recipientName}</div>
                      <div>📞 {order.recipientPhone}</div>
                      {isDelivery && order.deliveryAddress && (
                        <div className="text-slate-500 font-medium truncate">📍 {order.deliveryAddress}</div>
                      )}
                      {!isDelivery && order.pickupCode && (
                        <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-center tracking-widest text-sm my-1.5 shadow-xs">
                          CÓDIGO ESPERADO: {order.pickupCode}
                        </div>
                      )}
                    </div>

                    {/* Payment Status & Approval */}
                    <div className="mt-3 text-[11px] font-bold p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Forma de Pago</span>
                        <span className="text-slate-900">
                          {order.paymentMethod} (${order.totalAmount.toLocaleString('es-AR')})
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black ${
                          order.paymentStatus === 'APPROVED'
                            ? 'bg-emerald-500 text-white'
                            : order.paymentStatus === 'PROCESSING'
                            ? 'bg-amber-500 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </div>

                    {/* Order Items */}
                    <div className="mt-3 divide-y divide-slate-100 text-xs">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="py-2 flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900">
                              {item.quantity}x {item.productName}
                            </span>
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                + {item.selectedOptions.map((o) => o.optionName).join(', ')}
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-slate-700">
                            ${item.totalPrice.toLocaleString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    {/* Action 1: Pending -> Preparing */}
                    {order.orderStatus === 'PENDING' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')}
                        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                      >
                        🍳 Iniciar Preparación en Cocina
                      </button>
                    )}

                    {/* Action 2: Preparing -> Ready */}
                    {order.orderStatus === 'PREPARING' && (
                      <div className="space-y-2">
                        {isDelivery && drivers.length > 0 && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Asignar Cadete de la Empresa:
                            </label>
                            <select
                              value={selectedDriverForOrder[order.id] || drivers[0]?.id}
                              onChange={(e) =>
                                setSelectedDriverForOrder({
                                  ...selectedDriverForOrder,
                                  [order.id]: e.target.value,
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                            >
                              {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} ({d.vehicle || 'moto'})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(
                              order.id,
                              'READY',
                              selectedDriverForOrder[order.id] || drivers[0]?.id
                            )
                          }
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                        >
                          {isDelivery ? '🛵 Listo para Despacho / Cadete' : '🏪 Listo para Retiro en Mostrador'}
                        </button>
                      </div>
                    )}

                    {/* Action 3: Pickup Verification via Code */}
                    {!isDelivery && (order.orderStatus === 'READY' || order.orderStatus === 'READY_FOR_PICKUP' || order.orderStatus === 'PREPARING') && (
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <span className="block text-[10px] font-black uppercase text-slate-600">
                          Validar Retiro del Cliente (Código)
                        </span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Ej: DP107"
                            value={pickupCodeInput[order.id] || ''}
                            onChange={(e) =>
                              setPickupCodeInput({ ...pickupCodeInput, [order.id]: e.target.value.toUpperCase() })
                            }
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-center"
                          />
                          <button
                            onClick={() => handleValidatePickupCode(order.id)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
                          >
                            Validar
                          </button>
                        </div>
                        {pickupError[order.id] && (
                          <p className="text-[10px] font-bold text-rose-600">{pickupError[order.id]}</p>
                        )}
                      </div>
                    )}

                    {/* Approve Bank Transfer */}
                    {order.paymentStatus === 'PROCESSING' && (
                      <button
                        onClick={() => handleApprovePayment(order.id)}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aprobar Comprobante de Transferencia</span>
                      </button>
                    )}

                    {/* Direct mark as Delivered if Delivery is completed */}
                    {isDelivery && order.orderStatus === 'IN_TRANSIT' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED')}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                      >
                        Confirmar Entrega al Destinatario ✓
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 p-8">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600">No hay pedidos en este estado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PRODUCTS MANAGER (PRODUCTOS) */}
      {activeTab === 'PRODUCTS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Catálogo de Productos</h3>
              <p className="text-xs text-slate-500">
                Gestioná los platos, precios, descripciones y disponibilidad de tu cocina.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (categories.length === 0) {
                    setEditingCategory({ name: '', displayOrder: 1, active: true });
                    return;
                  }
                  setEditingProduct({
                    name: '',
                    categoryId: categories[0]?.id || '',
                    price: 0,
                    isAvailable: true,
                    description: '',
                  });
                }}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Producto</span>
              </button>
            </div>
          </div>

          {/* Empty categories warning banner if merchant has no categories */}
          {categories.length === 0 && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-amber-900">No tenés categorías creadas</h4>
                  <p className="text-xs text-amber-700">
                    Creá al menos una categoría para poder agregar y clasificar los productos de tu menú.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCategory({ name: '', displayOrder: 1, active: true })}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl whitespace-nowrap shadow-xs"
              >
                + Crear Categoría
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <div
                  key={p.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-3 flex flex-col justify-between"
                >
                  <div>
                    {p.imageUrl && (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-32 object-cover rounded-xl mb-3 border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {cat?.name || 'Sin Categoría'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.isAvailable ? 'Disponible' : 'Pausado'}
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm mt-1">{p.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">
                      ${p.price.toLocaleString('es-AR')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingProduct(p)}
                        className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {products.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400 text-xs font-bold">
                No hay productos cargados en el menú.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: CATEGORIES MANAGER (CATEGORÍAS) */}
      {activeTab === 'CATEGORIES' && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Categorías del Menú</h3>
              <p className="text-xs text-slate-500">
                Organizá las secciones dinámicas que verán tus clientes en el menú digital.
              </p>
            </div>
            <button
              onClick={() =>
                setEditingCategory({
                  name: '',
                  description: '',
                  displayOrder: categories.length + 1,
                  active: true,
                })
              }
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Categoría</span>
            </button>
          </div>

          <div className="space-y-3">
            {categories.map((cat, idx) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    cat.active
                      ? 'bg-slate-50 border-slate-200/80'
                      : 'bg-slate-100/60 border-dashed border-slate-300 opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => handleMoveCategoryOrder(cat, 'UP')}
                        disabled={idx === 0}
                        title="Subir orden"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center">
                        {cat.displayOrder || idx + 1}
                      </div>
                      <button
                        onClick={() => handleMoveCategoryOrder(cat, 'DOWN')}
                        disabled={idx === categories.length - 1}
                        title="Bajar orden"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-sm">{cat.name}</h4>
                        <button
                          onClick={() => handleToggleCategoryActive(cat)}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-all flex items-center gap-1 ${
                            cat.active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title="Hacé click para cambiar estado"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cat.active ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          ></span>
                          <span>{cat.active ? 'Activa' : 'Inactiva'}</span>
                        </button>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                      )}
                      <span className="text-[11px] font-bold text-slate-400 mt-1 block">
                        {count} {count === 1 ? 'producto asociado' : 'productos asociados'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      onClick={() => setEditingCategory(cat)}
                      className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
                      title="Editar categoría"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className={`p-2 bg-white rounded-xl border shadow-xs transition-all ${
                        count > 0
                          ? 'border-slate-200 text-slate-400 hover:text-amber-600'
                          : 'border-slate-200 text-slate-600 hover:text-rose-600'
                      }`}
                      title={
                        count > 0
                          ? `Categoría con ${count} producto(s). Desactivala para ocultar del menú.`
                          : 'Eliminar categoría'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {categories.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                No hay categorías cargadas para este comercio. Creá tu primera categoría con el botón de arriba.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: STORE SETTINGS & BANK INFO (CONFIGURACIÓN) */}
      {activeTab === 'SETTINGS' && store && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900">Configuración del Comercio</h3>
            <p className="text-xs text-slate-500">Datos públicos, horarios y cuenta bancaria para transferencias.</p>
          </div>

          <form onSubmit={handleSaveStoreSettings} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Comercio *</label>
                <input
                  type="text"
                  required
                  value={store.name}
                  onChange={(e) => setStore({ ...store, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                <input
                  type="text"
                  required
                  value={store.phone}
                  onChange={(e) => setStore({ ...store, phone: e.target.value, whatsappNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Dirección del Local *</label>
                <input
                  type="text"
                  required
                  value={store.address}
                  onChange={(e) => setStore({ ...store, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Slogan</label>
                <textarea
                  rows={2}
                  value={store.description}
                  onChange={(e) => setStore({ ...store, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Bank Info Section */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                <span>Datos Bancarios para Transferencias</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Banco / Entidad</label>
                  <input
                    type="text"
                    value={store.bankInfo?.bankName || ''}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        bankInfo: { ...store.bankInfo, bankName: e.target.value },
                      })
                    }
                    placeholder="Ej: Banco Galicia / Mercado Pago"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Titular de la Cuenta</label>
                  <input
                    type="text"
                    value={store.bankInfo?.holderName || ''}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        bankInfo: { ...store.bankInfo, holderName: e.target.value },
                      })
                    }
                    placeholder="Ej: Pedro Hamburguesas SRL"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alias Bancario</label>
                  <input
                    type="text"
                    value={store.bankInfo?.alias || ''}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        bankInfo: { ...store.bankInfo, alias: e.target.value },
                      })
                    }
                    placeholder="Ej: DONPEDRO.FOOD.MP"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CBU / CVU</label>
                  <input
                    type="text"
                    value={store.bankInfo?.cbu || ''}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        bankInfo: { ...store.bankInfo, cbu: e.target.value },
                      })
                    }
                    placeholder="22 dígitos"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-all"
            >
              {savingConfig ? 'Guardando...' : 'Guardar Datos del Comercio'}
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 6: SHIPPING RATES & DELIVERY GPS (TARIFAS) */}
      {activeTab === 'SHIPPING' && shippingRate && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900">Tarifas y Radio de Delivery</h3>
            <p className="text-xs text-slate-500">
              Configurá el costo de envío según la distancia en kilómetros desde el local.
            </p>
          </div>

          <form onSubmit={handleSaveShippingRate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tarifa Base ($) *</label>
                <input
                  type="number"
                  required
                  value={shippingRate.baseFee}
                  onChange={(e) =>
                    setShippingRate({ ...shippingRate, baseFee: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Km Incluidos en Base *</label>
                <input
                  type="number"
                  required
                  value={shippingRate.includedKm}
                  onChange={(e) =>
                    setShippingRate({ ...shippingRate, includedKm: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Costo por Km Extra ($) *</label>
                <input
                  type="number"
                  required
                  value={shippingRate.perKmFee}
                  onChange={(e) =>
                    setShippingRate({ ...shippingRate, perKmFee: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Radio Máximo de Entrega (Km) *</label>
                <input
                  type="number"
                  required
                  value={shippingRate.maxDistanceKm}
                  onChange={(e) =>
                    setShippingRate({ ...shippingRate, maxDistanceKm: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto Mínimo Envío Gratis ($)</label>
                <input
                  type="number"
                  value={shippingRate.freeShippingThreshold || ''}
                  onChange={(e) =>
                    setShippingRate({
                      ...shippingRate,
                      freeShippingThreshold: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="Opcional"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Coordenadas del Local (Lat, Lng)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.000001"
                    value={shippingRate.storeLatitude}
                    onChange={(e) =>
                      setShippingRate({ ...shippingRate, storeLatitude: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={shippingRate.storeLongitude}
                    onChange={(e) =>
                      setShippingRate({ ...shippingRate, storeLongitude: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-sm transition-all"
            >
              {savingConfig ? 'Guardando...' : 'Guardar Tarifas de Envío'}
            </button>
          </form>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editingCategory.id ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button
                onClick={() => setEditingCategory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Categoría *</label>
                <input
                  type="text"
                  required
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Ej: Sándwiches, Promociones, Postres..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción (Opcional)</label>
                <textarea
                  rows={2}
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Breve descripción o detalle que verán los clientes..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Orden de Visualización</label>
                <input
                  type="number"
                  min={1}
                  value={editingCategory.displayOrder || 1}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, displayOrder: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="category-active-toggle"
                  checked={editingCategory.active !== false}
                  onChange={(e) => setEditingCategory({ ...editingCategory, active: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="category-active-toggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Categoría activa (visible en el Menú Digital para clientes)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editingProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3 text-center">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                <p className="text-xs font-bold text-amber-900">
                  No hay categorías creadas. Creá una categoría para poder agregar productos.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setEditingCategory({ name: '', displayOrder: 1, active: true });
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs"
                >
                  + Crear categoría
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProduct} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoría *</label>
                  <select
                    required
                    value={editingProduct.categoryId || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  >
                    <option value="">Seleccionar Categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {!c.active ? '(Inactiva)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Producto *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="Ej: Hamburguesa Doble Cheddar"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Precio ($) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    value={editingProduct.description || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    placeholder="Ingredientes, medallón, salsas..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">URL de Imagen</label>
                  <input
                    type="url"
                    value={editingProduct.imageUrl || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="product-available"
                    checked={editingProduct.isAvailable !== false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, isAvailable: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="product-available" className="text-xs font-bold text-slate-700">
                    Producto disponible para la venta
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Guardar Producto
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
