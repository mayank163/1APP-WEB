import React, { useState, useRef, useEffect } from 'react';

// Country list: { name, flag emoji, dial code, max digits for local number }
export const COUNTRIES = [
    { name: 'India',                flag: '🇮🇳', code: '+91',  maxDigits: 10 },
    { name: 'United States',        flag: '🇺🇸', code: '+1',   maxDigits: 10 },
    { name: 'United Kingdom',       flag: '🇬🇧', code: '+44',  maxDigits: 10 },
    { name: 'Canada',               flag: '🇨🇦', code: '+1',   maxDigits: 10 },
    { name: 'Australia',            flag: '🇦🇺', code: '+61',  maxDigits: 9  },
    { name: 'Germany',              flag: '🇩🇪', code: '+49',  maxDigits: 11 },
    { name: 'France',               flag: '🇫🇷', code: '+33',  maxDigits: 9  },
    { name: 'Italy',                flag: '🇮🇹', code: '+39',  maxDigits: 10 },
    { name: 'Spain',                flag: '🇪🇸', code: '+34',  maxDigits: 9  },
    { name: 'Brazil',               flag: '🇧🇷', code: '+55',  maxDigits: 11 },
    { name: 'Mexico',               flag: '🇲🇽', code: '+52',  maxDigits: 10 },
    { name: 'Japan',                flag: '🇯🇵', code: '+81',  maxDigits: 10 },
    { name: 'China',                flag: '🇨🇳', code: '+86',  maxDigits: 11 },
    { name: 'South Korea',          flag: '🇰🇷', code: '+82',  maxDigits: 10 },
    { name: 'Russia',               flag: '🇷🇺', code: '+7',   maxDigits: 10 },
    { name: 'South Africa',         flag: '🇿🇦', code: '+27',  maxDigits: 9  },
    { name: 'Nigeria',              flag: '🇳🇬', code: '+234', maxDigits: 10 },
    { name: 'Kenya',                flag: '🇰🇪', code: '+254', maxDigits: 9  },
    { name: 'Egypt',                flag: '🇪🇬', code: '+20',  maxDigits: 10 },
    { name: 'Saudi Arabia',         flag: '🇸🇦', code: '+966', maxDigits: 9  },
    { name: 'United Arab Emirates', flag: '🇦🇪', code: '+971', maxDigits: 9  },
    { name: 'Pakistan',             flag: '🇵🇰', code: '+92',  maxDigits: 10 },
    { name: 'Bangladesh',           flag: '🇧🇩', code: '+880', maxDigits: 10 },
    { name: 'Sri Lanka',            flag: '🇱🇰', code: '+94',  maxDigits: 9  },
    { name: 'Nepal',                flag: '🇳🇵', code: '+977', maxDigits: 10 },
    { name: 'Singapore',            flag: '🇸🇬', code: '+65',  maxDigits: 8  },
    { name: 'Malaysia',             flag: '🇲🇾', code: '+60',  maxDigits: 10 },
    { name: 'Indonesia',            flag: '🇮🇩', code: '+62',  maxDigits: 12 },
    { name: 'Thailand',             flag: '🇹🇭', code: '+66',  maxDigits: 9  },
    { name: 'Philippines',          flag: '🇵🇭', code: '+63',  maxDigits: 10 },
    { name: 'Vietnam',              flag: '🇻🇳', code: '+84',  maxDigits: 9  },
    { name: 'Turkey',               flag: '🇹🇷', code: '+90',  maxDigits: 10 },
    { name: 'Netherlands',          flag: '🇳🇱', code: '+31',  maxDigits: 9  },
    { name: 'Sweden',               flag: '🇸🇪', code: '+46',  maxDigits: 9  },
    { name: 'Norway',               flag: '🇳🇴', code: '+47',  maxDigits: 8  },
    { name: 'Denmark',              flag: '🇩🇰', code: '+45',  maxDigits: 8  },
    { name: 'Switzerland',          flag: '🇨🇭', code: '+41',  maxDigits: 9  },
    { name: 'Poland',               flag: '🇵🇱', code: '+48',  maxDigits: 9  },
    { name: 'Argentina',            flag: '🇦🇷', code: '+54',  maxDigits: 10 },
    { name: 'Colombia',             flag: '🇨🇴', code: '+57',  maxDigits: 10 },
    { name: 'New Zealand',          flag: '🇳🇿', code: '+64',  maxDigits: 9  },
    { name: 'Portugal',             flag: '🇵🇹', code: '+351', maxDigits: 9  },
    { name: 'Greece',               flag: '🇬🇷', code: '+30',  maxDigits: 10 },
    { name: 'Israel',               flag: '🇮🇱', code: '+972', maxDigits: 9  },
    { name: 'Iran',                 flag: '🇮🇷', code: '+98',  maxDigits: 10 },
    { name: 'Iraq',                 flag: '🇮🇶', code: '+964', maxDigits: 10 },
    { name: 'Kuwait',               flag: '🇰🇼', code: '+965', maxDigits: 8  },
    { name: 'Qatar',                flag: '🇶🇦', code: '+974', maxDigits: 8  },
    { name: 'Morocco',              flag: '🇲🇦', code: '+212', maxDigits: 9  },
    { name: 'Ghana',                flag: '🇬🇭', code: '+233', maxDigits: 9  },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India

/**
 * CountryCodePicker
 *
 * Props:
 *  - selectedCountry  : country object from COUNTRIES
 *  - onCountryChange  : (country) => void
 *  - phoneValue       : string  (digits only)
 *  - onPhoneChange    : (digits) => void
 *  - required         : bool
 *  - disabled         : bool
 *  - placeholder      : string (optional override)
 */
const CountryCodePicker = ({
    selectedCountry = DEFAULT_COUNTRY,
    onCountryChange,
    phoneValue = '',
    onPhoneChange,
    required = false,
    disabled = false,
    placeholder,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = search.trim()
        ? COUNTRIES.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.code.includes(search)
          )
        : COUNTRIES;

    const handlePhoneInput = (e) => {
        // Only allow digits, trim to maxDigits
        const digits = e.target.value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
        onPhoneChange(digits);
    };

    const handleCountrySelect = (country) => {
        onCountryChange(country);
        // Trim existing number to new country's max
        if (phoneValue.length > country.maxDigits) {
            onPhoneChange(phoneValue.slice(0, country.maxDigits));
        }
        setOpen(false);
        setSearch('');
    };

    const inputPlaceholder = placeholder || `${selectedCountry.maxDigits}-digit number`;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', position: 'relative' }} ref={dropdownRef}>
            {/* Dial code selector button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#f4f4f4',
                    border: 'none',
                    borderRight: '1.5px solid #ddd',
                    borderRadius: '6px 0 0 6px',
                    padding: '8px 10px',
                    cursor: disabled ? 'default' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    color: '#1a1a1a',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    minWidth: 72,
                    justifyContent: 'center',
                    userSelect: 'none',
                }}
            >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{selectedCountry.flag}</span>
                <span>{selectedCountry.code}</span>
                <span style={{ fontSize: '0.6rem', color: '#888', marginLeft: 1 }}>▼</span>
            </button>

            {/* Phone number input */}
            <input
                type="tel"
                inputMode="numeric"
                required={required}
                disabled={disabled}
                value={phoneValue}
                onChange={handlePhoneInput}
                maxLength={selectedCountry.maxDigits}
                placeholder={inputPlaceholder}
                style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.95rem',
                    background: 'transparent',
                    padding: '0 4px',
                    minWidth: 0,
                }}
            />

            {/* Digit counter hint */}
            {phoneValue.length > 0 && (
                <span style={{
                    fontSize: '0.7rem',
                    color: phoneValue.length === selectedCountry.maxDigits ? '#2e7d32' : '#aaa',
                    fontWeight: 600,
                    flexShrink: 0,
                    marginRight: 2,
                }}>
                    {phoneValue.length}/{selectedCountry.maxDigits}
                </span>
            )}

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    zIndex: 9999,
                    background: '#fff',
                    border: '1.5px solid #ddd',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    width: 270,
                    maxHeight: 280,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                    {/* Search box */}
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search country or code..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                border: '1px solid #e0e0e0',
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Country list */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '12px 14px', color: '#aaa', fontSize: '0.85rem' }}>No results</div>
                        ) : (
                            filtered.map((c) => (
                                <button
                                    key={`${c.name}-${c.code}`}
                                    type="button"
                                    onClick={() => handleCountrySelect(c)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        width: '100%',
                                        padding: '9px 14px',
                                        border: 'none',
                                        background: selectedCountry.name === c.name ? '#f5f5f5' : 'transparent',
                                        cursor: 'pointer',
                                        fontSize: '0.88rem',
                                        textAlign: 'left',
                                        borderBottom: '1px solid #f8f8f8',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                                    onMouseLeave={e => e.currentTarget.style.background = selectedCountry.name === c.name ? '#f5f5f5' : 'transparent'}
                                >
                                    <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{c.flag}</span>
                                    <span style={{ flex: 1, color: '#1a1a1a' }}>{c.name}</span>
                                    <span style={{ color: '#888', fontWeight: 600, flexShrink: 0 }}>{c.code}</span>
                                    <span style={{ color: '#bbb', fontSize: '0.75rem', flexShrink: 0 }}>{c.maxDigits}d</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountryCodePicker;
