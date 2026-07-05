import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchPlaces } from '../utils/geocode';
import styles from './TravelLocationPicker.module.css';

const DEFAULT_CENTER = [59.3293, 18.0686];
const DEFAULT_ZOOM = 4;
const SEARCH_DEBOUNCE_MS = 450;

function isValidCoord(n) {
  return typeof n === 'number' && !Number.isNaN(n);
}

function roundCoord(n) {
  return Math.round(n * 1e6) / 1e6;
}

function createPickerIcon() {
  return L.divIcon({
    className: styles.markerRoot,
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#82bfbf;border:2px solid #d0dce3;box-shadow:0 0 10px rgba(95,143,143,0.6);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function MapFlyTo({ lat, lng, flyKey }) {
  const map = useMap();
  useEffect(() => {
    if (flyKey <= 0 || !isValidCoord(lat) || !isValidCoord(lng)) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 10), { duration: 0.65 });
  }, [map, lat, lng, flyKey]);
  return null;
}

export default function TravelLocationPicker({ lat, lng, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [flyKey, setFlyKey] = useState(0);
  const searchWrapRef = useRef(null);

  const hasPin = isValidCoord(lat) && isValidCoord(lng);
  const center = hasPin ? [lat, lng] : DEFAULT_CENTER;
  const zoom = hasPin ? 6 : DEFAULT_ZOOM;

  const handlePick = useCallback(
    (newLat, newLng, locationLabel) => {
      onChange(roundCoord(newLat), roundCoord(newLng), locationLabel);
    },
    [onChange],
  );

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setSearchError('');
      return undefined;
    }

    const controller = new AbortController();
    setSearching(true);
    setSearchError('');

    const timer = setTimeout(() => {
      searchPlaces(q, controller.signal)
        .then((results) => {
          setSearchResults(results);
          setSearchOpen(true);
          if (results.length === 0) {
            setSearchError('No English results — try adding a country (e.g. "Ko Lanta, Thailand").');
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setSearchResults([]);
          setSearchError('Search failed — try again.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!searchWrapRef.current?.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSearchSelect = (result) => {
    handlePick(result.lat, result.lng, result.label);
    setSearchQuery(result.label);
    setSearchResults([]);
    setSearchOpen(false);
    setFlyKey((k) => k + 1);
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Search for a place (results shown in English), click the map to place a pin, or drag the pin to fine-tune.
      </p>

      <div className={styles.searchWrap} ref={searchWrapRef}>
        <input
          type="search"
          className={styles.searchInput}
          value={searchQuery}
          placeholder="Search city, country, or address…"
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchResults.length > 0) setSearchOpen(true);
          }}
          autoComplete="off"
        />
        {searching && <span className={styles.searchStatus}>Searching…</span>}
        {searchError && <span className={styles.searchError}>{searchError}</span>}
        {searchOpen && !searching && searchResults.length === 0 && searchQuery.trim().length >= 2 && searchError && (
          <p className={styles.searchEmpty}>{searchError}</p>
        )}
        {searchOpen && searchResults.length > 0 && (
          <ul className={styles.searchResults} role="listbox">
            {searchResults.map((result) => (
              <li key={result.placeId}>
                <button
                  type="button"
                  className={styles.searchResultBtn}
                  role="option"
                  onClick={() => handleSearchSelect(result)}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.mapFrame}>
        <MapContainer
          center={center}
          zoom={zoom}
          className={styles.map}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapResizeFix />
          <MapFlyTo lat={lat} lng={lng} flyKey={flyKey} />
          <MapClickHandler onPick={(la, ln) => handlePick(la, ln)} />
          {hasPin && (
            <Marker
              position={[lat, lng]}
              icon={createPickerIcon()}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat: newLat, lng: newLng } = e.target.getLatLng();
                  handlePick(newLat, newLng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className={styles.coordRow}>
        <label className={styles.coordField}>
          <span className={styles.coordLabel}>Latitude</span>
          <input
            type="number"
            step="any"
            className={styles.coordInput}
            value={lat ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? '' : Number(e.target.value);
              onChange(v, lng);
            }}
          />
        </label>
        <label className={styles.coordField}>
          <span className={styles.coordLabel}>Longitude</span>
          <input
            type="number"
            step="any"
            className={styles.coordInput}
            value={lng ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? '' : Number(e.target.value);
              onChange(lat, v);
            }}
          />
        </label>
      </div>

      <p className={styles.attribution}>Place search via OpenStreetMap Nominatim</p>
    </div>
  );
}
