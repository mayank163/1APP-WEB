import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaHome, FaBriefcase, FaLaptop, FaBullhorn, FaUniversity,
    FaUserTie, FaShieldAlt, FaGraduationCap, FaCalendarAlt,
    FaLeaf, FaCar, FaShareAlt, FaEnvelope, FaShieldVirus,
    FaClock, FaUsers, FaArrowRight, FaChartLine, FaMagic
} from 'react-icons/fa';

const ECOSYSTEM = [
    { icon: <FaHome size={22} />, title: 'Home', desc: 'Premium quality solutions tailored for your home requirements.' },
    { icon: <FaBriefcase size={22} />, title: 'Business', desc: 'Premium quality solutions tailored for your business requirements.' },
    { icon: <FaLaptop size={22} />, title: 'IT', desc: 'Premium quality solutions tailored for your it requirements.' },
    { icon: <FaBullhorn size={22} />, title: 'Marketing', desc: 'Premium quality solutions tailored for your marketing requirements.' },
    { icon: <FaUniversity size={22} />, title: 'Finance', desc: 'Premium quality solutions tailored for your finance requirements.' },
    { icon: <FaUserTie size={22} />, title: 'Professional', desc: 'Premium quality solutions tailored for your professional requirements.' },
    { icon: <FaShieldAlt size={22} />, title: 'Health', desc: 'Premium quality solutions tailored for your health requirements.' },
    { icon: <FaGraduationCap size={22} />, title: 'Education', desc: 'Premium quality solutions tailored for your education requirements.' },
    { icon: <FaCalendarAlt size={22} />, title: 'Events', desc: 'Premium quality solutions tailored for your events requirements.' },
    { icon: <FaLeaf size={22} />, title: 'Beauty', desc: 'Premium quality solutions tailored for your beauty requirements.' },
    { icon: <FaCar size={22} />, title: 'Transportation', desc: 'Premium quality solutions tailored for your transportation requirements.' },
];

const VALUES = [
    { icon: <FaShieldVirus size={28} />, title: 'Trust', desc: 'Every professional on our platform undergoes a rigorous multi-step background check and skill assessment.' },
    { icon: <FaMagic size={28} />, title: 'Simplicity', desc: 'Booking a world-class service is now as easy as ordering a coffee. Intuitive, fast, and reliable.' },
    { icon: <FaChartLine size={28} />, title: 'Growth', desc: 'Empowering thousands of independent professionals with a consistent stream of income and digital tools.' },
];

const HOW_IT_WORKS = [
    { icon: '☝', title: 'Choose', sub: 'Select your service' },
    { icon: '📅', title: 'Book', sub: 'Pick a convenient slot' },
    { icon: '🧑‍🔧', title: 'Pro Arrives', sub: 'Professional at door' },
    { icon: '✅', title: 'Service Done', sub: 'Quality completion' },
    { icon: '☆', title: 'Rate', sub: 'Share experience' },
];

const CORE_VALUES = [
    { icon: <FaShieldAlt size={18} />, title: 'Absolute Trust', desc: 'We prioritize safety and verification above all else, ensuring peace of mind for every booking.' },
    { icon: <FaClock size={18} />, title: 'Extreme Convenience', desc: 'Saving our users precious time by bringing the best services directly to their doorstep.' },
    { icon: <FaUsers size={18} />, title: 'Community Growth', desc: 'Building an ecosystem where professionals can thrive and grow their personal businesses.' },
];

const TEAM = [
    { name: 'Arjun Mehta', role: 'CEO & Co-founder' },
    { name: 'Priya Sharma', role: 'Chief Technology Officer' },
    { name: 'Vikram Singh', role: 'VP Operations' },
    { name: 'Sanya Gupta', role: 'Customer Success Lead' },
    { name: 'Rohan Varma', role: 'Head of Engineering' },
    { name: 'Ananya Iyer', role: 'Marketing Director' },
];

const CTA = [
    { title: 'For Customers', desc: 'Enjoy the premium convenience of verified services at your doorstep.', btn: 'Download App', dark: false },
    { title: 'For Professionals', desc: 'Join the platform that helps you grow your business and reach new heights.', btn: 'Join as Partner', dark: true },
    { title: 'For Partners', desc: 'Collaborate with 1App Service to scale your service enterprise.', btn: 'Partner with Us', dark: false },
];

export default function AboutUs() {
    const navigate = useNavigate();

    return (
        <div style={{ background: '#fff' }}>

            {/* ── Hero ── */}
            <div style={{ background: '#0a0a0a', minHeight: 480, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                {/* Isometric city illustration (SVG placeholder matching the dark city grid) */}
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '58%', opacity: 0.55 }}>
                    <svg viewBox="0 0 700 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        {/* Grid base */}
                        {[0,1,2,3,4,5,6].map(r => [0,1,2,3,4,5,6,7,8].map(c => {
                            const x = 350 + (c - r) * 55;
                            const y = 240 + (c + r) * 28;
                            return <polygon key={`${r}-${c}`} points={`${x},${y-28} ${x+55},${y} ${x},${y+28} ${x-55},${y}`} fill="none" stroke="#c8a96e" strokeWidth="0.4" opacity="0.5" />;
                        }))}
                        {/* Buildings */}
                        {[[350,200,40,80],[260,220,30,60],[440,190,35,100],[310,230,25,50],[390,210,28,70],[480,215,22,45],[230,240,20,40]].map(([x,y,w,h],i) => (
                            <g key={i}>
                                <rect x={x-w/2} y={y-h} width={w} height={h} fill="#1a1a1a" stroke="#c8a96e" strokeWidth="0.6" />
                                <polygon points={`${x-w/2},${y-h} ${x},${y-h-14} ${x+w/2},${y-h}`} fill="#222" stroke="#c8a96e" strokeWidth="0.6" />
                                {[...Array(Math.floor(h/14))].map((_,j) => (
                                    <rect key={j} x={x-w/2+4} y={y-h+j*14+4} width={w-8} height={8} fill="#c8a96e" opacity="0.15" />
                                ))}
                            </g>
                        ))}
                        {/* Service icons in circles */}
                        {[[300,130],[450,110],[540,140],[200,170],[580,180],[160,220],[620,230]].map(([cx,cy],i) => (
                            <g key={i}>
                                <circle cx={cx} cy={cy} r={18} fill="none" stroke="#c8a96e" strokeWidth="0.8" opacity="0.7" />
                                <text x={cx} y={cy+5} textAnchor="middle" fontSize="14" fill="#c8a96e" opacity="0.8">
                                    {['🏠','💼','💻','📢','🚗','✂','❤'][i]}
                                </text>
                            </g>
                        ))}
                        {/* Connecting lines */}
                        {[[300,130,350,200],[450,110,440,190],[540,140,480,215],[200,170,260,220]].map(([x1,y1,x2,y2],i) => (
                            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8a96e" strokeWidth="0.5" opacity="0.4" strokeDasharray="4,4" />
                        ))}
                    </svg>
                </div>

                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px', position: 'relative', zIndex: 1, width: '100%' }}>
                    <h1 style={{ color: '#fff', fontWeight: 900, fontSize: '3rem', marginBottom: 24 }}>About Us</h1>
                    <p style={{ color: '#ccc', fontSize: '15px', lineHeight: 1.8, maxWidth: 360, marginBottom: 16 }}>
                        1APP is a technology-driven platform that connects you with trusted professionals for all your home, workspace, health, fitness, education and beauty needs — from cleaning and repairs to salon and spa services.
                    </p>
                    <p style={{ color: '#aaa', fontSize: '15px', lineHeight: 1.8, maxWidth: 360 }}>
                        We're simplifying your living by ensuring reliable, high-quality and transparent services, every single time.
                    </p>
                </div>
            </div>

            {/* ── Our Business ── */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 40px 0' }}>
                <h2 style={{ fontWeight: 900, fontSize: '1.8rem', marginBottom: 6 }}>Our Business</h2>
                <a href="#" style={{ color: '#000000', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Company Overview →</a>

                <div style={{ marginTop: 40, marginBottom: 8 }}>
                    <h3 style={{ fontWeight: 900, fontSize: '1.6rem', marginBottom: 12 }}>One Platform. Unlimited Possibilities.</h3>
                    <p style={{ color: '#444', fontSize: '15px', lineHeight: 1.7, maxWidth: 380 }}>
                        Providing a seamless connection between households and verified professionals across every vertical imaginable.
                    </p>
                </div>

                {/* Photo grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 12, marginTop: 32, marginBottom: 56 }}>
                    {/* Large left image */}
                    <div style={{ gridRow: '1 / 3', borderRadius: 16, overflow: 'hidden', background: '#1a1a1a', minHeight: 340 }}>
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg,#1a1a1a,#2d2d2d)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 20, minHeight: 340 }}>
                            {/* Team silhouettes */}
                            <svg viewBox="0 0 300 260" width="100%" style={{ maxHeight: 260 }}>
                                {[60,110,160,210].map((x,i) => (
                                    <g key={i}>
                                        <circle cx={x} cy={60+i%2*10} r={22} fill="#333" />
                                        <rect x={x-18} y={84+i%2*10} width={36} height={80} rx={8} fill="#2a2a2a" />
                                        <rect x={x-28} y={90+i%2*10} width={14} height={60} rx={6} fill="#2a2a2a" />
                                        <rect x={x+14} y={90+i%2*10} width={14} height={60} rx={6} fill="#2a2a2a" />
                                    </g>
                                ))}
                            </svg>
                        </div>
                    </div>
                    {/* Top right: smart lock */}
                    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#1e3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
                        <svg viewBox="0 0 120 160" width="80" height="110">
                            <rect x="30" y="10" width="60" height="100" rx="12" fill="#2a5050" stroke="#4a8080" strokeWidth="1.5" />
                            <rect x="40" y="20" width="40" height="55" rx="6" fill="#1a3a3a" />
                            <circle cx="60" cy="85" r="10" fill="#4a8080" />
                            <rect x="55" y="85" width="10" height="14" rx="3" fill="#3a6060" />
                            <circle cx="60" cy="30" r="8" fill="#5a9090" opacity="0.6" />
                            <rect x="48" y="115" width="24" height="8" rx="3" fill="#3a6060" />
                        </svg>
                    </div>
                    {/* Top right 2: cleaning */}
                    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#e8ddd0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
                        <svg viewBox="0 0 120 120" width="90" height="90">
                            <circle cx="60" cy="40" r="28" fill="#c8b090" />
                            <rect x="30" y="68" width="60" height="50" rx="8" fill="#b09070" />
                            <rect x="20" y="80" width="20" height="40" rx="6" fill="#c8b090" />
                            <rect x="80" y="80" width="20" height="40" rx="6" fill="#c8b090" />
                            <rect x="50" y="75" width="20" height="45" rx="4" fill="#a08060" />
                            {/* Gloves */}
                            <ellipse cx="22" cy="95" rx="12" ry="8" fill="#d4a020" transform="rotate(-20,22,95)" />
                            <ellipse cx="98" cy="95" rx="12" ry="8" fill="#d4a020" transform="rotate(20,98,95)" />
                        </svg>
                    </div>
                    {/* Bottom right 1: app mockup */}
                    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
                        <svg viewBox="0 0 100 140" width="70" height="100">
                            <rect x="15" y="5" width="70" height="130" rx="10" fill="#fff" stroke="#ddd" strokeWidth="1.5" />
                            <rect x="20" y="20" width="60" height="40" rx="4" fill="#fdf5ea" />
                            <rect x="20" y="68" width="28" height="28" rx="4" fill="#f0f0f0" />
                            <rect x="52" y="68" width="28" height="28" rx="4" fill="#f0f0f0" />
                            <rect x="20" y="100" width="60" height="8" rx="3" fill="#e0e0e0" />
                            <rect x="20" y="112" width="40" height="8" rx="3" fill="#e0e0e0" />
                            <circle cx="50" cy="8" r="3" fill="#ddd" />
                        </svg>
                    </div>
                    {/* Bottom right 2: app mockup 2 */}
                    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
                        <svg viewBox="0 0 100 140" width="70" height="100">
                            <rect x="15" y="5" width="70" height="130" rx="10" fill="#fff" stroke="#ddd" strokeWidth="1.5" />
                            <rect x="20" y="20" width="60" height="40" rx="4" fill="#e3f2fd" />
                            <rect x="20" y="68" width="28" height="28" rx="4" fill="#f0f0f0" />
                            <rect x="52" y="68" width="28" height="28" rx="4" fill="#f0f0f0" />
                            <rect x="20" y="100" width="60" height="8" rx="3" fill="#e0e0e0" />
                            <rect x="20" y="112" width="40" height="8" rx="3" fill="#e0e0e0" />
                            <circle cx="50" cy="8" r="3" fill="#ddd" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Our Ecosystem ── */}
            <div style={{ background: '#f5f5f0', padding: '56px 0' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
                        <div style={{ width: 4, height: 32, background: '#111', borderRadius: 2 }} />
                        <h2 style={{ fontWeight: 900, fontSize: '1.8rem', margin: 0 }}>Our Ecosystem</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        {ECOSYSTEM.map((item, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ color: '#333' }}>{item.icon}</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{item.title}</div>
                                <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, flex: 1 }}>{item.desc}</div>
                                <div
                                    onClick={() => navigate(`/services?search=${encodeURIComponent(item.title)}`)}
                                    style={{ fontSize: '13px', color: '#333', cursor: 'pointer', marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#000'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#333'}
                                >
                                    Explore <FaArrowRight size={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Building The Future ── */}
            <div style={{ background: '#f5f5f0', padding: '56px 0 72px' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px' }}>
                    <h2 style={{ fontWeight: 900, fontSize: '1.8rem', textAlign: 'center', marginBottom: 48 }}>Building The Future Of Services</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                        {VALUES.map((v, i) => (
                            <div key={i} style={{ background: '#1a1a1a', borderRadius: 20, padding: '40px 28px', textAlign: 'center', color: '#fff' }}>
                                <div style={{ color: '#fff', marginBottom: 16 }}>{v.icon}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 12 }}>{v.title}</div>
                                <div style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.7 }}>{v.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── How It Works ── */}
            <div style={{ background: '#f5f5f0', padding: '72px 0' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px' }}>
                    <h2 style={{ fontWeight: 900, fontSize: '1.8rem', textAlign: 'center', marginBottom: 56 }}>How It Works</h2>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, position: 'relative' }}>
                        {/* Connecting line */}
                        <div style={{ position: 'absolute', top: 44, left: '10%', right: '10%', height: 1, background: '#ccc', zIndex: 0 }} />
                        {HOW_IT_WORKS.map((step, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                                <div style={{ width: 80, height: 80, border: '1.5px solid #ccc', borderRadius: 20, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: 16 }}>
                                    {step.icon}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: 4 }}>{step.title}</div>
                                <div style={{ fontSize: '13px', color: '#888' }}>{step.sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Core Values ── */}
            <div style={{ background: '#fff', padding: '72px 0' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontWeight: 900, fontSize: '1.8rem', marginBottom: 36 }}>Our Core Values</h2>
                        {CORE_VALUES.map((v, i) => (
                            <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#555' }}>
                                    {v.icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: 4 }}>{v.title}</div>
                                    <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.7 }}>{v.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Photo */}
                    <div style={{ borderRadius: 24, overflow: 'hidden', background: '#e8e0d8', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 400 380" width="100%" height="100%">
                            <rect width="400" height="380" fill="#d4c8bc" />
                            {/* Two people talking */}
                            <circle cx="160" cy="130" r="50" fill="#c8a888" />
                            <rect x="110" y="180" width="100" height="120" rx="12" fill="#5a6a7a" />
                            <circle cx="280" cy="150" r="40" fill="#b89878" />
                            <rect x="240" y="190" width="80" height="100" rx="10" fill="#2d4a3e" />
                            <rect x="80" y="280" width="240" height="100" rx="0" fill="#c8b8a8" />
                            {/* Glasses on person 1 */}
                            <rect x="138" y="125" width="20" height="12" rx="5" fill="none" stroke="#333" strokeWidth="2" />
                            <rect x="162" y="125" width="20" height="12" rx="5" fill="none" stroke="#333" strokeWidth="2" />
                            <line x1="158" y1="131" x2="162" y2="131" stroke="#333" strokeWidth="2" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Leadership Team ── */}
            {/* <div style={{ background: '#f5f5f0', padding: '72px 0' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px' }}>
                    <h2 style={{ fontWeight: 900, fontSize: '1.8rem', textAlign: 'center', marginBottom: 48 }}>Leadership Team</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                        {TEAM.map((member, i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
                                <div style={{ height: 200, background: '#f0ece8' }} />
                                <div style={{ padding: '16px 20px 20px' }}>
                                    <div style={{ fontWeight: 800, fontSize: '15px' }}>{member.name}</div>
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: 12 }}>{member.role}</div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <FaShareAlt size={14} color="#555" style={{ cursor: 'pointer' }} />
                                        <FaEnvelope size={14} color="#555" style={{ cursor: 'pointer' }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div> */}

            {/* ── CTA Cards ── */}
            <div style={{ background: '#f5f5f0', padding: '0 0 72px' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                        {CTA.map((c, i) => (
                            <div key={i} style={{ background: c.dark ? '#111' : '#f0ece8', borderRadius: 20, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: c.dark ? '#fff' : '#111' }}>{c.title}</div>
                                <div style={{ fontSize: '13px', color: c.dark ? '#aaa' : '#555', lineHeight: 1.7, flex: 1 }}>{c.desc}</div>
                                <button style={{ marginTop: 16, background: '#000000', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: '100%' }}>
                                    {c.btn}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Tagline Banner ── */}
            <div style={{ background: '#0a0a0a', padding: '72px 40px', textAlign: 'center' }}>
                <div style={{ fontStyle: 'italic', fontWeight: 900, fontSize: '2.8rem', color: '#fff', marginBottom: 16 }}>
                    We're just getting started.
                </div>
                <div style={{ fontSize: '13px', letterSpacing: '3px', color: '#888', fontWeight: 600 }}>
                    BUILDING INDIA'S MOST CONNECTED SERVICE ECOSYSTEM.
                </div>
            </div>

        </div>
    );
}
