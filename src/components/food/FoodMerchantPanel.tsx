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
  token: string;
  drivers: Driver[];
}

export const FoodMerchantPanel: React.FC<FoodMerchantPanelProps> = ({ token, drivers }) => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'MENU' | 'SETTINGS'>('ORDERS');
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [orderFilter, setOrderFilter] = useState<string>('ALL');

  // Config State
  const [store, setStore] = useState<FoodStore | null>(null);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [shippingRate, setShippingRate] = useState<FoodShippingRate | null>(null);

  // Modals for editing Menu
  const [editingCategory, setEditingCategory] = useState<Partial<FoodCategory> | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<FoodProduct> | null>(null);
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState<Record<string, string>>({});

  // Form states
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Load Merchant Data
  const fetchOrders = () => {
    setLoadingOrders(true);
    fetch('/api/food/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
        setLoadingOrders(false);
      })
      .catch(() => setLoadingOrders(false));
  };

  const fetchConfig = () => {
    fetch('/api/food/store/config', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.store) setStore(data.store);
        if (data.categories) setCategories(data.categories);
        if (data.products) setProducts(data.products);
        if (data.shippingRate) setShippingRate(data.shippingRate);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOrders();
    fetchConfig();
    const interval = setInterval(fetchOrders, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, [token]);

  // Handle Order Status Update
  const handleUpdateOrderStatus = async (
    orderId: string,
    orderStatus?: string,
    paymentStatus?: string,
    driverId?: string
  ) => {
    try {
      const res = await fetch(`/api/food/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderStatus, paymentStatus, driverId }),
      });

      if (res.ok) {
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al actualizar el estado');
      }
    } catch (err) {
      alert('Error de conexión');
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
        fetchConfig();
      }
    } catch (err) {}
  };

  // Category Save / Delete
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name) return;
    const isNew = !editingCategory.id;
    const url = isNew ? '/api/food/categories' : `/api/food/categories/${editingCategory.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingCategory),
      });
      if (res.ok) {
        setEditingCategory(null);
        fetchConfig();
      }
    } catch (err) {}
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta categoría?')) return;
    try {
      await fetch(`/api/food/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchConfig();
    } catch (err) {}
  };

  // Product Save / Delete
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.categoryId || editingProduct?.price === undefined) {
      alert('Nombre, Categoría y Precio son requeridos');
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
        setEditingProduct(null);
        fetchConfig();
      }
    } catch (err) {}
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    try {
      await fetch(`/api/food/products/${prodId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchConfig();
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
        alert('Tarifa de envío guardada con éxito.');
        fetchConfig();
      }
    } catch (err) {
      setSavingConfig(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'PENDING') return o.orderStatus === 'PENDING';
    if (orderFilter === 'PREPARING') return o.orderStatus === 'PREPARING';
    if (orderFilter === 'READY') return o.orderStatus === 'READY' || o.orderStatus === 'READY_FOR_PICKUP';
    if (orderFilter === 'DELIVERED') return o.orderStatus === 'PICKED_UP' || o.orderStatus === 'DELIVERED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Control */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-md shadow-orange-200">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">UBIKA FOOD CONTROL</h2>
              {store && (
                <button
                  onClick={handleToggleStoreOpen}
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase transition-all ${
                    store.isOpenManual
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {store.isOpenManual ? '● Local Abierto' : '○ Local Cerrado'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">Gestión de cocina, menú digital y despachos gastronómicos</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ORDERS'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-orange-400" />
            <span>Pedidos ({orders.filter((o) => o.orderStatus !== 'PICKED_UP' && o.orderStatus !== 'CANCELLED').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('MENU')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'MENU'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-orange-400" />
            <span>Menú / Platos</span>
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'SETTINGS'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-orange-400" />
            <span>Configuración</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE ORDERS BOARD */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          {/* Order Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'PENDING', label: 'Nuevos (Pendientes)' },
              { key: 'PREPARING', label: 'En Preparación' },
              { key: 'READY', label: 'Listos para Despacho / Retiro' },
              { key: 'DELIVERED', label: 'Entregados' },
            ].map((f) => (
              <button
                key={f.key}
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
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const isDelivery = order.deliveryType === 'FOOD_DELIVERY';
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3.5 shadow-xs flex flex-col justify-between"
                >
                  {/* Order Header */}
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">#{order.orderNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isDelivery ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
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
                    <div className="mt-2.5 text-xs text-slate-600 space-y-1">
                      <div className="font-bold text-slate-900 text-sm">{order.recipientName}</div>
                      <div>📞 {order.recipientPhone}</div>
                      {isDelivery && order.deliveryAddress && (
                        <div className="text-slate-500 font-medium truncate">📍 {order.deliveryAddress}</div>
                      )}
                      {!isDelivery && order.pickupCode && (
                        <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-center tracking-widest text-sm my-1.5 shadow-xs">
                          CÓDIGO: {order.pickupCode}
                        </div>
                      )}
                    </div>

                    {/* Payment Status */}
                    <div className="mt-2 text-[11px] font-bold p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <span>
                        Pago: {order.paymentMethod} (${order.totalAmount.toLocaleString('es-AR')})
                      </span>
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
                        <div key={idx} className="py-1.5 flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900">
                              {item.quantity}x {item.productName}
                            </span>
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="text-[10px] text-slate-500">
                                {item.selectedOptions.map((o) => o.optionName).join(', ')}
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-slate-700">${item.totalPrice.toLocaleString('es-AR')}</span>
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
                        Iniciar Preparación en Cocina 🍳
                      </button>
                    )}

                    {/* Action 2: Preparing -> Ready */}
                    {order.orderStatus === 'PREPARING' && (
                      <div className="space-y-2">
                        {isDelivery && (
                          <div>
                            <span className="block text-[10px] font-bold text-slate-500 mb-1">
                              Asignar Cadete para Entrega:
                            </span>
                            <select
                              value={selectedDriverForOrder[order.id] || ''}
                              onChange={(e) =>
                                setSelectedDriverForOrder({ ...selectedDriverForOrder, [order.id]: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                            >
                              <option value="">Seleccionar Cadete (Opcional)</option>
                              {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} ({d.vehicle})
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
                              undefined,
                              selectedDriverForOrder[order.id]
                            )
                          }
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                        >
                          {isDelivery ? 'Listo para Despacho / Cadete 🛵' : 'Listo para Retiro en Local 🏪'}
                        </button>
                      </div>
                    )}

                    {/* Approve Bank Transfer */}
                    {order.paymentStatus === 'PROCESSING' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, undefined, 'APPROVED')}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar Transferencia Bancaria</span>
                      </button>
                    )}

                    {/* Action 3: Mark Picked Up */}
                    {(order.orderStatus === 'READY' || order.orderStatus === 'READY_FOR_PICKUP') && !isDelivery && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'PICKED_UP', 'APPROVED')}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                      >
                        Entregado al Cliente en Mostrador ✓
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

      {/* TAB 2: MENU & PRODUCTS MANAGER */}
      {activeTab === 'MENU' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Categories */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Categorías</h3>
              <button
                onClick={() => setEditingCategory({ name: '', displayOrder: categories.length + 1 })}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva</span>
              </button>
            </div>

            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{cat.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {products.filter((p) => p.categoryId === cat.id).length} productos
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingCategory(cat)}
                      className="p-1.5 text-slate-500 hover:text-slate-900"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Products */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Productos del Menú</h3>
              <button
                onClick={() =>
                  setEditingProduct({
                    name: '',
                    categoryId: categories[0]?.id || '',
                    price: 0,
                    isAvailable: true,
                  })
                }
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Producto</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 text-xs block">{p.name}</span>
                    <span className="text-[11px] font-black text-orange-600 block mt-0.5">
                      ${p.price.toLocaleString('es-AR')}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingProduct(p)} className="p-1 text-slate-500 hover:text-slate-900">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="p-1 text-slate-500 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SHIPPING & STORE CONFIG */}
      {activeTab === 'SETTINGS' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <h3 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
            Tarifas de Envío y Datos Bancarios
          </h3>

          {shippingRate && (
            <form onSubmit={handleSaveShippingRate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">Tarifa Base ($)</span>
                  <input
                    type="number"
                    value={shippingRate.baseFee}
                    onChange={(e) => setShippingRate({ ...shippingRate, baseFee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">Km Incluidos en Base</span>
                  <input
                    type="number"
                    value={shippingRate.includedKm}
                    onChange={(e) => setShippingRate({ ...shippingRate, includedKm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">Costo por Km Extra ($)</span>
                  <input
                    type="number"
                    value={shippingRate.perKmFee}
                    onChange={(e) => setShippingRate({ ...shippingRate, perKmFee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1">Radio Máximo (Km)</span>
                  <input
                    type="number"
                    value={shippingRate.maxDistanceKm}
                    onChange={(e) => setShippingRate({ ...shippingRate, maxDistanceKm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-sm transition-all"
              >
                {savingConfig ? 'Guardando...' : 'Guardar Configuración de Envíos'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              {editingCategory.id ? 'Editar Categoría' : 'Nueva Categoría'}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">Nombre *</span>
                <input
                  type="text"
                  required
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Ej: Hamburguesas"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900">
              {editingProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">Categoría *</span>
                <select
                  required
                  value={editingProduct.categoryId || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  <option value="">Seleccionar Categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">Nombre del Producto *</span>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">Precio ($) *</span>
                <input
                  type="number"
                  required
                  value={editingProduct.price || 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">Descripción</span>
                <textarea
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                ></textarea>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">URL Imagen</span>
                <input
                  type="url"
                  value={editingProduct.imageUrl || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
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
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
