import React, { useEffect, useRef, useState } from 'react';
import socket from '../services/socket';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

let sdkPromise = null;
const loadGoogleMaps = () => {
  if (sdkPromise) return sdkPromise;
  if (window.google?.maps?.DirectionsService) return (sdkPromise = Promise.resolve());
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { sdkPromise = null; reject(); };
    document.head.appendChild(script);
  });
  return sdkPromise;
};

// Haversine — only used to check if tech moved >50m before re-calling Directions API
const haversineM = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const TechnicianTrackingMap = ({ job }) => {
  const mapRef           = useRef(null);
  const mapObjRef        = useRef(null);
  const techMarkerRef    = useRef(null);
  const jobMarkerRef     = useRef(null);
  const directionsRenderer = useRef(null);
  const directionsService  = useRef(null);
  const lastRouteLocRef  = useRef(null); // { lat, lng } of last Directions API call

  const [techLoc,   setTechLoc]   = useState(null);
  const [routeInfo, setRouteInfo] = useState(null); // { distance, duration }
  const [ready,     setReady]     = useState(false);

  const jobCoords = job?.coordinates?.lat ? job.coordinates : null;

  // ── Load Google Maps SDK ────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps().then(() => setReady(true)).catch(() => {});
  }, []);

  // ── Init map ────────────────────────────────────────────────────────────────
  const initMap = (div) => {
    if (!div || !window.google?.maps || mapObjRef.current) return;

    const center = jobCoords
      ? { lat: jobCoords.lat, lng: jobCoords.lng }
      : { lat: 20.5937, lng: 78.9629 };

    const map = new window.google.maps.Map(div, {
      center,
      zoom: jobCoords ? 14 : 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapObjRef.current = map;

    // Job marker — blue
    if (jobCoords) {
      jobMarkerRef.current = new window.google.maps.Marker({
        map,
        position: { lat: jobCoords.lat, lng: jobCoords.lng },
        title: 'Job Location',
        icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
        zIndex: 1,
      });
      new window.google.maps.InfoWindow({ content: '<b>📍 Job Location</b>' })
        .open(map, jobMarkerRef.current);
    }

    // Technician marker — red
    techMarkerRef.current = new window.google.maps.Marker({
      map,
      visible: false,
      title: 'Technician',
      icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
      zIndex: 2,
    });

    // DirectionsService + Renderer (renders the actual road route)
    directionsService.current  = new window.google.maps.DirectionsService();
    directionsRenderer.current = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,          // we use our own markers
      polylineOptions: {
        strokeColor: '#A5732F',
        strokeWeight: 4,
        strokeOpacity: 0.85,
      },
    });
  };

  const mapCallbackRef = (node) => {
    mapRef.current = node;
    if (node && ready) initMap(node);
  };

  useEffect(() => {
    if (ready && mapRef.current && !mapObjRef.current) initMap(mapRef.current);
  }, [ready]); // eslint-disable-line

  // ── Call Directions API whenever tech moves >50 m ──────────────────────────
  const fetchRoute = (techPos) => {
    if (!jobCoords || !directionsService.current) return;

    // Throttle: skip if tech hasn't moved more than 50 m since last call
    if (lastRouteLocRef.current) {
      const moved = haversineM(
        lastRouteLocRef.current.lat, lastRouteLocRef.current.lng,
        techPos.lat, techPos.lng
      );
      if (moved < 50) return;
    }

    lastRouteLocRef.current = techPos;

    directionsService.current.route(
      {
        origin:      new window.google.maps.LatLng(techPos.lat, techPos.lng),
        destination: new window.google.maps.LatLng(jobCoords.lat, jobCoords.lng),
        travelMode:  window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') {
          directionsRenderer.current.setDirections(result);
          const leg = result.routes[0].legs[0];
          setRouteInfo({
            distance: leg.distance.text,   // e.g. "3.2 km"
            duration: leg.duration.text,   // e.g. "12 mins"
          });
        } else {
          console.warn('[Directions API]', status);
          // On failure keep showing last known route info
        }
      }
    );
  };

  // ── Update tech marker + fetch route on every location update ──────────────
  useEffect(() => {
    if (!techLoc || !mapObjRef.current || !techMarkerRef.current) return;

    const pos = { lat: techLoc.lat, lng: techLoc.lng };

    techMarkerRef.current.setPosition(pos);
    techMarkerRef.current.setVisible(true);

    fetchRoute(pos);

    // Fit both markers in view
    if (jobCoords) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(pos);
      bounds.extend({ lat: jobCoords.lat, lng: jobCoords.lng });
      mapObjRef.current.fitBounds(bounds, 80);
    } else {
      mapObjRef.current.setCenter(pos);
      mapObjRef.current.setZoom(15);
    }
  }, [techLoc]); // eslint-disable-line

  // ── Socket: join job room, listen for location ──────────────────────────────
  useEffect(() => {
    if (!job?._id) return;

    socket.emit('job:watch', job._id);

    const handler = ({ lat, lng, ts }) => setTechLoc({ lat, lng, ts });
    socket.on('technician:location', handler);

    return () => {
      socket.emit('job:unwatch', job._id);
      socket.off('technician:location', handler);
      setTechLoc(null);
      setRouteInfo(null);
      lastRouteLocRef.current = null;
      // Clear route from map
      directionsRenderer.current?.setDirections({ routes: [] });
    };
  }, [job?._id]); // eslint-disable-line

  const lastSeen = techLoc
    ? new Date(techLoc.ts).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;

  return (
    <div>
      {/* ── Status bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        flexWrap: 'wrap', marginBottom: 8, fontSize: '0.82rem',
      }}>
        {/* Live / waiting badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20, fontWeight: 600,
          background: techLoc ? 'rgba(22,163,74,0.1)' : 'rgba(108,117,125,0.1)',
          color: techLoc ? '#16a34a' : '#6c757d',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: techLoc ? '#16a34a' : '#adb5bd',
            display: 'inline-block',
            animation: techLoc ? 'tj-pulse 1.5s infinite' : 'none',
          }} />
          {techLoc ? 'Live' : 'Waiting for technician…'}
        </span>

        {/* Road distance */}
        {routeInfo && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontWeight: 700,
            background: 'rgba(165,115,47,0.1)', color: '#A5732F',
          }}>
            🛣️ {routeInfo.distance}
          </span>
        )}

        {/* ETA */}
        {routeInfo && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontWeight: 700,
            background: 'rgba(37,99,235,0.08)', color: '#2563eb',
          }}>
            🕐 ETA {routeInfo.duration}
          </span>
        )}

        {/* Last updated */}
        {lastSeen && (
          <span style={{ color: '#adb5bd', fontSize: '0.72rem' }}>
            Updated {lastSeen}
          </span>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 6,
        fontSize: '0.75rem', color: '#6c757d',
      }}>
        <span>🔵 Job Location</span>
        <span>🔴 Technician</span>
        <span style={{ color: '#A5732F' }}>━━ Route</span>
      </div>

      {/* ── Map ── */}
      <div
        ref={mapCallbackRef}
        style={{
          width: '100%', height: 320,
          borderRadius: 10, border: '1.5px solid #e9e0d5',
          overflow: 'hidden', background: '#f0f0f0',
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

      {!jobCoords && (
        <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4 }}>
          ⚠️ No job coordinates — route cannot be calculated
        </div>
      )}
    </div>
  );
};

export default TechnicianTrackingMap;
