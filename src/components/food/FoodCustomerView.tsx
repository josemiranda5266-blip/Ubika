import React, { useState, useEffect } from 'react';
import {
  Utensils,
  ShoppingBag,
  MapPin,
  Clock,
  Phone,
  ArrowLeft,
  Plus,
  Minus,
  Check,
  X,
  Navigation,
  CreditCard,
  Building2,
  Copy,
  MessageCircle,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Search,
  ExternalLink,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import {
  FoodStore,
  FoodCategory,
  FoodProduct,
  FoodShippingRate,
  FoodOrder,
  FoodOrderItem,
  LocationCoords,
} from '../../types';

interface FoodCustomerViewProps {
  companyId: string;
  orderIdParam?: string;
  onBackToApp?: () => void;
}

interface CartItem {
  productId: string;
  product: FoodProduct;
  quantity: number;
  selectedOptions: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    price: number;
  }[];
  itemNotes?: string;
  unitPrice: number; // base + options
}

export const FoodCustomerView: React.FC<FoodCustomerViewProps> = ({
  companyId,
  orderIdParam,
  onBackToApp,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<FoodStore | null>(null);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [shippingRate, setShippingRate] = useState<FoodShippingRate | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Customization Modal State
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null);
  const [modalOptionSelections, setModalOptionSelections] = useState<Record<string, string[]>>({});
  const [modalItemNotes, setModalItemNotes] = useState<string>('');
  const [modalQuantity, setModalQuantity] = useState<number>(1);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Checkout Flow State
  const [checkoutStep, setCheckoutStep] = useState<'CART' | 'DETAILS' | 'SUCCESS'>('CART');
  const [deliveryType, setDeliveryType] = useState<'FOOD_DELIVERY' | 'FOOD_PICKUP'>('FOOD_DELIVERY');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  
  // GPS State
  const [locationCoords, setLocationCoords] = useState<LocationCoords | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [calculatedShippingCost, setCalculatedShippingCost] = useState<number | null>(null);
  const [shippingDistanceKm, setShippingDistanceKm] = useState<number | null>(null);
  const [calculatingShipping, setCalculatingShipping] = useState<boolean>(false);

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'MERCADO_PAGO'>('CASH');

  // Order Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<FoodOrder | null>(null);
  const [activeOrderDetails, setActiveOrderDetails] = useState<any | null>(null);

  // Copied alert state
  const [copiedAlias, setCopiedAlias] = useState<boolean>(false);
  const [copiedCbu, setCopiedCbu] = useState<boolean>(false);
  const [transferReported, setTransferReported] = useState<boolean>(false);

  // Fetch Store Data
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    fetch(`/api/food/store/${companyId}`)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el comercio');
        return res.json();
      })
      .then((data) => {
        setStore(data.store);
        setCategories(data.categories || []);
        setProducts(data.products || []);
        setShippingRate(data.shippingRate || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Error al conectar con el comercio');
        setLoading(false);
      });
  }, [companyId]);

  // Load order details if orderIdParam exists
  useEffect(() => {
    if (orderIdParam) {
      fetch(`/api/food/orders/public/${orderIdParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setActiveOrderDetails(data);
            setCheckoutStep('SUCCESS');
          }
        })
        .catch(() => {});
    }
  }, [orderIdParam]);

  // Recalculate Shipping Cost whenever GPS location changes
  useEffect(() => {
    if (deliveryType === 'FOOD_DELIVERY' && locationCoords && companyId) {
      setCalculatingShipping(true);
      fetch('/api/food/calculate-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setCalculatingShipping(false);
          if (data.error) {
            setGpsError(data.error);
            setCalculatedShippingCost(null);
            setShippingDistanceKm(data.distanceKm || null);
          } else {
            setGpsError(null);
            setCalculatedShippingCost(data.shippingCost);
            setShippingDistanceKm(data.distanceKm);
          }
        })
        .catch(() => {
          setCalculatingShipping(false);
          setGpsError('Error calculando costo de envío');
        });
    }
  }, [locationCoords, deliveryType, companyId]);

  // Handle GPS Consent
  const handleRequestGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no soporta geolocalización GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setLocationCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          updatedAt: Date.now(),
        });
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Permiso de GPS denegado. Para entregas a domicilio necesitamos tu ubicación.');
        } else {
          setGpsError('No se pudo obtener la posición GPS. Intenta de nuevo.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Open Product Modal
  const handleOpenProductModal = (product: FoodProduct) => {
    setSelectedProduct(product);
    setModalQuantity(1);
    setModalItemNotes('');
    setModalOptionSelections({});
  };

  const handleToggleModalOption = (groupId: string, optionId: string, maxSelections = 1) => {
    setModalOptionSelections((prev) => {
      const current = prev[groupId] || [];
      if (maxSelections === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxSelections) {
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const calculateModalUnitPrice = (): number => {
    if (!selectedProduct) return 0;
    let total = selectedProduct.price;
    if (selectedProduct.optionGroups) {
      for (const grp of selectedProduct.optionGroups) {
        const selectedIds = modalOptionSelections[grp.id] || [];
        for (const optId of selectedIds) {
          const matched = grp.options.find((o) => o.id === optId);
          if (matched) total += matched.price;
        }
      }
    }
    return total;
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const unitPrice = calculateModalUnitPrice();
    const optionsList: CartItem['selectedOptions'] = [];

    if (selectedProduct.optionGroups) {
      for (const grp of selectedProduct.optionGroups) {
        const selectedIds = modalOptionSelections[grp.id] || [];
        for (const optId of selectedIds) {
          const matched = grp.options.find((o) => o.id === optId);
          if (matched) {
            optionsList.push({
              groupId: grp.id,
              groupName: grp.name,
              optionId: matched.id,
              optionName: matched.name,
              price: matched.price,
            });
          }
        }
      }
    }

    const newItem: CartItem = {
      productId: selectedProduct.id,
      product: selectedProduct,
      quantity: modalQuantity,
      selectedOptions: optionsList,
      itemNotes: modalItemNotes.trim() || undefined,
      unitPrice,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedProduct(null);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCartQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(index);
      return;
    }
    setCart((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: newQty } : item))
    );
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const effectiveShippingCost = deliveryType === 'FOOD_DELIVERY' ? (calculatedShippingCost || 0) : 0;
  const cartTotal = cartSubtotal + effectiveShippingCost;

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !recipientPhone.trim()) {
      alert('Por favor ingresa tu Nombre y Teléfono (WhatsApp)');
      return;
    }

    if (deliveryType === 'FOOD_DELIVERY') {
      if (!locationCoords) {
        alert('Para envíos a domicilio debes compartir tu ubicación GPS.');
        return;
      }
      if (gpsError) {
        alert(gpsError);
        return;
      }
    }

    if (deliveryType === 'FOOD_DELIVERY' && paymentMethod === 'TRANSFER') {
      alert('Las transferencias bancarias no están habilitadas para envíos a domicilio. Por favor selecciona Efectivo.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        companyId,
        deliveryType,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions.map((o) => ({ optionId: o.optionId })),
          itemNotes: item.itemNotes,
        })),
        recipientName,
        recipientPhone,
        generalNotes,
        deliveryAddress: deliveryType === 'FOOD_DELIVERY' ? deliveryAddress : undefined,
        recipientLocation: deliveryType === 'FOOD_DELIVERY' ? locationCoords : undefined,
        paymentMethod: deliveryType === 'FOOD_PICKUP' ? paymentMethod : 'CASH',
      };

      const res = await fetch('/api/food/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (!res.ok) {
        alert(data.error || 'Ocurrió un error al procesar el pedido');
        return;
      }

      setCompletedOrder(data.order);
      setActiveOrderDetails(data.order);
      setCart([]);
      setCheckoutStep('SUCCESS');
      window.location.hash = `#food/order/${data.order.id}`;
    } catch (err) {
      setIsSubmitting(false);
      alert('Error de conexión al enviar el pedido');
    }
  };

  const handleReportTransfer = async () => {
    if (!activeOrderDetails?.id) return;
    try {
      const res = await fetch(`/api/food/orders/public/${activeOrderDetails.id}/report-transfer`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setTransferReported(true);
        setActiveOrderDetails(data.order);
      }
    } catch (err) {}
  };

  const handleCopy = (text: string, type: 'alias' | 'cbu') => {
    navigator.clipboard.writeText(text);
    if (type === 'alias') {
      setCopiedAlias(true);
      setTimeout(() => setCopiedAlias(false), 2000);
    } else {
      setCopiedCbu(true);
      setTimeout(() => setCopiedCbu(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400">Cargando menú de UBIKA FOOD...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-black mb-2">Comercio no encontrado</h2>
        <p className="text-slate-400 max-w-md mb-6">{error || 'No se pudo cargar el comercio solicitado.'}</p>
        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
          >
            Volver a la app
          </button>
        )}
      </div>
    );
  }

  const filteredProducts = products.filter((p) => {
    const matchesCat = activeCategory === 'ALL' || p.categoryId === activeCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-28">
      {/* Top Header Banner */}
      <div className="relative bg-slate-900 text-white overflow-hidden shadow-md">
        {store.coverImageUrl ? (
          <div className="absolute inset-0 z-0 opacity-40">
            <img src={store.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-orange-600 via-slate-900 to-slate-900 opacity-90"></div>
        )}

        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-orange-500 text-white shadow-sm">
                UBIKA FOOD
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  store.isOpen ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}
              >
                {store.isOpen ? 'ABIERTO AHORA' : 'CERRADO'}
              </span>
            </div>

            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all backdrop-blur-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
            )}
          </div>

          <div className="flex items-start gap-4">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
                <Utensils className="w-8 h-8" />
              </div>
            )}

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{store.name}</h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 line-clamp-2">{store.description}</p>
              
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-300">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                  <span>{store.address}</span>
                </div>
                {store.whatsappNumber && (
                  <a
                    href={`https://wa.me/${store.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* VIEW MODE: CATALOG / MENU */}
        {checkoutStep === 'CART' && (
          <>
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar hamburguesas, papas, bebidas..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-6">
              <button
                onClick={() => setActiveCategory('ALL')}
                className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                  activeCategory === 'ALL'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                TODOS ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                      activeCategory === cat.id
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat.name.toUpperCase()} ({count})
                  </button>
                );
              })}
            </div>

            {/* Products Grid */}
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleOpenProductModal(product)}
                  className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex items-center justify-between gap-4 hover:border-orange-300 transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-base font-black text-slate-900">
                        ${product.price.toLocaleString('es-AR')}
                      </span>
                      {product.optionGroups && product.optionGroups.length > 0 && (
                        <span className="text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">
                          Personalizable
                        </span>
                      )}
                    </div>
                  </div>

                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-slate-100"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <Utensils className="w-8 h-8" />
                    </div>
                  )}
                </div>
              ))}

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
                  <Utensils className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-600">No hay productos en esta categoría.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW MODE: CHECKOUT FORM */}
        {checkoutStep === 'DETAILS' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <button
                type="button"
                onClick={() => setCheckoutStep('CART')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Carrito</span>
              </button>
              <h2 className="text-lg font-black text-slate-900">Finalizar Pedido</h2>
            </div>

            <form onSubmit={handleSubmitOrder} className="space-y-6">
              {/* Step 1: Delivery vs Pickup Choice */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">
                  1. Modalidad de Entrega
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryType('FOOD_DELIVERY');
                      if (paymentMethod === 'TRANSFER') setPaymentMethod('CASH');
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      deliveryType === 'FOOD_DELIVERY'
                        ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🛵</span>
                      {deliveryType === 'FOOD_DELIVERY' && <Check className="w-4 h-4 text-orange-600" />}
                    </div>
                    <div className="mt-2">
                      <span className="block text-sm font-bold text-slate-900">Envío a Domicilio</span>
                      <span className="block text-[11px] text-slate-500">Requiere GPS y dirección</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('FOOD_PICKUP')}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      deliveryType === 'FOOD_PICKUP'
                        ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🏪</span>
                      {deliveryType === 'FOOD_PICKUP' && <Check className="w-4 h-4 text-orange-600" />}
                    </div>
                    <div className="mt-2">
                      <span className="block text-sm font-bold text-slate-900">Retiro en Local</span>
                      <span className="block text-[11px] text-slate-500">Sin costo de envío</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2: Customer Contact Info */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">
                  2. Datos del Cliente
                </label>
                <div className="space-y-3">
                  <div>
                    <span className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</span>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-bold text-slate-700 mb-1">Teléfono WhatsApp *</span>
                    <input
                      type="tel"
                      required
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="Ej: +54 9 11 1234-5678"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Address & GPS (Only for DELIVERY) */}
              {deliveryType === 'FOOD_DELIVERY' && (
                <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-orange-900">
                      3. Ubicación de Entrega (GPS Obligatorio)
                    </span>
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                  </div>

                  <div>
                    <span className="block text-xs font-bold text-slate-700 mb-1">Calle y Altura / Referencia</span>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ej: Av. Belgrano 1234, 4to B"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* GPS Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleRequestGps}
                      disabled={gpsLoading}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <Navigation className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                      <span>
                        {gpsLoading
                          ? 'Obteniendo GPS...'
                          : locationCoords
                          ? 'GPS Confirmado ✓ (Actualizar)'
                          : 'Compartir mi Ubicación GPS'}
                      </span>
                    </button>

                    {locationCoords && (
                      <div className="mt-2 text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between">
                        <span>
                          📍 Lat: {locationCoords.latitude.toFixed(4)}, Lng: {locationCoords.longitude.toFixed(4)} (Precisión: {locationCoords.accuracy}m)
                        </span>
                        {calculatingShipping && (
                          <span className="animate-pulse text-xs font-bold text-orange-600">Calculando envío...</span>
                        )}
                      </div>
                    )}

                    {gpsError && (
                      <div className="mt-2 text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{gpsError}</span>
                      </div>
                    )}

                    {calculatedShippingCost !== null && (
                      <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Distancia: {shippingDistanceKm} km</span>
                        <span className="font-black text-orange-600">
                          Envío: ${calculatedShippingCost.toLocaleString('es-AR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Payment Method */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">
                  {deliveryType === 'FOOD_DELIVERY' ? '4. Forma de Pago' : '3. Forma de Pago'}
                </label>

                {deliveryType === 'FOOD_DELIVERY' ? (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="radio" checked readOnly className="text-orange-500" />
                      <span className="text-sm font-bold text-slate-900">Efectivo al Cadete</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-5">
                      Pagas en efectivo directamente al repartidor al recibir el pedido.
                    </p>
                    <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-xl mt-2">
                      ⚠️ Transferencia no habilitada para envíos a domicilio.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all">
                      <input
                        type="radio"
                        name="pay"
                        value="CASH"
                        checked={paymentMethod === 'CASH'}
                        onChange={() => setPaymentMethod('CASH')}
                        className="text-orange-500"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-900">Efectivo al Retirar</span>
                        <span className="block text-xs text-slate-500">Pagas en mostrador al retirar</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all">
                      <input
                        type="radio"
                        name="pay"
                        value="TRANSFER"
                        checked={paymentMethod === 'TRANSFER'}
                        onChange={() => setPaymentMethod('TRANSFER')}
                        className="text-orange-500"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-900">Transferencia Bancaria / Mercado Pago</span>
                        <span className="block text-xs text-slate-500">Se mostrarán los datos CBU / Alias para transferir</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* General Notes */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">Aclaraciones sobre el pedido</span>
                <textarea
                  rows={2}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Ej: Timbre Roto, traer cambio de $10.000, etc."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                ></textarea>
              </div>

              {/* Order Summary Box */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal ({cart.length} ítems):</span>
                  <span>${cartSubtotal.toLocaleString('es-AR')}</span>
                </div>
                {deliveryType === 'FOOD_DELIVERY' && (
                  <div className="flex justify-between text-slate-300">
                    <span>Costo de Envío:</span>
                    <span>
                      {calculatedShippingCost !== null
                        ? `$${calculatedShippingCost.toLocaleString('es-AR')}`
                        : 'Calculando...'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                  <span>TOTAL A PAGAR:</span>
                  <span className="text-orange-400">${cartTotal.toLocaleString('es-AR')}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (deliveryType === 'FOOD_DELIVERY' && !locationCoords)}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-2xl font-black text-base shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Procesando Pedido...</span>
                ) : (
                  <>
                    <span>Confirmar Pedido (${cartTotal.toLocaleString('es-AR')})</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* VIEW MODE: SUCCESS & ORDER STATUS */}
        {checkoutStep === 'SUCCESS' && activeOrderDetails && (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-6">
            <div className="text-center pb-4 border-b border-slate-100">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Check className="w-8 h-8" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                PEDIDO REGISTRADO #{activeOrderDetails.orderNumber}
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">¡Gracias por tu compra!</h2>
              <p className="text-xs text-slate-500 mt-1">Tu pedido está siendo procesado por el local.</p>
            </div>

            {/* PICKUP CODE BOX (IF PICKUP) */}
            {activeOrderDetails.deliveryType === 'FOOD_PICKUP' && activeOrderDetails.pickupCode && (
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white p-5 rounded-2xl text-center shadow-md">
                <span className="text-[11px] font-black uppercase tracking-widest text-orange-100 block mb-1">
                  CÓDIGO DE RETIRO EN LOCAL
                </span>
                <span className="text-4xl font-black tracking-widest bg-white/20 px-4 py-1.5 rounded-xl inline-block border border-white/30 my-1">
                  {activeOrderDetails.pickupCode}
                </span>
                <p className="text-xs text-orange-100 mt-2">
                  Presenta este código en mostrador al retirar en {activeOrderDetails.storeName}.
                </p>
              </div>
            )}

            {/* BANK DETAILS FOR TRANSFER */}
            {activeOrderDetails.deliveryType === 'FOOD_PICKUP' &&
              activeOrderDetails.paymentMethod === 'TRANSFER' &&
              activeOrderDetails.storeBankInfo && (
                <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-orange-400">
                      Datos de Transferencia Bancaria
                    </span>
                    <Building2 className="w-4 h-4 text-orange-400" />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Banco / Plataforma:</span>
                      <span className="font-bold">{activeOrderDetails.storeBankInfo.bankName}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Titular:</span>
                      <span className="font-bold">{activeOrderDetails.storeBankInfo.holderName}</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                      <div>
                        <span className="text-slate-400 text-[10px] block">ALIAS:</span>
                        <span className="font-mono font-bold text-amber-300">
                          {activeOrderDetails.storeBankInfo.alias}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(activeOrderDetails.storeBankInfo.alias, 'alias')}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedAlias ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                      <div>
                        <span className="text-slate-400 text-[10px] block">CBU / CVU:</span>
                        <span className="font-mono text-xs font-bold">{activeOrderDetails.storeBankInfo.cbu}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(activeOrderDetails.storeBankInfo.cbu, 'cbu')}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedCbu ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  {!transferReported && activeOrderDetails.paymentStatus !== 'APPROVED' ? (
                    <button
                      onClick={handleReportTransfer}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 mt-2 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>YA REALICÉ LA TRANSFERENCIA</span>
                    </button>
                  ) : (
                    <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold text-center">
                      ✓ Pago informado. El comercio verificará el ingreso del dinero.
                    </div>
                  )}
                </div>
              )}

            {/* Order Items List */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase text-slate-500 block">Detalle de Productos</span>
              <div className="divide-y divide-slate-100 bg-slate-50 rounded-2xl p-3 border border-slate-200/80">
                {activeOrderDetails.items.map((item: any, i: number) => (
                  <div key={i} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">
                        {item.quantity}x {item.productName}
                      </span>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="text-[11px] text-slate-500">
                          {item.selectedOptions.map((o: any) => o.optionName).join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-slate-900">${item.totalPrice.toLocaleString('es-AR')}</span>
                  </div>
                ))}

                <div className="pt-2 flex justify-between font-black text-sm text-slate-900">
                  <span>Total</span>
                  <span>${activeOrderDetails.totalAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Contact Button */}
            {store.whatsappNumber && (
              <a
                href={`https://wa.me/${store.whatsappNumber}?text=Hola!%20Consulto%20por%20mi%20pedido%20%23${activeOrderDetails.orderNumber}%20(${activeOrderDetails.recipientName})`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Consultar Estado por WhatsApp</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar (When Cart Has Items) */}
      {checkoutStep === 'CART' && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-3 sm:p-4 shadow-2xl">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 font-bold block">
                {cart.reduce((a, b) => a + b.quantity, 0)} ítems en tu carrito
              </span>
              <span className="text-lg font-black text-slate-900">
                ${cartSubtotal.toLocaleString('es-AR')}
              </span>
            </div>

            <button
              onClick={() => setCheckoutStep('DETAILS')}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-sm shadow-md shadow-orange-200 transition-all flex items-center gap-2"
            >
              <span>Ver Carrito / Pagar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Product Customization Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="relative">
              {selectedProduct.imageUrl ? (
                <div className="h-48 w-full overflow-hidden">
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-400">
                  <Utensils className="w-12 h-12" />
                </div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 bg-slate-900/70 hover:bg-slate-900 text-white p-2 rounded-full backdrop-blur-xs transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">{selectedProduct.name}</h2>
                <p className="text-xs text-slate-500 mt-1">{selectedProduct.description}</p>
                <span className="text-lg font-black text-slate-900 block mt-2">
                  ${selectedProduct.price.toLocaleString('es-AR')}
                </span>
              </div>

              {/* Option Groups */}
              {selectedProduct.optionGroups &&
                selectedProduct.optionGroups.map((grp) => {
                  const currentSelected = modalOptionSelections[grp.id] || [];
                  return (
                    <div key={grp.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-800 uppercase">{grp.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {grp.required ? 'Obligatorio' : 'Opcional'} (Máx: {grp.maxSelections || 1})
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {grp.options.map((opt) => {
                          const isSelected = currentSelected.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              onClick={() => handleToggleModalOption(grp.id, opt.id, grp.maxSelections || 1)}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-orange-50 border-orange-500 font-bold text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-orange-500 border-orange-500 text-white'
                                      : 'border-slate-300'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                                <span>{opt.name}</span>
                              </div>
                              {opt.price > 0 && (
                                <span className="font-bold text-slate-500">
                                  +${opt.price.toLocaleString('es-AR')}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              {/* Notes Input */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1">Observaciones para este ítem</span>
                <input
                  type="text"
                  value={modalItemNotes}
                  onChange={(e) => setModalItemNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, extra aderezo, etc."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Modal Bottom Controls */}
            <div className="p-4 border-t border-slate-100 bg-white rounded-b-3xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                  className="p-2 bg-white rounded-xl text-slate-700 hover:bg-slate-200 font-bold"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-black text-sm text-slate-900 px-2">{modalQuantity}</span>
                <button
                  onClick={() => setModalQuantity((q) => q + 1)}
                  className="p-2 bg-white rounded-xl text-slate-700 hover:bg-slate-200 font-bold"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-sm shadow-md shadow-orange-200 transition-all flex items-center justify-between px-4"
              >
                <span>Añadir al Carrito</span>
                <span>${(calculateModalUnitPrice() * modalQuantity).toLocaleString('es-AR')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
