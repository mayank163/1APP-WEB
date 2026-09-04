import React, { useEffect, useRef, useState } from 'react';
import socket from '../services/socket';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

let sdkPromise = null;
const loadGoogleMaps = () => {
  if (sdkPromise) return sdkPromise;
  if (window.google?.maps) return (sdkPromise = Promise.resolve());
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { sdkPromise = null; reject(); };
    document.head.appendChild(script);
  });
  return sdkPromise;
};

// Haversine distance in km (fallback if geometry lib not ready)
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fmtDist = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;

/**
 * TechnicianTrackingMap
 * Props:
 *   job – the selected job object (needs job._id, job.coordinates)
 */
const TechnicianTrackingMap = ({ job }) => {
  const mapRef      = useRef(null);
  const mapObjRef   = useRef(null);
  const techMarker  = useRef(null);
  const jobMarker   = useRef(null);
  const polylineRef = useRef(null);

  const [techLoc, setTechLoc]   = useState(null); // { lat, lng, ts }
  const [distance, setDistance] = useState(null);
  const [ready, setReady]       = useState(false);
  const [watching, setWatching] = useState(false);

  const jobCoords = job?.coordinates?.lat ? job.coordinates : null;

  // Load SDK
  useEffect(() => {
    loadGoogleMaps().then(() => setReady(true)).catch(() => {});
  }, []);

  // Init map once SDK ready and div mounted
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

    // Job location marker (blue pin)
    if (jobCoords) {
      jobMarker.current = new window.google.maps.Marker({
        map,
        position: { lat: jobCoords.lat, lng: jobCoords.lng },
        title: 'Job Location',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        },
      });

      new window.google.maps.InfoWindow({ content: '<b>📍 Job Location</b>' })
        .open(map, jobMarker.current);
    }

    // Technician marker (red, animated)
    techMarker.current = new window.google.maps.Marker({
      map,
      visible: false,
      title: 'Technician',
      icon: {
        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      },
    });

    // Dashed polyline between tech and job
    polylineRef.current = new window.google.maps.Polyline({
      map,
      strokeColor: '#A5732F',
      strokeOpacity: 0,
      strokeWeight: 2,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
        offset: '0',
        repeat: '12px',
      }],
    });
  };

  const mapCallbackRef = (node) => {
    mapRef.current = node;
    if (node && ready) initMap(node);
  };

  useEffect(() => {
    if (ready && mapRef.current && !mapObjRef.current) initMap(mapRef.current);
  }, [ready]); // eslint-disable-line

  // Update technician marker whenever techLoc changes
  useEffect(() => {
    if (!techLoc || !mapObjRef.current || !techMarker.current) return;

    const pos = { lat: techLoc.lat, lng: techLoc.lng };
    techMarker.current.setPosition(pos);
    techMarker.current.setVisible(true);

    // Update dashed line
    if (jobCoords && polylineRef.current) {
      polylineRef.current.setPath([
        pos,
        { lat: jobCoords.lat, lng: jobCoords.lng },
      ]);
    }

    // Distance
    const dist = haversine(techLoc.lat, techLoc.lng, jobCoords?.lat, jobCoords?.lng);
    if (jobCoords) setDistance(dist);

    // Fit both markers in view
    if (jobCoords) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(pos);
      bounds.extend({ lat: jobCoords.lat, lng: jobCoords.lng });
      mapObjRef.current.fitBounds(bounds, 60);
    } else {
      mapObjRef.current.setCenter(pos);
      mapObjRef.current.setZoom(15);
    }
  }, [techLoc]); // eslint-disable-line

  // Socket: join job room and listen for location updates
  useEffect(() => {
    if (!job?._id) return;

    socket.emit('job:watch', job._id);
    setWatching(true);

    const handler = ({ lat, lng, ts }) => {
      setTechLoc({ lat, lng, ts });
    };

    socket.on('technician:location', handler);

    return () => {
      socket.emit('job:unwatch', job._id);
      socket.off('technician:location', handler);
      setWatching(false);
      setTechLoc(null);
      setDistance(null);
    };
  }, [job?._id]);

  const lastSeen = techLoc
    ? new Date(techLoc.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 8, fontSize: '0.82rem',
      }}>
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

        {distance != null && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontWeight: 700,
            background: 'rgba(165,115,47,0.1)', color: '#A5732F',
          }}>
            📏 {fmtDist(distance)} from job
          </span>
        )}

        {lastSeen && (
          <span style={{ color: '#adb5bd', fontSize: '0.75rem' }}>
            Updated {lastSeen}
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 6, fontSize: '0.75rem', color: '#6c757d' }}>
        <span>🔵 Job Location</span>
        <span>🔴 Technician</span>
        <span style={{ color: '#A5732F' }}>— — Distance</span>
      </div>

      {/* Map */}
      <div
        ref={mapCallbackRef}
        style={{
          width: '100%', height: 300,
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
          ⚠️ No job coordinates saved — distance cannot be calculated
        </div>
      )}
    </div>
  );
};

export default TechnicianTrackingMap;
