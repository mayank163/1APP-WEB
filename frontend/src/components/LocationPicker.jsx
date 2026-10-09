import '../styles/LocationPicker.css';
import React, { useEffect, useRef, useState } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Singleton promise so the SDK is only injected once per page load
let sdkPromise = null;
const loadGoogleMaps = () => {
    if (sdkPromise) return sdkPromise;
    if (window.google?.maps?.places) return (sdkPromise = Promise.resolve());
    sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => {
            sdkPromise = null;
            reject(new Error('Google Maps failed to load'));
        };
        document.head.appendChild(script);
    });
    return sdkPromise;
};

/**
 * Parse Google address_components into { addressLine, city, state, zipcode }.
 * addressLine = street_number + route (e.g. "123 Main St")
 */
const parseComponents = (components = []) => {
    const get = (...types) => {
        const c = components.find(c => types.some(t => c.types.includes(t)));
        return c?.long_name || '';
    };
    const streetNumber = get('street_number');
    const route = get('route');
    const addressLine = [streetNumber, route].filter(Boolean).join(' ');
    return {
        addressLine,
        city: get('locality', 'postal_town', 'sublocality_level_1', 'administrative_area_level_3'),
        state: get('administrative_area_level_1'),
        zipcode: get('postal_code'),
    };
};

/**
 * LocationPicker
 *
 * Props:
 *   value    – { address, lat, lng, addressLine?, city?, state?, zipcode? } | null
 *   onChange – ({ address, lat, lng, addressLine, city, state, zipcode }) => void
 *   inputStyle – optional style override for the search input
 */
const LocationPicker = ({ value, onChange, inputClassName = '' }) => {
    const inputRef   = useRef(null);
    const mapRef     = useRef(null);
    const markerRef  = useRef(null);
    const mapObjRef  = useRef(null);
    const acRef      = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [ready, setReady]   = useState(!!window.google?.maps?.places);
    const [error, setError]   = useState('');

    // Load SDK once
    useEffect(() => {
        if (ready) return;
        if (!GOOGLE_MAPS_API_KEY) {
            setError('Google Maps API key is not configured (REACT_APP_GOOGLE_MAPS_API_KEY).');
            return;
        }
        loadGoogleMaps()
            .then(() => setReady(true))
            .catch((e) => setError(e.message));
    }, [ready]);

    const initMap = (mapDiv) => {
        if (!mapDiv || !window.google?.maps || mapObjRef.current) return;
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
                const result   = status === 'OK' && results?.[0] ? results[0] : null;
                const address  = result?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                const parsed   = parseComponents(result?.address_components);
                if (inputRef.current) inputRef.current.value = address;
                onChangeRef.current({ address, lat, lng, ...parsed });
            });
        });
    };

    const initAutocomplete = (inputEl) => {
        if (!inputEl || !window.google?.maps?.places || acRef.current) return;
        const ac = new window.google.maps.places.Autocomplete(inputEl, {
            fields: ['formatted_address', 'geometry', 'address_components'],
        });
        acRef.current = ac;

        ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place.geometry?.location) return;
            const lat     = place.geometry.location.lat();
            const lng     = place.geometry.location.lng();
            const address = place.formatted_address || inputEl.value;
            const parsed  = parseComponents(place.address_components);

            if (mapObjRef.current) {
                mapObjRef.current.setCenter({ lat, lng });
                mapObjRef.current.setZoom(16);
            }
            if (markerRef.current) {
                markerRef.current.setPosition({ lat, lng });
                markerRef.current.setVisible(true);
            }
            onChangeRef.current({ address, lat, lng, ...parsed });
        });
    };

    // Callback refs — fires when the node mounts
    const mapCallbackRef = (node) => {
        mapRef.current = node;
        if (node && ready) initMap(node);
    };
    const inputCallbackRef = (node) => {
        inputRef.current = node;
        if (node && ready) initAutocomplete(node);
    };

    // If SDK loaded after nodes already mounted, init both
    useEffect(() => {
        if (!ready) return;
        if (mapRef.current  && !mapObjRef.current) initMap(mapRef.current);
        if (inputRef.current && !acRef.current)    initAutocomplete(inputRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // Sync map when value changes externally (e.g. editing a saved address)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.lat, value?.lng]);

    if (error) {
        return (
            <div className="ui-locationpicker-1" >
                ⚠ {error}
            </div>
        );
    }



    return (
        <div>
            {/* Autocomplete search input — high z-index so the dropdown renders on top */}
            <div className="ui-locationpicker-2" >
                <input className={`ui-locationpicker-3 ${inputClassName}`}
                    ref={inputCallbackRef}
                    type="text"
                    placeholder="Search address on map…"
                    defaultValue={value?.address || ''}
                    autoComplete="off"

                />
            </div>

            {/* Map */}
            <div className="ui-locationpicker-4"
                ref={mapCallbackRef}

            >
                {!ready && (
                    <div className="ui-locationpicker-5" >
                        Loading map…
                    </div>
                )}
            </div>

            {/* Lat/lng hint */}
            {value?.lat && (
                <div className="ui-locationpicker-6" >
                    📍 {value.address} &nbsp;·&nbsp; {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
                </div>
            )}
        </div>
    );
};

export default LocationPicker;
