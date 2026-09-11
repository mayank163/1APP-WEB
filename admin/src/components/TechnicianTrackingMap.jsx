import React, { useEffect, useRef, useState } from 'react';
import socket from '../services/socket';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// ── Statuses where the tech is actively moving toward or at the job site ──────
const ACTIVE_STATUSES = ['assigned', 'ontheway', 'visited', 'inprogress'];

// ── Google Maps SDK loader (singleton promise) ────────────────────────────────
let sdkPromise = null;
const loadGoogleMaps = () => {
  if (sdkPromise) return sdkPromise;
  if (window.google?.maps?.DirectionsService) return (sdkPromise = Promise.resolve());
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places`;
    script.async = true;
    script.onload  = resolve;
    script.onerror = () => { sdkPromise = null; reject(); };
    document.head.appendChild(script);
  });
  return sdkPromise;
};

// ── Haversine distance (metres) — used to throttle Directions API calls ───────
const haversineM = (lat1, lng1, lat2, lng2) => {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Status-aware waiting message ──────────────────────────────────────────────
const waitingLabel = (status) => {
  switch (status) {
    case 'ontheway':   return 'Waiting for location…';
    case 'visited':    return 'Technician on site — awaiting GPS update…';
    case 'inprogress': return 'Job in progress — location may not update…';
    default:           return 'Waiting for technician…';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const TechnicianTrackingMap = ({ job }) => {
  const mapRef              = useRef(null);
  const mapObjRef           = useRef(null);
  const techMarkerRef       = useRef(null);
  const jobMarkerRef        = useRef(null);
  const directionsRenderer  = useRef(null);
  const directionsService   = useRef(null);
  const lastRouteLocRef     = useRef(null); // { lat, lng } of last Directions API call

  const [techLoc,   setTechLoc]   = useState(null);
  const [routeInfo, setRouteInfo] = useState(null); // { distance, duration }
  const [ready,     setReady]     = useState(false);

  const jobCoords = job?.coordinates?.lat ? job.coordinates : null;
  const jobStatus = job?.status || '';

  // ── Load Google Maps SDK ────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps().then(() => setReady(true)).catch(() => {});
  }, []);

  // ── Initialise map once SDK is ready ────────────────────────────────────────
  const initMap = (div) => {
    if (!div || !window.google?.maps || mapObjRef.current) return;

    const center = jobCoords
      ? { lat: jobCoords.lat, lng: jobCoords.lng }
      : { lat: 20.5937, lng: 78.9629 }; // centre of India fallback

    const map = new window.google.maps.Map(div, {
      center,
      zoom: jobCoords ? 14 : 5,
      mapTypeControl:     false,
      streetViewControl:  false,
      fullscreenControl:  false,
    });
    mapObjRef.current = map;

    // Blue pin — job location
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

    // Red pin — technician (hidden until we receive a location)
    techMarkerRef.current = new window.google.maps.Marker({
      map,
      visible: false,
      title: 'Technician',
      icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
      zIndex: 2,
    });

    directionsService.current  = new window.google.maps.DirectionsService();
    directionsRenderer.current = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor:   '#A5732F',
        strokeWeight:  4,
        strokeOpacity: 0.85,
      },
    });
  };

  // ref callback keeps mapRef.current in sync before initMap runs
  const mapCallbackRef = (node) => {
    mapRef.current = node;
    if (node && ready) initMap(node);
  };

  useEffect(() => {
    if (ready && mapRef.current && !mapObjRef.current) initMap(mapRef.current);
  }, [ready]); // eslint-disable-line

  // ── Update job-pin if coordinates arrive after map init ────────────────────
  useEffect(() => {
    if (!mapObjRef.current || !window.google?.maps || !jobCoords) return;

    if (jobMarkerRef.current) {
      // Marker already exists — just reposition it
      jobMarkerRef.current.setPosition({ lat: jobCoords.lat, lng: jobCoords.lng });
    } else {
      // Create the marker now that we have coords
      jobMarkerRef.current = new window.google.maps.Marker({
        map: mapObjRef.current,
        position: { lat: jobCoords.lat, lng: jobCoords.lng },
        title: 'Job Location',
        icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
        zIndex: 1,
      });
      new window.google.maps.InfoWindow({ content: '<b>📍 Job Location</b>' })
        .open(mapObjRef.current, jobMarkerRef.current);
    }

    // If no tech position yet, re-centre on job
    if (!techLoc) {
      mapObjRef.current.setCenter({ lat: jobCoords.lat, lng: jobCoords.lng });
      mapObjRef.current.setZoom(14);
    }
  }, [jobCoords?.lat, jobCoords?.lng]); // eslint-disable-line

  // ── Fetch road route via Directions API (throttled to every 50 m) ──────────
  const fetchRoute = (techPos) => {
    if (!jobCoords || !directionsService.current) return;

    if (lastRouteLocRef.current) {
      const moved = haversineM(
        lastRouteLocRef.current.lat, lastRouteLocRef.current.lng,
        techPos.lat, techPos.lng
      );
      if (moved < 50) return; // not worth a new API call
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
          directionsRenderer.current?.setDirections(result);
          const leg = result.routes[0].legs[0];
          setRouteInfo({
            distance: leg.distance.text, // e.g. "3.2 km"
            duration: leg.duration.text, // e.g. "12 mins"
          });
        } else {
          console.warn('[TechnicianTrackingMap] Directions API:', status);
        }
      }
    );
  };

  // ── Move technician marker + refresh route on every location update ─────────
  useEffect(() => {
    if (!techLoc || !mapObjRef.current || !techMarkerRef.current) return;

    const pos = { lat: techLoc.lat, lng: techLoc.lng };
    techMarkerRef.current.setPosition(pos);
    techMarkerRef.current.setVisible(true);

    fetchRoute(pos);

    // Keep both pins in view
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

  // ── Socket: join job room, listen for location, re-join on reconnect ────────
  useEffect(() => {
    if (!job?._id) return;

    const watchJob = () => socket.emit('job:watch', job._id);
    watchJob(); // join immediately

    const handleLocation = ({ lat, lng, ts }) => setTechLoc({ lat, lng, ts });

    // Re-join the job room whenever the socket reconnects (server clears rooms
    // on disconnect so we must re-emit job:watch after every reconnection).
    socket.on('connect',              watchJob);
    socket.on('technician:location',  handleLocation);

    return () => {
      socket.emit('job:unwatch', job._id);
      socket.off('connect',             watchJob);
      socket.off('technician:location', handleLocation);

      // Reset map state for the next job
      setTechLoc(null);
      setRouteInfo(null);
      lastRouteLocRef.current = null;

      // Clear the drawn route (null-guard — renderer may not be init yet)
      if (directionsRenderer.current) {
        try { directionsRenderer.current.setDirections({ routes: [] }); } catch (_) {}
      }
    };
  }, [job?._id]); // eslint-disable-line

  // ── Derived display values ──────────────────────────────────────────────────
  const lastSeen = techLoc
    ? new Date(techLoc.ts).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;

  const isLive   = !!techLoc;
  const isOnSite = ['visited', 'inprogress'].includes(jobStatus);

  return (
    <div>
      {/* ── Status bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        flexWrap: 'wrap', marginBottom: 8, fontSize: '0.82rem',
      }}>

        {/* Live / waiting / on-site badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20, fontWeight: 600,
          background: isLive
            ? 'rgba(22,163,74,0.1)'
            : isOnSite
              ? 'rgba(37,99,235,0.08)'
              : 'rgba(108,117,125,0.1)',
          color: isLive ? '#16a34a' : isOnSite ? '#2563eb' : '#6c757d',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            display: 'inline-block',
            background: isLive ? '#16a34a' : isOnSite ? '#2563eb' : '#adb5bd',
            animation: isLive ? 'tj-pulse 1.5s infinite' : 'none',
          }} />
          {isLive
            ? 'Live'
            : isOnSite
              ? 'On site'
              : waitingLabel(jobStatus)}
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

      {/* ── Map canvas ── */}
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
          ⚠️ No job coordinates set — road route cannot be calculated
        </div>
      )}
    </div>
  );
};

export default TechnicianTrackingMap;
