import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Crosshair,
  Layers,
  MapPin,
  Truck,
  Bike,
  Car,
  Clock,
  Navigation,
  Phone,
  User,
  Package,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Driver, Delivery, VehicleType } from '../../types';

interface FleetMapViewProps {
  drivers: Driver[];
  deliveries: Delivery[];
  selectedDriverId?: string | null;
  onSelectDriver?: (driverId: string | null) => void;
}

export const FleetMapView: React.FC<FleetMapViewProps> = ({
  drivers,
  deliveries,
  selectedDriverId,
  onSelectDriver,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const clientMarkersRef = useRef<{ [key: string]: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [tileLayer, setTileLayer] = useState<L.TileLayer | null>(null);

  const activeDriver = drivers.find((d) => d.id === selectedDriverId) || null;
  const activeDelivery = activeDriver?.activeDeliveryId
    ? deliveries.find((d) => d.id === activeDriver.activeDeliveryId)
    : null;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultLat = -27.7885;
      const defaultLng = -64.2612;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      const tile = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      setTileLayer(tile);
      mapInstanceRef.current = map;
    }

    // ResizeObserver to automatically invalidateSize on container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Tile Switching
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayer) return;
    mapInstanceRef.current.removeLayer(tileLayer);

    const newTile =
      mapType === 'satellite'
        ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
          })
        : L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd',
          });

    newTile.addTo(mapInstanceRef.current);
    setTileLayer(newTile);
  }, [mapType]);

  // Update Driver & Client Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers that no longer exist
    Object.keys(markersRef.current).forEach((id) => {
      if (!drivers.find((d) => d.id === id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    Object.keys(clientMarkersRef.current).forEach((id) => {
      map.removeLayer(clientMarkersRef.current[id]);
      delete clientMarkersRef.current[id];
    });

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const boundsPoints: L.LatLngTuple[] = [];

    // Render Drivers
    drivers.forEach((driver) => {
      if (!driver.currentLocation) return;
      const { latitude, longitude } = driver.currentLocation;
      const latLng: L.LatLngTuple = [latitude, longitude];
      boundsPoints.push(latLng);

      const isSelected = selectedDriverId === driver.id;

      // Color coding:
      // 🟢 Disponible
      // 🔵 En tarea / En camino
      // 🟠 Cerca del destino
      // 🔴 Demorado / Urgente
      let colorBg = 'bg-emerald-500 ring-emerald-200';
      let statusText = 'Disponible';

      const driverDelivery = driver.activeDeliveryId
        ? deliveries.find((d) => d.id === driver.activeDeliveryId)
        : null;

      if (driver.status === 'en_tarea') {
        if (driverDelivery?.priority === 'urgente') {
          colorBg = 'bg-red-600 ring-red-200 animate-pulse';
          statusText = '🔴 Demorado';
        } else if (driverDelivery?.status === 'cerca') {
          colorBg = 'bg-orange-500 ring-orange-200';
          statusText = '🟠 Cerca destino';
        } else {
          colorBg = 'bg-blue-600 ring-blue-200';
          statusText = '🔵 En camino';
        }
      } else if (driver.status === 'pausado') {
        colorBg = 'bg-amber-500 ring-amber-200';
        statusText = 'Pausado';
      }

      const customIcon = L.divIcon({
        className: 'driver-fleet-pin',
        html: `
          <div class="relative flex flex-col items-center justify-center cursor-pointer group">
            <div class="w-10 h-10 ${colorBg} text-white rounded-full shadow-2xl border-2 border-white flex items-center justify-center ring-4 transition-transform group-hover:scale-110 ${
          isSelected ? 'scale-125 ring-8 ring-orange-400' : ''
        }">
              <span class="text-[11px] font-black">${driver.internalId}</span>
            </div>
            <div class="bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-xl shadow-lg mt-1 border border-slate-200 text-center whitespace-nowrap">
              <span class="text-[10px] font-black text-slate-900 block">${driver.name.split(' ')[0]}</span>
              <span class="text-[9px] font-bold text-slate-500">${statusText}</span>
            </div>
          </div>
        `,
        iconSize: [80, 65],
        iconAnchor: [40, 20],
      });

      if (!markersRef.current[driver.id]) {
        const marker = L.marker(latLng, { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          onSelectDriver?.(driver.id);
        });
        markersRef.current[driver.id] = marker;
      } else {
        markersRef.current[driver.id].setLatLng(latLng);
        markersRef.current[driver.id].setIcon(customIcon);
      }

      // If this driver is selected and has an active delivery with client location, show client pin and polyline
      if (isSelected && driverDelivery?.recipientLocation) {
        const clientLatLng: L.LatLngTuple = [
          driverDelivery.recipientLocation.latitude,
          driverDelivery.recipientLocation.longitude,
        ];
        boundsPoints.push(clientLatLng);

        const clientIcon = L.divIcon({
          className: 'fleet-client-pin',
          html: `
            <div class="relative flex flex-col items-center justify-center animate-bounce">
              <div class="w-10 h-10 bg-orange-500 text-white rounded-full shadow-2xl border-4 border-white flex items-center justify-center ring-4 ring-orange-200">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                </svg>
              </div>
              <div class="bg-white px-2.5 py-1 rounded-xl shadow-lg mt-1 border border-orange-100 whitespace-nowrap text-center">
                <span class="text-[10px] font-black text-orange-600 block">CLIENTE: ${driverDelivery.recipientName?.toUpperCase() || 'DESTINATARIO'}</span>
              </div>
            </div>
          `,
          iconSize: [100, 70],
          iconAnchor: [50, 25],
        });

        const clientMarker = L.marker(clientLatLng, { icon: clientIcon }).addTo(map);
        clientMarkersRef.current[driverDelivery.id] = clientMarker;

        // Draw connecting route
        const line = L.polyline([latLng, clientLatLng], {
          color: '#f97316',
          weight: 4,
          dashArray: '6, 6',
        }).addTo(map);
        polylineRef.current = line;
      }
    });

    // Auto zoom if first load
    if (boundsPoints.length > 0 && !selectedDriverId) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [drivers, deliveries, selectedDriverId]);

  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const points: L.LatLngTuple[] = [];
    drivers.forEach((d) => {
      if (d.currentLocation) points.push([d.currentLocation.latitude, d.currentLocation.longitude]);
    });
    if (points.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
    }
  };

  return (
    <div className="relative w-full h-[400px] sm:h-[520px] lg:h-[650px] rounded-[28px] sm:rounded-[32px] overflow-hidden border-4 border-white shadow-xl bg-slate-100 animate-fadeIn">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 bg-white/95 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl border border-slate-100 shadow-xl max-w-[calc(100%-24px)]">
        <button
          id="fleet-map-fit-all"
          type="button"
          onClick={handleFitAll}
          className="px-3 py-1.5 bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-600 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all min-h-[36px]"
        >
          <Crosshair className="w-3.5 h-3.5 text-orange-500" />
          <span>Ver Flota ({drivers.length})</span>
        </button>

        <button
          id="fleet-map-toggle-layer"
          type="button"
          onClick={() => setMapType((p) => (p === 'streets' ? 'satellite' : 'streets'))}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all min-h-[36px]"
        >
          <Layers className="w-3.5 h-3.5 text-slate-600" />
          <span>{mapType === 'streets' ? 'Satélite' : 'Mapa'}</span>
        </button>
      </div>

      {/* Status Legend (Visible on medium+ screens) */}
      <div className="absolute top-3 right-3 z-10 hidden md:flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-100 shadow-xl text-[10px] sm:text-[11px] font-bold text-slate-700">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Disp.
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span> En camino
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span> Cerca
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-600"></span> Alerta
        </span>
      </div>

      {/* Selected Driver Inspection Drawer (Responsive bottom panel) */}
      {activeDriver && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-96 z-20 bg-white border border-slate-100 rounded-[24px] sm:rounded-[28px] shadow-2xl p-4 sm:p-5 text-slate-900 animate-slideUp max-h-[75%] overflow-y-auto">
          <div className="flex items-start justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center font-black text-orange-600 shrink-0">
                {activeDriver.internalId}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 truncate">{activeDriver.name}</h4>
                <p className="text-[11px] text-slate-500 font-bold capitalize">
                  {activeDriver.vehicle} • {activeDriver.phone}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectDriver?.(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Estado actual:</span>
              <span className="font-black text-slate-900 capitalize">{activeDriver.status.replace('_', ' ')}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Velocidad estimada:</span>
              <span className="font-bold text-slate-800">{activeDriver.speedKmH || 0} km/h</span>
            </div>

            {activeDelivery ? (
              <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-orange-500" /> Tarea #{activeDelivery.orderNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                    {activeDelivery.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium line-clamp-2">{activeDelivery.description}</p>
                <div className="text-[10px] text-slate-500 font-bold pt-1 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="truncate mr-2">Destino: {activeDelivery.recipientName || activeDelivery.recipientPhone}</span>
                  {activeDelivery.recipientLocation ? (
                    <span className="text-emerald-600 font-black flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> GPS Compartido
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold shrink-0">Esperando GPS</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-2.5 p-2 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold text-center">
                🟢 Repartidor disponible para nuevas asignaciones
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
