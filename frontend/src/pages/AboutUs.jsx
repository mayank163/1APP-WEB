import { cssValue } from '../utils/cssValue';
import '../styles/AboutUs.css';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaHome, FaBriefcase, FaLaptop, FaBullhorn, FaUniversity,
    FaUserTie, FaShieldAlt, FaGraduationCap, FaCalendarAlt,
    FaLeaf, FaCar, FaShareAlt, FaEnvelope, FaShieldVirus,
    FaClock, FaUsers, FaArrowRight, FaChartLine, FaMagic
} from 'react-icons/fa';
import heroImage from '../assets/hero/image.png';
import technicianImage from '../assets/hero/technician_image.png';

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
        <div className="ui-aboutus-1" >

            {/* ── Hero ── */}
            <div className="ui-aboutus-2" >
                {/* Isometric city illustration (SVG placeholder matching the dark city grid) */}
                <div className="ui-aboutus-3"
    style={{ "--ui-aboutus-3-background-image": cssValue(`url(${heroImage})`, "backgroundImage") }}
>
    <svg
        viewBox="0 0 700 480"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
    >
        {/* Your existing SVG */}
    </svg>
</div>

                <div className="ui-aboutus-4" >
                    <h1 className="ui-aboutus-5" >About Us</h1>
                    <p className="ui-aboutus-6" >
                        1APP is a technology-driven platform that connects you with trusted professionals for all your home, workspace, health, fitness, education and beauty needs — from cleaning and repairs to salon and spa services.
                    </p>
                    <p className="ui-aboutus-7" >
                        We're simplifying your living by ensuring reliable, high-quality and transparent services, every single time.
                    </p>
                </div>
            </div>



            {/* ── Our Ecosystem ── */}
            <div className="ui-aboutus-8" >
                <div className="ui-aboutus-9" >
                    <div className="ui-aboutus-10" >
                        <div className="ui-aboutus-11"  />
                        <h2 className="ui-aboutus-12" >Our Ecosystem</h2>
                    </div>
                    <div className="ui-aboutus-13" >
                        {ECOSYSTEM.map((item, i) => (
                            <div className="ui-aboutus-14" key={i} >
                                <div className="ui-aboutus-15" >{item.icon}</div>
                                <div className="ui-aboutus-16" >{item.title}</div>
                                <div className="ui-aboutus-17" >{item.desc}</div>
                                <div className="ui-aboutus-18"
                                    onClick={() => navigate(`/services?search=${encodeURIComponent(item.title)}`)}



                                >
                                    Explore <FaArrowRight size={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Building The Future ── */}
            <div className="ui-aboutus-19" >
                <div className="ui-aboutus-20" >
                    <h2 className="ui-aboutus-21" >Building The Future Of Services</h2>
                    <div className="ui-aboutus-22" >
                        {VALUES.map((v, i) => (
                            <div className="ui-aboutus-23" key={i} >
                                <div className="ui-aboutus-24" >{v.icon}</div>
                                <div className="ui-aboutus-25" >{v.title}</div>
                                <div className="ui-aboutus-26" >{v.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── How It Works ── */}
            <div className="ui-aboutus-27" >
                <div className="ui-aboutus-28" >
                    <h2 className="ui-aboutus-29" >How It Works</h2>
                    <div className="ui-aboutus-30" >
                        {/* Connecting line */}
                        <div className="ui-aboutus-31"  />
                        {HOW_IT_WORKS.map((step, i) => (
                            <div className="ui-aboutus-32" key={i} >
                                <div className="ui-aboutus-33" >
                                    {step.icon}
                                </div>
                                <div className="ui-aboutus-34" >{step.title}</div>
                                <div className="ui-aboutus-35" >{step.sub}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Core Values ── */}
            <div className="ui-aboutus-36" >
                <div className="ui-aboutus-37" >
                    <div>
                        <h2 className="ui-aboutus-38" >Our Core Values</h2>
                        {CORE_VALUES.map((v, i) => (
                            <div className="ui-aboutus-39" key={i} >
                                <div className="ui-aboutus-40" >
                                    {v.icon}
                                </div>
                                <div>
                                    <div className="ui-aboutus-41" >{v.title}</div>
                                    <div className="ui-aboutus-42" >{v.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Photo */}
                    <div className="ui-aboutus-43" >
                        <img className="ui-aboutus-44"
                            src={technicianImage}
                            alt="1App service professional"

                        />
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
            <div className="ui-aboutus-45" >
                <div className="ui-aboutus-46" >
                    <div className="ui-aboutus-47" >
                        {CTA.map((c, i) => (
                            <div className="ui-aboutus-48" key={i} style={{ "--ui-aboutus-48-background": cssValue(c.dark ? "var(--ui-color-5)" : "var(--ui-color-272)", "background") }}>
                                <div className="ui-aboutus-49" style={{ "--ui-aboutus-49-color": cssValue(c.dark ? "var(--ui-color-2)" : "var(--ui-color-5)", "color") }}>{c.title}</div>
                                <div className="ui-aboutus-50" style={{ "--ui-aboutus-50-color": cssValue(c.dark ? "var(--ui-color-19)" : "var(--ui-color-41)", "color") }}>{c.desc}</div>
                                <button className="ui-aboutus-51" >
                                    {c.btn}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Tagline Banner ── */}
            <div className="ui-aboutus-52" >
                <div className="ui-aboutus-53" >
                    We're just getting started.
                </div>
                <div className="ui-aboutus-54" >
                    BUILDING INDIA'S MOST CONNECTED SERVICE ECOSYSTEM.
                </div>
            </div>

        </div>
    );
}
