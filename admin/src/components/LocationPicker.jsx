import React, { useEffect, useRef, useState } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

let sdkPromise = null;
const loadGoogleMaps = () => {
  if (sdkPromise) return sdkPromise;
  if (window.google?.maps?.places) return (sdkPromise = Promise.resolve());
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { sdkPromise = null; reject(new Error('Google Maps failed to load')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
};

/**
 * Parse address_components from a Google Places/Geocoder result into
 * { city, state, zipCode }.
 */
const parseAddressComponents = (components = []) => {
  const get = (...types) => {
    const c = components.find(c => types.some(t => c.types.includes(t)));
    return c?.long_name || '';
  };
  return {
    city:    get('locality', 'postal_town', 'sublocality_level_1', 'administrative_area_level_3'),
    state:   get('administrative_area_level_1'),
    zipCode: get('postal_code'),
  };
};

/**
 * LocationPicker
 * Props:
 *   value    – { address, lat, lng, city?, state?, zipCode? } | null
 *   onChange – ({ address, lat, lng, city, state, zipCode }) => void
 */
const LocationPicker = ({ value, onChange }) => {
  const inputRef  = useRef(null);
  const mapRef    = useRef(null);
  const markerRef = useRef(null);
  const mapObjRef = useRef(null);
  const acRef     = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [ready, setReady] = useState(!!window.google?.maps?.places);
  const [error, setError] = useState('');

  // Load SDK
  useEffect(() => {
    if (ready) return;
    loadGoogleMaps().then(() => setReady(true)).catch((e) => setError(e.message));
  }, [ready]);

  // Init map — runs whenever both ready=true AND the map div is in the DOM
  const initMap = (mapDiv) => {
    if (!mapDiv || !window.google?.maps) return;
    if (mapObjRef.current) return; // already initialised

    const center = value?.lat ? { lat: value.lat, lng: value.lng } : { lat: 20.5937, lng: 78.9629 };

    const map = new window.google.maps.Map(mapDiv, {
      center,
      zoom: value?.lat ? 16 : 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapObjRef.current = map;

    const marker = new window.google.maps.Marker({
      map,
      position: value?.lat ? center : null,
      draggable: true,
      visible: !!value?.lat,
    });
    markerRef.current = marker;

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      const lat = pos.lat();
      const lng = pos.lng();
      new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        const result  = status === 'OK' && results[0] ? results[0] : null;
        const address = result ? result.formatted_address : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const { city, state, zipCode } = parseAddressComponents(result?.address_components);
        if (inputRef.current) inputRef.current.value = address;
        onChangeRef.current({ address, lat, lng, city, state, zipCode });
      });
    });
  };

  // Init autocomplete — runs whenever both ready=true AND the input is in the DOM
  const initAutocomplete = (inputEl) => {
    if (!inputEl || !window.google?.maps?.places) return;
    if (acRef.current) return; // already initialised

    const ac = new window.google.maps.places.Autocomplete(inputEl, {
      fields: ['formatted_address', 'geometry', 'address_components'],
    });
    acRef.current = ac;

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const address = place.formatted_address || inputEl.value;
      const { city, state, zipCode } = parseAddressComponents(place.address_components);

      // Update map + marker
      if (mapObjRef.current) {
        mapObjRef.current.setCenter({ lat, lng });
        mapObjRef.current.setZoom(16);
      }
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
        markerRef.current.setVisible(true);
      }
      onChangeRef.current({ address, lat, lng, city, state, zipCode });
    });
  };

  // Callback refs — called by React when the DOM node mounts/unmounts
  const mapCallbackRef = (node) => {
    mapRef.current = node;
    if (node && ready) initMap(node);
  };

  const inputCallbackRef = (node) => {
    inputRef.current = node;
    if (node && ready) initAutocomplete(node);
  };

  // If SDK loads after the nodes are already mounted, init both
  useEffect(() => {
    if (!ready) return;
    if (mapRef.current && !mapObjRef.current) initMap(mapRef.current);
    if (inputRef.current && !acRef.current) initAutocomplete(inputRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Sync map when value changes externally (e.g. edit modal opens with saved coords)
  useEffect(() => {
    if (!value?.lat || !mapObjRef.current || !markerRef.current) return;
    const pos = { lat: value.lat, lng: value.lng };
    mapObjRef.current.setCenter(pos);
    mapObjRef.current.setZoom(16);
    markerRef.current.setPosition(pos);
    markerRef.current.setVisible(true);
    if (inputRef.current && !inputRef.current.value) {
      inputRef.current.value = value.address || '';
    }
  }, [value?.lat, value?.lng]); // eslint-disable-line

  if (error) return <div className="text-danger small mt-1">{error}</div>;

  return (
    <div>
      {/* Autocomplete input — z-index ensures dropdown renders above modal */}
      <div style={{ position: 'relative', zIndex: 1100 }}>
        <input
          ref={inputCallbackRef}
          className="form-control tj-input mb-2"
          type="text"
          placeholder="Search address…"
          defaultValue={value?.address || ''}
          autoComplete="off"
        />
      </div>

      {/* Map */}
      <div
        ref={mapCallbackRef}
        style={{
          width: '100%',
          height: 260,
          borderRadius: 10,
          border: '1.5px solid #e9e0d5',
          overflow: 'hidden',
          background: '#f0f0f0',
        }}
      >
        {!ready && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#adb5bd', fontSize: '0.85rem',
          }}>
            Loading map…
          </div>
        )}
      </div>

      {value?.lat && (
        <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: 4 }}>
          📍 {value.address} &nbsp;·&nbsp; {Number(value.lat).toFixed(6)}, {Number(value.lng).toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
