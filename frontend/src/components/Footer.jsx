import React from 'react';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#f0f0f0', color: '#333', padding: '48px 0 24px' }}>
      <div className="container">
        {/* Logo */}
        <div className="mb-4 d-flex align-items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="20" height="4" rx="1" fill="#111"/>
            <rect x="2" y="10" width="20" height="4" rx="1" fill="#111"/>
            <rect x="2" y="17" width="20" height="4" rx="1" fill="#111"/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: 1 }}>ONE-APP</span>
        </div>

        {/* Columns */}
        <div className="row mb-5">
          <div className="col-md-3 mb-4">
            <h6 className="fw-bold mb-3">Company</h6>
            {['About us','Investor Relations','Terms & conditions','Privacy policy','Anti-discrimination policy','Careers'].map(item => (
              <p key={item} className="mb-2"><a href="#" style={{ color: '#555', textDecoration: 'none' }}>{item}</a></p>
            ))}
          </div>
          <div className="col-md-3 mb-4">
            <h6 className="fw-bold mb-3">For customers</h6>
            {['One App reviews','Categories near you','Contact us'].map(item => (
              <p key={item} className="mb-2"><a href="#" style={{ color: '#555', textDecoration: 'none' }}>{item}</a></p>
            ))}
          </div>
          <div className="col-md-3 mb-4">
            <h6 className="fw-bold mb-3">For professionals</h6>
            <p className="mb-2"><a href="#" style={{ color: '#555', textDecoration: 'none' }}>Register as a professional</a></p>
          </div>
          <div className="col-md-3 mb-4">
            <h6 className="fw-bold mb-3">Social links</h6>
            <div className="d-flex gap-2 mb-3">
              {/* X (Twitter) */}
              <a href="#" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.264 5.633 5.9-5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              {/* Instagram */}
              <a href="#" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: '#ccc' }} />

        <p className="mb-1" style={{ color: '#555', fontSize: '0.85rem' }}>*As on December 31, 2024</p>
        <p className="mb-0" style={{ color: '#555', fontSize: '0.85rem' }}>© Copyright 2025 One App Services &amp; One App Partner. All rights reserved. | CIN:</p>
      </div>
    </footer>
  );
}
