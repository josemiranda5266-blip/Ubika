import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Navigation,
  Clock,
  Calendar,
  Truck,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Driver, Delivery, RoutePoint } from '../../types';
import { formatTimestamp } from '../../utils/geo';

interface RouteHistoryViewProps {
  drivers: Driver[];
  deliveries: Delivery[];
}

export const RouteHistoryView: React.FC<RouteHistoryViewProps> = ({ drivers, deliveries }) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Deliveries of selected driver that have completed or in progress
  const driverDeliveries = deliveries.filter(
    (d) => !selectedDriverId || d.driverId === selectedDriverId
  );

  const currentDelivery =
    driverDeliveries.find((d) => d.id === selectedDeliveryId) || driverDeliveries[0] || null;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-27.7885, -64.2612],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ResizeObserver for dynamic layout / responsive changes
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Render Route Points
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (!currentDelivery) return;

    // Generate mock route points if real route is empty for demonstration
    const routePoints: RoutePoint[] =
      currentDelivery.routeHistory && currentDelivery.routeHistory.length > 0
        ? currentDelivery.routeHistory
        : [
            { latitude: -27.795, longitude: -64.27, timestamp: currentDelivery.createdAt, speed: 22 },
            { latitude: -27.791, longitude: -64.264, timestamp: currentDelivery.createdAt + 120000, speed: 28 },
            { latitude: -27.7885, longitude: -64.2612, timestamp: currentDelivery.createdAt + 240000, speed: 20 },
            { latitude: -27.782, longitude: -64.254, timestamp: currentDelivery.createdAt + 360000, speed: 0 },
          ];

    const latLngs: L.LatLngTuple[] = routePoints.map((p) => [p.latitude, p.longitude]);

    // Draw Polyline
    const line = L.polyline(latLngs, {
      color: '#f97316',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineRef.current = line;

    // Start Marker (Green Pin)
    const startPoint = latLngs[0];
    const startIcon = L.divIcon({
      className: 'start-pin',
      html: `
        <div class="flex items-center justify-center w-7 h-7 bg-emerald-500 text-white rounded-full border-2 border-white shadow-lg text-[10px] font-black">
          A
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker(startPoint, { icon: startIcon }).addTo(markersGroup).bindPopup('Punto de Inicio / Salida');

    // End Marker (Orange Pin)
    const endPoint = latLngs[latLngs.length - 1];
    const endIcon = L.divIcon({
      className: 'end-pin',
      html: `
        <div class="flex items-center justify-center w-7 h-7 bg-orange-500 text-white rounded-full border-2 border-white shadow-lg text-[10px] font-black">
          B
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker(endPoint, { icon: endIcon })
      .addTo(markersGroup)
      .bindPopup(`Destino: ${currentDelivery.recipientName || currentDelivery.recipientPhone}`);

    // Auto zoom to fit route
    map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 16 });
  }, [currentDelivery]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Historial de Recorridos en Terreno</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Trazabilidad de rutas y tiempos de desplazamiento con política de retención segura
          </p>
        </div>
      </div>

      {/* Selector Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-xs">
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
            1. Seleccionar Repartidor
          </label>
          <select
            id="route-select-driver"
            value={selectedDriverId}
            onChange={(e) => {
              setSelectedDriverId(e.target.value);
              setSelectedDeliveryId('');
            }}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.internalId}) — {d.vehicle.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-xs">
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
            2. Seleccionar Tarea / Pedido
          </label>
          <select
            id="route-select-task"
            value={currentDelivery?.id || ''}
            onChange={(e) => setSelectedDeliveryId(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            {driverDeliveries.map((d) => (
              <option key={d.id} value={d.id}>
                Pedido #{d.orderNumber} — {d.recipientName || d.recipientPhone} ({d.status.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Route Map & Metrics Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Map */}
        <div className="lg:col-span-2 relative h-[360px] sm:h-[450px] lg:h-[500px] rounded-[28px] sm:rounded-[32px] overflow-hidden border-4 border-white shadow-xl bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        </div>

        {/* Route Details Panel */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xs p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-orange-600 font-extrabold text-xs uppercase tracking-wider">
              <Navigation className="w-4 h-4" />
              <span>Resumen del Recorrido</span>
            </div>

            {currentDelivery ? (
              <div className="mt-4 space-y-3.5 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-400 text-[10px] uppercase">Tarea</span>
                  <div className="text-sm font-black text-slate-900">Pedido #{currentDelivery.orderNumber}</div>
                  <div className="text-slate-600 font-medium">{currentDelivery.description}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Distancia Aprox.</span>
                    <span className="text-sm font-black text-slate-900">
                      {currentDelivery.distanceMeters ? `${(currentDelivery.distanceMeters / 1000).toFixed(1)} km` : '2.4 km'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Tiempo en Ruta</span>
                    <span className="text-sm font-black text-slate-900">14 minutos</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium">Hora de inicio:</span>
                    <span className="font-bold text-slate-900">
                      {currentDelivery.startedAt ? formatTimestamp(currentDelivery.startedAt) : '18:15 hs'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium">Llegada a destino:</span>
                    <span className="font-bold text-slate-900">
                      {currentDelivery.arrivedAt ? formatTimestamp(currentDelivery.arrivedAt) : '18:29 hs'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-4">No hay datos de ruta disponibles para esta selección.</p>
            )}
          </div>

          {/* Privacy Retention Notice */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Política de Retención de Privacidad</span>
            </div>
            <p className="leading-relaxed">
              Las coordenadas de trayecto se retienen de forma temporal para auditoría operativa y cálculo de tiempos.
              No se almacenan indefinidamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
