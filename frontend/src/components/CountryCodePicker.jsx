import { cssValue } from '../utils/cssValue';
import '../styles/CountryCodePicker.css';
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
        <div className="ui-countrycodepicker-1"  ref={dropdownRef}>
            {/* Dial code selector button */}
            <button className="ui-countrycodepicker-2"
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                style={{ "--ui-countrycodepicker-2-cursor": cssValue(disabled ? 'default' : 'pointer', "cursor") }}
            >
                <span className="ui-countrycodepicker-3" >{selectedCountry.flag}</span>
                <span>{selectedCountry.code}</span>
                <span className="ui-countrycodepicker-4" >▼</span>
            </button>

            {/* Phone number input */}
            <input className="ui-countrycodepicker-5"
                type="tel"
                inputMode="numeric"
                required={required}
                disabled={disabled}
                value={phoneValue}
                onChange={handlePhoneInput}
                maxLength={selectedCountry.maxDigits}
                placeholder={inputPlaceholder}

            />

            {/* Digit counter hint */}
            {phoneValue.length > 0 && (
                <span className="ui-countrycodepicker-6" style={{ "--ui-countrycodepicker-6-color": cssValue(phoneValue.length === selectedCountry.maxDigits ? "var(--ui-color-269)" : "var(--ui-color-19)", "color") }}>
                    {phoneValue.length}/{selectedCountry.maxDigits}
                </span>
            )}

            {/* Dropdown */}
            {open && (
                <div className="ui-countrycodepicker-7" >
                    {/* Search box */}
                    <div className="ui-countrycodepicker-8" >
                        <input className="ui-countrycodepicker-9"
                            autoFocus
                            type="text"
                            placeholder="Search country or code..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}

                        />
                    </div>

                    {/* Country list */}
                    <div className="ui-countrycodepicker-10" >
                        {filtered.length === 0 ? (
                            <div className="ui-countrycodepicker-11" >No results</div>
                        ) : (
                            filtered.map((c) => (
                                <button className="ui-countrycodepicker-12"
                                    key={`${c.name}-${c.code}`}
                                    type="button"
                                    onClick={() => handleCountrySelect(c)}
                                    style={{ "--ui-countrycodepicker-12-background": cssValue(selectedCountry.name === c.name ? "var(--ui-color-35)" : "var(--ui-color-120)", "background") }}


                                >
                                    <span className="ui-countrycodepicker-13" >{c.flag}</span>
                                    <span className="ui-countrycodepicker-14" >{c.name}</span>
                                    <span className="ui-countrycodepicker-15" >{c.code}</span>
                                    <span className="ui-countrycodepicker-16" >{c.maxDigits}d</span>
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
