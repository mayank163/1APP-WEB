import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollManager
 *
 * Two behaviours in one:
 *  1. When navigating TO a new page  → scroll to top (0, 0).
 *  2. When navigating BACK to a page → restore the exact scroll
 *     position the user was at when they left.
 *
 * Works by:
 *  - Storing { pathname+search → scrollY } in sessionStorage so it
 *    survives re-renders but is cleared when the tab closes.
 *  - Saving the current scroll position before the location changes
 *    (via a beforeunload + location-change effect).
 */

const STORAGE_KEY = '1app_scroll_positions';

const readPositions = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const savePosition = (key, y) => {
  try {
    const positions = readPositions();
    positions[key] = y;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // sessionStorage unavailable – silently ignore
  }
};

const ScrollManager = () => {
  const { pathname, search, action } = useLocation();
  const locationKey = pathname + search;

  // Keep a ref to the previous location key so we can save its scroll
  // position just before we move away from it.
  const prevKeyRef = useRef(null);

  useEffect(() => {
    // 1. Save scroll position of the page we're leaving
    if (prevKeyRef.current && prevKeyRef.current !== locationKey) {
      savePosition(prevKeyRef.current, window.scrollY);
    }

    // 2. Decide where to scroll on the incoming page
    const positions = readPositions();
    const saved = positions[locationKey];

    if (saved !== undefined) {
      // User navigated back – restore position
      // Small timeout lets the page finish painting before jumping
      const timer = setTimeout(() => {
        window.scrollTo({ top: saved, behavior: 'instant' });
      }, 50);
      prevKeyRef.current = locationKey;
      return () => clearTimeout(timer);
    } else {
      // Fresh navigation – go to top
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    prevKeyRef.current = locationKey;
  }, [locationKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also save position when the user refreshes / closes the tab
  useEffect(() => {
    const handleUnload = () => {
      if (prevKeyRef.current) {
        savePosition(prevKeyRef.current, window.scrollY);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return null;
};

export default ScrollManager;
