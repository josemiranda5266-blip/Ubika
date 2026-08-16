import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  XCircle,
  Truck,
  Phone,
  Send,
  Lock,
  RefreshCw,
  Navigation2,
  Info,
} from 'lucide-react';
import { PublicSessionData } from '../types';
import { formatDistance, formatEta, watchBrowserPosition } from '../utils/geo';
import { MapView } from './MapView';

interface CustomerWebAppProps {
  token: string;
  onBackToDriver?: () => void;
}

export const CustomerWebApp: React.FC<CustomerWebAppProps> = ({ token, onBackToDriver }) => {
  const [session, setSession] = useState<PublicSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // GPS Sharing States
  const [isSharingGps, setIsSharingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Additional note from customer
  const [customerNote, setCustomerNote] = useState('');
  const [noteSent, setNoteSent] = useState(false);

  // Polling / refresh session
  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/session/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('El enlace de entrega no es válido o ya ha sido removido.');
        } else {
          setError('Error al consultar el estado de la entrega.');
        }
        setLoading(false);
        return;
      }
      const data: PublicSessionData = await res.json();
      setSession(data);
      if (data.isAuthorized && data.status !== 'rechazado' && data.status !== 'entregado' && data.status !== 'cancelado') {
        setIsSharingGps(true);
      }
      setLoading(false);
    } catch {
      setError('Error de conexión. Verifica tu internet.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // Poll every 4 seconds for live driver updates
    const interval = setInterval(fetchSession, 4000);
    return () => clearInterval(interval);
  }, [token]);

  // GPS Watcher effect when authorized
  useEffect(() => {
    if (!isSharingGps || !session || session.status === 'entregado' || session.status === 'cancelado' || session.status === 'expirado') {
      return;
    }

    const cleanup = watchBrowserPosition(
      async (pos) => {
        setMyCoords({ latitude: pos.latitude, longitude: pos.longitude });
        setGpsAccuracy(pos.accuracy);
        setLastGpsUpdate(Date.now());
        setGpsError(null);

        // Send to backend
        try {
          await fetch(`/api/session/${token}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.latitude,
              longitude: pos.longitude,
              accuracy: pos.accuracy,
              altitude: pos.altitude,
              heading: pos.heading,
              speed: pos.speed,
              noteFromRecipient: customerNote,
            }),
          });
        } catch (err) {
          console.error('Error posting location', err);
        }
      },
      (err) => {
        let msg = 'No pudimos acceder a tu GPS. Por favor activa los permisos de ubicación en tu navegador.';
        if (err.code === 1) {
          msg = 'Permiso de ubicación denegado. Para que el repartidor llegue, activa la ubicación en los ajustes del navegador.';
        }
        setGpsError(msg);
      }
    );

    return () => cleanup();
  }, [isSharingGps, session?.status, token, customerNote]);

  // Handle Authorization
  const handleAuthorize = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/session/${token}/authorize`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        setIsSharingGps(true);
      } else {
        setGpsError(data.error || 'No se pudo autorizar');
      }
    } catch {
      setGpsError('Error de red al autorizar');
    } finally {
      setLoading(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!window.confirm('¿Seguro que no deseas compartir tu ubicación? El repartidor tendrá que buscar la dirección manualmente.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/session/${token}/reject`, { method: 'POST' });
      const data = await res.json();
      setSession(data.session);
      setIsSharingGps(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Handle Stop Sharing
  const handleStopSharing = async () => {
    try {
      await fetch(`/api/session/${token}/revoke`, { method: 'POST' });
      setIsSharingGps(false);
      fetchSession();
    } catch {
      // ignore
    }
  };

  // Send Note
  const handleSendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerNote.trim()) return;
    try {
      if (myCoords) {
        await fetch(`/api/session/${token}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: myCoords.latitude,
            longitude: myCoords.longitude,
            accuracy: gpsAccuracy || 10,
            noteFromRecipient: customerNote.trim(),
          }),
        });
      }
      setNoteSent(true);
      setTimeout(() => setNoteSent(false), 3000);
    } catch {
      // ignore
    }
  };

  // Fallback simulator for testing
  const handleSimulateGps = () => {
    const defaultSantiagoLat = -27.7889 + (Math.random() - 0.5) * 0.003;
    const defaultSantiagoLng = -64.2619 + (Math.random() - 0.5) * 0.003;
    setMyCoords({ latitude: defaultSantiagoLat, longitude: defaultSantiagoLng });
    setGpsAccuracy(6);
    setLastGpsUpdate(Date.now());
    setGpsError(null);
    setIsSharingGps(true);

    fetch(`/api/session/${token}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: defaultSantiagoLat,
        longitude: defaultSantiagoLng,
        accuracy: 6,
        noteFromRecipient: customerNote,
      }),
    });
  };

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-extrabold text-slate-900">Cargando datos de la entrega...</p>
        <p className="text-xs text-slate-400 mt-1 font-medium">Conectando con UBIKA de forma segura</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="p-5 bg-red-50 border border-red-200 rounded-3xl text-red-500 mb-4 shadow-sm">
          <AlertTriangle className="w-10 h-10 mx-auto" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Enlace no disponible</h2>
        <p className="text-xs font-semibold text-slate-500 mb-6">{error || 'No se encontró la entrega solicitada.'}</p>
        {onBackToDriver && (
          <button
            type="button"
            onClick={onBackToDriver}
            className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-2xl shadow-md shadow-orange-200 transition-all"
          >
            Volver a la App del Repartidor
          </button>
        )}
      </div>
    );
  }

  // --- STATE: COMPLETED / ENTREGADO ---
  if (session.status === 'entregado') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between p-6 max-w-md mx-auto">
        <div className="pt-12 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500 text-white border-4 border-white shadow-2xl flex items-center justify-center animate-bounce">
            <CheckCircle2 className="w-10 h-10 stroke-[3]" />
          </div>
          <div>
            <span className="px-4 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-black uppercase rounded-full">
              Entrega Finalizada
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-3">¡Tu pedido ha sido entregado!</h1>
            <p className="text-xs font-bold text-slate-500 mt-1">📦 {session.description}</p>
          </div>

          <div className="p-6 rounded-[32px] bg-white border border-slate-100 text-left space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-2.5 text-green-600 text-xs font-black">
              <ShieldCheck className="w-5 h-5" />
              <span>Privacidad Garantizada</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              La sesión de ubicación ha finalizado. Tus coordenadas GPS han sido <strong>eliminadas de forma permanente</strong> de nuestros servidores según nuestra política de retención de datos.
            </p>
          </div>
        </div>

        <div className="pb-6 space-y-3">
          <div className="text-center text-[11px] font-bold text-slate-400">
            UBIKA — Plataforma de Ubicación y Entrega Segura
          </div>
          {onBackToDriver && (
            <button
              type="button"
              onClick={onBackToDriver}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl transition-all shadow-md"
            >
              Volver a vista de repartidor
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- STATE: EXPIRED ---
  if (session.isExpired || session.status === 'expirado') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl text-amber-600 mb-4 shadow-sm">
          <Clock className="w-10 h-10 mx-auto" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Enlace de Entrega Expirado</h2>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">
          Por motivos de seguridad y privacidad, los enlaces de ubicación tienen una vigencia máxima de 60 minutos. Si todavía estás esperando tu pedido, el repartidor se comunicará directamente contigo.
        </p>
        {onBackToDriver && (
          <button
            type="button"
            onClick={onBackToDriver}
            className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-2xl shadow-md shadow-orange-200"
          >
            Volver a la App del Repartidor
          </button>
        )}
      </div>
    );
  }

  // --- STATE: REJECTED ---
  if (session.status === 'rechazado') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="p-5 bg-slate-100 border border-slate-200 rounded-3xl text-slate-500 mb-4 shadow-sm">
          <XCircle className="w-10 h-10 mx-auto text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Ubicación no compartida</h2>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-medium">
          Has decidido no compartir tu ubicación. El repartidor utilizará los datos estándar de entrega para intentar llegar a tu domicilio.
        </p>
        <button
          type="button"
          onClick={handleAuthorize}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-2xl transition-all mb-3 shadow-lg shadow-orange-200"
        >
          Cambiar de opinión y compartir GPS
        </button>
        {onBackToDriver && (
          <button
            type="button"
            onClick={onBackToDriver}
            className="px-5 py-2 text-slate-500 text-xs font-bold hover:underline"
          >
            Volver a la App del Repartidor
          </button>
        )}
      </div>
    );
  }

  // --- STATE: ACTIVE TRACKING & SHARING (AFTER CONSENT) ---
  if (isSharingGps || session.isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between max-w-md mx-auto pb-6">
        {/* Top Trust Header */}
        <header className="p-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-200">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-900 tracking-wide">UBIKA LIVE</span>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              </div>
              <p className="text-[10px] text-green-600 font-bold">Compartiendo ubicación segura</p>
            </div>
          </div>

          <button
            id="customer-btn-stop-sharing"
            type="button"
            onClick={handleStopSharing}
            className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-colors"
          >
            Dejar de compartir
          </button>
        </header>

        {/* Main Content */}
        <main className="p-4 space-y-4 flex-1">
          {/* Driver Status Card */}
          <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{session.driverName}</h3>
                  <p className="text-xs text-slate-400 capitalize font-medium">
                    Repartidor en {session.driverVehicle}
                  </p>
                </div>
              </div>

              {session.driverPhone && (
                <a
                  href={`tel:${session.driverPhone}`}
                  className="p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 transition-colors"
                  title="Llamar al repartidor"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Delivery Progress Pill */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-tight">Distancia</span>
                <span className="text-base font-black text-slate-900">
                  {formatDistance(session.distanceMeters)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-tight">Estado</span>
                <span className="text-xs font-black text-green-600 capitalize">
                  {session.status === 'cerca' ? '🟣 ¡Muy cerca!' : session.status === 'en_camino' ? '🔵 En camino' : '🟢 Conectado'}
                </span>
              </div>
            </div>
          </div>

          {/* GPS Accuracy Status */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-green-50 border border-green-200 text-xs">
            <div className="flex items-center gap-2 text-green-700 font-bold">
              <Navigation2 className="w-4 h-4 animate-pulse text-green-600" />
              <span>
                GPS Activo: ±{gpsAccuracy || 8} m
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">
              {lastGpsUpdate ? `Actualizado ${new Date(lastGpsUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Transmitiendo...'}
            </span>
          </div>

          {/* GPS Error or Browser Permission helper */}
          {gpsError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2 font-medium">
              <p>{gpsError}</p>
              <button
                type="button"
                onClick={handleSimulateGps}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                Usar coordenadas de prueba (Simulador)
              </button>
            </div>
          )}

          {/* Interactive Map */}
          <div className="rounded-[32px] overflow-hidden shadow-xl border-4 border-white">
            <MapView
              driverLocation={session.driverLocation}
              recipientLocation={myCoords ? { latitude: myCoords.latitude, longitude: myCoords.longitude, accuracy: gpsAccuracy || 10 } : null}
              driverVehicle={session.driverVehicle}
              recipientName="Tu Ubicación"
              className="h-64 w-full"
            />
          </div>

          {/* Note for Driver Form */}
          <form onSubmit={handleSendNote} className="p-5 rounded-[32px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-2.5">
            <label className="text-xs font-extrabold text-slate-800 block">
              Indicación para el repartidor (opcional):
            </label>
            <div className="flex gap-2">
              <input
                id="customer-input-note"
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Ej. Tocar timbre 3B / Portón verde"
                className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none"
              />
              <button
                id="customer-btn-send-note"
                type="submit"
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-black flex items-center gap-1 shadow-md shadow-orange-200 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </div>
            {noteSent && (
              <p className="text-[11px] text-green-600 font-bold">¡Indicación enviada al repartidor!</p>
            )}
          </form>

          {/* Order Brief */}
          <div className="p-4 rounded-2xl bg-white border border-slate-100 text-xs space-y-1.5 shadow-sm">
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Pedido:</span>
              <span className="font-bold text-slate-800 text-right">{session.description}</span>
            </div>
            {session.amount && (
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Total a pagar:</span>
                <span className="font-black text-orange-600">{session.amount}</span>
              </div>
            )}
          </div>
        </main>

        {/* Footer info */}
        <footer className="px-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400">
            <Lock className="w-3.5 h-3.5 text-green-500" />
            <span>Compartición temporal activa — Se borra al entregar</span>
          </div>
          {onBackToDriver && (
            <button
              type="button"
              onClick={onBackToDriver}
              className="text-[11px] font-extrabold text-orange-500 hover:underline"
            >
              ← Volver al panel de repartidor
            </button>
          )}
        </footer>
      </div>
    );
  }

  // --- STAGE 1: INITIAL CONSENT SCREEN (TE ESTÁN BUSCANDO PARA REALIZAR UNA ENTREGA) ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between max-w-md mx-auto p-6 animate-fadeIn">
      {/* Brand Header */}
      <header className="flex items-center justify-between pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white font-black shadow-md shadow-orange-200">
            <MapPin className="w-6 h-6 fill-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">UBIKA</h1>
            <p className="text-[10px] text-orange-500 font-extrabold uppercase tracking-wider">Ubicación Segura para Entregas</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
          <Lock className="w-3.5 h-3.5 text-green-500" />
          <span>Enlace Seguro</span>
        </div>
      </header>

      {/* Main Attention Card */}
      <main className="my-auto py-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-orange-50 border border-orange-200 rounded-3xl text-orange-500 mb-1 shadow-sm">
            <Truck className="w-10 h-10 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight">
            Te están buscando para realizar una entrega
          </h2>
          <p className="text-xs font-semibold text-slate-500 max-w-xs mx-auto">
            El repartidor solicita conocer tu ubicación exacta para llegar a tu domicilio sin demoras.
          </p>
        </div>

        {/* Order Details Card */}
        <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Repartidor a cargo
              </span>
              <span className="text-base font-black text-slate-900">{session.driverName}</span>
            </div>
            <span className="px-3 py-1 rounded-xl bg-orange-50 text-orange-700 text-xs font-black border border-orange-200 capitalize">
              {session.driverVehicle}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <span className="text-slate-400 font-bold">Detalle del pedido:</span>
              <span className="font-bold text-slate-800 text-right max-w-[65%]">
                {session.description}
              </span>
            </div>

            {session.amount && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-slate-400 font-bold">Monto a abonar al recibir:</span>
                <span className="font-black text-orange-600 text-base">{session.amount}</span>
              </div>
            )}

            {session.instructions && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 mt-2 font-medium">
                <span className="text-slate-400 font-bold block mb-0.5">Instrucciones del pedido:</span>
                {session.instructions}
              </div>
            )}
          </div>
        </div>

        {/* Privacy Notice Box (Mandatory & Clear) */}
        <div className="p-5 rounded-[32px] bg-orange-50/60 border border-orange-200 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-orange-600 font-black">
            <ShieldCheck className="w-4 h-4" />
            <span>Compromiso de Privacidad UBIKA</span>
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
            Al presionar «Compartir mi ubicación», tu navegador solicitará permiso GPS. La ubicación <strong>solamente se compartirá de forma temporal</strong> durante esta entrega y <strong>se eliminará automáticamente</strong> al finalizar.
          </p>
          <ul className="text-[10px] text-slate-500 space-y-1 list-disc list-inside font-semibold">
            <li>No necesitas instalar ninguna aplicación.</li>
            <li>Podés detener la compartición en cualquier momento.</li>
            <li>No guardamos historial de tus movimientos.</li>
          </ul>
        </div>
      </main>

      {/* Action Buttons */}
      <footer className="space-y-3 pt-2">
        <button
          id="customer-btn-share-location"
          type="submit"
          onClick={handleAuthorize}
          className="w-full py-4.5 px-6 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 text-sm uppercase tracking-wide"
        >
          <MapPin className="w-5 h-5 fill-white" />
          <span>Compartir mi Ubicación</span>
        </button>

        <button
          id="customer-btn-reject-location"
          type="button"
          onClick={handleReject}
          className="w-full py-3.5 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-2xl transition-colors border border-slate-200"
        >
          No deseo compartir / Rechazar
        </button>

        {onBackToDriver && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onBackToDriver}
              className="text-xs font-black text-orange-500 hover:underline"
            >
              ← Volver al panel de repartidor
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
