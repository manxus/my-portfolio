import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './TravelMap.module.css';

export const HOME_PIN_ID = 'home';

function isValidCoord(n) {
  return typeof n === 'number' && !Number.isNaN(n);
}

function isValidHome(home) {
  return home && isValidCoord(home.lat) && isValidCoord(home.lng);
}

function createTripMarkerIcon(selected) {
  const bg = selected ? '#82bfbf' : '#5f8f8f';
  const scale = selected ? 'transform:scale(1.35);' : '';
  return L.divIcon({
    className: styles.markerIconRoot,
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${bg};border:2px solid #82bfbf;box-shadow:0 0 10px rgba(95,143,143,0.55);${scale}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function createHomeMarkerIcon(selected) {
  const border = selected ? '#82bfbf' : '#5f8f8f';
  const scale = selected ? 'transform:scale(1.15);' : '';
  return L.divIcon({
    className: styles.markerIconRoot,
    html: `<div style="width:18px;height:18px;border-radius:3px;background:#d0dce3;border:2px solid ${border};box-shadow:0 0 12px rgba(208,220,227,0.45);display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;color:#0a0f12;${scale}">⌂</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const LATITUDE_MAX_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
const FIT_PADDING = [48, 48];
const SINGLE_PIN_ZOOM = 6;
const MAX_ZOOM = 12;
const TILE_SIZE = 256;

function collectPinPoints(trips, home, hasHome) {
  const points = trips.map((t) => [t.lat, t.lng]);
  if (hasHome) points.push([home.lat, home.lng]);
  return points;
}

/** Minimum zoom so tiles cover the full container (no dark letterboxing). */
function getFillZoom(map) {
  map.invalidateSize();
  const size = map.getSize();
  if (size.x <= 0 || size.y <= 0) return 2;

  for (let z = 0; z <= MAX_ZOOM; z += 1) {
    const worldPx = TILE_SIZE * 2 ** z;
    if (worldPx >= size.x && worldPx >= size.y) {
      return z;
    }
  }

  return MAX_ZOOM;
}

function applyViewportLimits(map, trips, home, hasHome) {
  map.invalidateSize();
  const size = map.getSize();
  if (size.x <= 0 || size.y <= 0) return null;

  const points = collectPinPoints(trips, home, hasHome);
  if (points.length === 0) return null;

  const fillZoom = getFillZoom(map);

  map.setMaxBounds(LATITUDE_MAX_BOUNDS);
  map.setMaxZoom(MAX_ZOOM);
  map.setMinZoom(fillZoom);

  if (points.length === 1) {
    map.setView(points[0], Math.max(SINGLE_PIN_ZOOM, fillZoom), { animate: false });
    return fillZoom;
  }

  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: FIT_PADDING, animate: false, maxZoom: MAX_ZOOM });

  if (map.getZoom() < fillZoom) {
    map.setZoom(fillZoom);
  }

  return fillZoom;
}

function flyToSelection(map, selectedId, trips, home, hasHome, minZoom) {
  const floor = Number.isFinite(minZoom) ? minZoom : 0;

  if (selectedId === HOME_PIN_ID && hasHome) {
    map.flyTo([home.lat, home.lng], Math.max(map.getZoom(), floor, SINGLE_PIN_ZOOM), {
      duration: 0.75,
    });
    return;
  }

  if (selectedId == null) return;

  const trip = trips.find((t) => t.id === selectedId);
  if (!trip) return;

  map.flyTo([trip.lat, trip.lng], Math.max(map.getZoom(), floor, 5), { duration: 0.75 });
}

function MapController({ trips, home, selectedId }) {
  const map = useMap();
  const hasHome = isValidHome(home);
  const minZoomRef = useRef(2);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    map.setMinZoom(minZoomRef.current);
  }, [map]);

  const syncViewport = useCallback(() => {
    const minZoom = applyViewportLimits(map, trips, home, hasHome);
    if (minZoom == null) return false;

    minZoomRef.current = minZoom;
    return true;
  }, [map, trips, home, hasHome]);

  const runSyncAndFly = useCallback(() => {
    if (!syncViewport()) return false;
    flyToSelection(
      map,
      selectedIdRef.current,
      trips,
      home,
      hasHome,
      minZoomRef.current,
    );
    return true;
  }, [map, syncViewport, trips, home, hasHome]);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    const attemptSync = () => {
      if (cancelled) return;
      if (runSyncAndFly()) return;
      rafId = requestAnimationFrame(attemptSync);
    };

    const startSync = () => {
      rafId = requestAnimationFrame(attemptSync);
    };

    map.whenReady(startSync);

    const onResize = () => {
      runSyncAndFly();
    };
    map.on('resize', onResize);

    const t1 = setTimeout(() => {
      if (!cancelled) runSyncAndFly();
    }, 150);
    const t2 = setTimeout(() => {
      if (!cancelled) runSyncAndFly();
    }, 400);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      map.off('resize', onResize);
    };
  }, [map, runSyncAndFly]);

  useEffect(() => {
    const clampZoom = () => {
      const floor = minZoomRef.current;
      if (map.getZoom() < floor) {
        map.setZoom(floor);
      }
    };

    map.on('zoomend', clampZoom);
    return () => {
      map.off('zoomend', clampZoom);
    };
  }, [map]);

  useEffect(() => {
    if (minZoomRef.current == null) return;
    flyToSelection(map, selectedId, trips, home, hasHome, minZoomRef.current);
  }, [map, selectedId, trips, home, hasHome]);

  return null;
}

export default function TravelMap({ trips, home, selectedId, onSelectTrip, onSelectHome }) {
  const validTrips = trips.filter(
    (t) => isValidCoord(t.lat) && isValidCoord(t.lng),
  );
  const hasHome = isValidHome(home);
  const hasAnyPin = validTrips.length > 0 || hasHome;

  if (!hasAnyPin) {
    return (
      <div className={styles.empty}>
        No map pins configured — set a home base or add trip coordinates in the CMS.
      </div>
    );
  }

  const center = hasHome
    ? [home.lat, home.lng]
    : [validTrips[0].lat, validTrips[0].lng];

  return (
    <div className={styles.mapFrame}>
      <MapContainer
        center={center}
        zoom={3}
        minZoom={2}
        maxZoom={MAX_ZOOM}
        maxBoundsViscosity={1}
        className={styles.map}
        scrollWheelZoom
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapController trips={validTrips} home={home} selectedId={selectedId} />
        {hasHome && (
          <Marker
            key={HOME_PIN_ID}
            position={[home.lat, home.lng]}
            icon={createHomeMarkerIcon(selectedId === HOME_PIN_ID)}
            zIndexOffset={1000}
            eventHandlers={{
              click: () => onSelectHome?.(),
            }}
          >
            <Popup>
              <span className={styles.popupHomeLabel}>HOME</span>
              <span className={styles.popupTitle}>{home.location}</span>
            </Popup>
          </Marker>
        )}
        {validTrips.map((trip) => (
          <Marker
            key={trip.id}
            position={[trip.lat, trip.lng]}
            icon={createTripMarkerIcon(trip.id === selectedId)}
            eventHandlers={{
              click: () => onSelectTrip(trip.id),
            }}
          >
            <Popup>
              <span className={styles.popupTitle}>{trip.location}</span>
              {trip.period && <span className={styles.popupPeriod}>{trip.period}</span>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {hasHome && validTrips.length > 0 && (
        <div className={styles.mapLegend} aria-hidden>
          <span className={styles.legendTrip}>● Trip</span>
          <span className={styles.legendHome}>⌂ Home</span>
        </div>
      )}
    </div>
  );
}
