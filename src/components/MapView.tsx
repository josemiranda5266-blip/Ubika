import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, Crosshair, MapPin, Layers, ExternalLink } from 'lucide-react';
import { VehicleType } from '../types';
import { getNavigationLinks } from '../utils/geo';

interface MapViewProps {
  driverLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number | null;
  } | null;
  recipientLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    addressHint?: string;
  } | null;
  driverVehicle?: VehicleType;
  recipientName?: string;
  className?: string;
  interactive?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  driverLocation,
  recipientLocation,
  driverVehicle = 'moto',
  recipientName = 'Destinatario',
  className = 'h-72 w-full',
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const recipientMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [showNavDropdown, setShowNavDropdown] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center (Santiago del Estero / Buenos Aires or fallback)
      const defaultLat = driverLocation?.latitude || recipientLocation?.latitude || -27.7885;
      const defaultLng = driverLocation?.longitude || recipientLocation?.longitude || -64.2612;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // Default OpenStreetMap tiles
      const tile = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      tileLayerRef.current = tile;
      mapInstanceRef.current = map;

      // Add clean zoom control top right if interactive
      if (interactive) {
        L.control.zoom({ position: 'topright' }).addTo(map);
      }
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer if mapType changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    if (mapType === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(mapInstanceRef.current);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      ).addTo(mapInstanceRef.current);
    }
  }, [mapType]);

  // Update Markers and Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Recipient Marker (Bouncing Vibrant Orange Pin with live badge)
    if (recipientLocation?.latitude && recipientLocation?.longitude) {
      const recipientLatLng: L.LatLngTuple = [recipientLocation.latitude, recipientLocation.longitude];

      const recipientIcon = L.divIcon({
        className: 'custom-recipient-pin',
        html: `
          <div class="relative flex flex-col items-center justify-center">
            <div class="w-11 h-11 bg-orange-500 text-white rounded-full shadow-2xl border-4 border-white flex items-center justify-center animate-bounce ring-4 ring-orange-200/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
              </svg>
            </div>
            <div class="bg-white px-3 py-1.5 rounded-xl shadow-lg mt-1 border border-orange-100 text-center whitespace-nowrap">
              <span class="text-[11px] font-black text-slate-900 tracking-tight block">CLIENTE: ${recipientName.toUpperCase()}</span>
              <div class="flex items-center justify-center gap-1 mt-0.5">
                <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <span class="text-[9px] font-bold text-green-600 tracking-wider">UBICACIÓN EN VIVO</span>
              </div>
            </div>
          </div>
        `,
        iconSize: [120, 90],
        iconAnchor: [60, 26],
      });

      if (!recipientMarkerRef.current) {
        recipientMarkerRef.current = L.marker(recipientLatLng, { icon: recipientIcon }).addTo(map);
      } else {
        recipientMarkerRef.current.setLatLng(recipientLatLng);
        recipientMarkerRef.current.setIcon(recipientIcon);
      }

      // Accuracy circle with orange/green vibrant tint
      const accuracyRadius = recipientLocation.accuracy || 15;
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(recipientLatLng, {
          radius: accuracyRadius,
          color: '#f97316',
          fillColor: '#f97316',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '5, 5',
        }).addTo(map);
      } else {
        accuracyCircleRef.current.setLatLng(recipientLatLng);
        accuracyCircleRef.current.setRadius(accuracyRadius);
      }
    } else {
      if (recipientMarkerRef.current) {
        map.removeLayer(recipientMarkerRef.current);
        recipientMarkerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
    }

    // 2. Driver Marker (Royal Blue Vibrant Pin with pulse)
    if (driverLocation?.latitude && driverLocation?.longitude) {
      const driverLatLng: L.LatLngTuple = [driverLocation.latitude, driverLocation.longitude];

      const driverIcon = L.divIcon({
        className: 'custom-driver-pin',
        html: `
          <div class="relative flex flex-col items-center justify-center">
            <div class="bg-blue-600 w-9 h-9 rounded-full border-4 border-white shadow-xl flex items-center justify-center ring-4 ring-blue-200/60">
              <div class="w-2.5 h-2.5 bg-white rounded-full animate-ping"></div>
            </div>
            <div class="bg-white px-2.5 py-1 rounded-lg shadow-md mt-1 border border-slate-100 whitespace-nowrap">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-700">Tú (En camino)</span>
            </div>
          </div>
        `,
        iconSize: [100, 70],
        iconAnchor: [50, 20],
      });

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker(driverLatLng, { icon: driverIcon }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng(driverLatLng);
        driverMarkerRef.current.setIcon(driverIcon);
      }
    } else {
      if (driverMarkerRef.current) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
    }

    // 3. Polyline between Driver and Recipient
    if (
      driverLocation?.latitude &&
      driverLocation?.longitude &&
      recipientLocation?.latitude &&
      recipientLocation?.longitude
    ) {
      const latLngs: L.LatLngTuple[] = [
        [driverLocation.latitude, driverLocation.longitude],
        [recipientLocation.latitude, recipientLocation.longitude],
      ];

      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(latLngs, {
          color: '#f97316',
          weight: 4,
          opacity: 0.9,
          dashArray: '8, 8',
          lineCap: 'round',
        }).addTo(map);
      } else {
        routeLineRef.current.setLatLngs(latLngs);
      }

      // Auto fit bounds
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (recipientLocation?.latitude && recipientLocation?.longitude) {
      map.setView([recipientLocation.latitude, recipientLocation.longitude], 16);
    } else if (driverLocation?.latitude && driverLocation?.longitude) {
      map.setView([driverLocation.latitude, driverLocation.longitude], 16);
    }
  }, [driverLocation, recipientLocation, driverVehicle, recipientName]);

  // Center on Client
  const centerOnRecipient = () => {
    if (mapInstanceRef.current && recipientLocation?.latitude && recipientLocation?.longitude) {
      mapInstanceRef.current.flyTo([recipientLocation.latitude, recipientLocation.longitude], 17, { duration: 1 });
    }
  };

  // Center on Driver
  const centerOnDriver = () => {
    if (mapInstanceRef.current && driverLocation?.latitude && driverLocation?.longitude) {
      mapInstanceRef.current.flyTo([driverLocation.latitude, driverLocation.longitude], 17, { duration: 1 });
    }
  };

  // Fit All Bounds
  const fitAll = () => {
    if (!mapInstanceRef.current) return;
    const points: L.LatLngTuple[] = [];
    if (driverLocation?.latitude && driverLocation?.longitude) {
      points.push([driverLocation.latitude, driverLocation.longitude]);
    }
    if (recipientLocation?.latitude && recipientLocation?.longitude) {
      points.push([recipientLocation.latitude, recipientLocation.longitude]);
    }
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  };

  const navLinks = recipientLocation?.latitude && recipientLocation?.longitude
    ? getNavigationLinks(recipientLocation.latitude, recipientLocation.longitude, `Entrega: ${recipientName}`)
    : null;

  return (
    <div className={`relative rounded-[32px] overflow-hidden shadow-xl border-4 border-white bg-slate-100 ${className}`}>
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Control Toolbar */}
      {interactive && (
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-xl">
          <button
            id="map-btn-fit-all"
            type="button"
            onClick={fitAll}
            title="Ver todo"
            className="px-3 py-1.5 text-xs text-slate-700 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 rounded-xl flex items-center gap-1.5 transition-all font-bold"
          >
            <Crosshair className="w-3.5 h-3.5 text-orange-500" />
            <span className="hidden sm:inline font-bold">Ruta</span>
          </button>

          {recipientLocation && (
            <button
              id="map-btn-center-client"
              type="button"
              onClick={centerOnRecipient}
              title="Centrar en cliente"
              className="px-3 py-1.5 text-xs text-slate-700 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 rounded-xl flex items-center gap-1.5 transition-all font-bold"
            >
              <MapPin className="w-3.5 h-3.5 text-orange-500" />
              <span className="hidden sm:inline font-bold">Cliente</span>
            </button>
          )}

          {driverLocation && (
            <button
              id="map-btn-center-driver"
              type="button"
              onClick={centerOnDriver}
              title="Mi posición"
              className="px-3 py-1.5 text-xs text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl flex items-center gap-1.5 transition-all font-bold"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline font-bold">Mi GPS</span>
            </button>
          )}

          <button
            id="map-btn-toggle-layer"
            type="button"
            onClick={() => setMapType((prev) => (prev === 'streets' ? 'satellite' : 'streets'))}
            title="Alternar satélite"
            className="px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 transition-all font-bold"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline font-bold">{mapType === 'streets' ? 'Satélite' : 'Mapa'}</span>
          </button>
        </div>
      )}

      {/* External GPS App Launchers (Google Maps / Waze) */}
      {navLinks && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="relative">
            <button
              id="map-btn-external-nav"
              type="button"
              onClick={() => setShowNavDropdown(!showNavDropdown)}
              className="flex items-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-xl shadow-green-200 font-extrabold text-xs transition-all active:scale-95 border-2 border-white"
            >
              <Navigation className="w-4 h-4 fill-white" />
              <span>Navegar GPS</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-90" />
            </button>

            {showNavDropdown && (
              <div className="absolute bottom-full right-0 mb-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-20 space-y-1">
                <a
                  href={navLinks.googleMaps}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-800 hover:bg-slate-50 rounded-xl transition-colors font-bold"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Google Maps
                </a>
                <a
                  href={navLinks.waze}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-800 hover:bg-slate-50 rounded-xl transition-colors font-bold"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                  Waze Navegador
                </a>
                <a
                  href={navLinks.appleMaps}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-800 hover:bg-slate-50 rounded-xl transition-colors font-bold"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                  Apple Maps
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
