import React, { useState, useEffect, useRef } from 'react';

const SECTIONS = [
    {
        id: 'background', title: '1. BACKGROUND AND KEY INFORMATION', content: `(a) How this Policy applies:\nThis Policy applies to individuals who access or use the Services or otherwise avail the Professional Services. For the avoidance of doubt, references to "you" across this Policy are to an end-user that uses the Platform.\n\nBy using the Platform, you consent to the collection, storage, usage, and disclosure of your personal data, as described in and collected by us in accordance with this Policy.\n\n(b) Review and Updates:\nWe regularly review and update our Privacy Policy, and we request you to regularly review this Policy. It is important that the personal data we hold about you is accurate and current. Please let us know if your personal data changes during your relationship with us.\n\n(c) Third-Party Services:\nThe Platform may include links to third-party websites, plug-ins, services, and applications ("Third-Party Services"). Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We neither control nor endorse these Third-Party Services and are not responsible for their privacy statements.`
    },
    {
        id: 'personal-data', title: '2. PERSONAL DATA THAT WE COLLECT', content: `(a) We collect different types of personal data about you. This includes, but is not limited to:\n\n(i) Contact Data, such as your mailing or home address, location, email addresses, and mobile numbers.\n\n(ii) Identity and Profile Data, such as your name, username or similar identifiers, photographs, and gender.\n\n(iii) Marketing and Communications Data, such as your address, email address, information posted in service requests, offers, wants, feedback, comments, pictures and discussions in our blog and chat boxes, responses to user surveys and polls, your preferences in receiving marketing communications from us and our third parties, and your communication preferences.\n\n(iv) Technical Data, which includes your IP address, browser type, internet service provider, details of operating system, access time, page views, device ID, device type, frequency of visiting our website and use of the Platform, website and mobile application activity, clicks, date and time stamps, location data, and other technology on the devices that you use to access the Platform.\n\n(v) Transaction Data, such as details of the Services or Professional Services you have availed, a limited portion of your credit or debit card details for tracking transactions that are provided to us by payment processors, and UPI IDs for processing payments.\n\n(vi) Usage Data, which includes information about how you use the Services and Professional Services, your activity on the Platform, booking history, user taps and clicks, user interests, time spent on the Platform, details about user journey on the mobile application, and page views.\n\n(vii) ONLY for Native Smart Lock users, information such as images of unlock events, alarm triggers and breach alerts, user unlock history, user-defined names for registered lock members, unlock methods registered, visitor access codes and general user preferences.\n\nPlease note the biometric data (face, fingerprint etc.) and PINs that are used by you to unlock the Native Smart Locks are stored locally on the device and attached sensors only and are not accessible to us.\n\n(b) We also collect, use, and share aggregated data such as statistical or demographic data for any purpose.`
    },
    {
        id: 'collect', title: '3. HOW DO WE COLLECT PERSONAL DATA?', content: `We use different methods to collect personal data from and about you including through:\n\n(a) Direct Interactions. You provide us your personal data when you interact with us. This includes personal data you provide when you:\n(i) create an account or profile with us;\n(ii) use our Services or carry out other activities in connection with the Services;\n(iii) install and use the Native Smart Lock device;\n(iv) enter a promotion, user poll, or online surveys;\n(v) request marketing communications to be sent to you; or\n(vi) report a problem with the Platform and/or our Services, give us feedback or contact us.\n\n(b) Automated technologies or interactions. Each time you visit the Platform or use the Services, we will automatically collect Technical Data about your equipment, browsing actions, and patterns. We collect this personal data by using cookies, web beacons, pixel tags, server logs, and other similar technologies.`
    },
    {
        id: 'use', title: '4. HOW DO WE USE YOUR PERSONAL DATA?', content: `(a) We will only use your personal data when the law allows us to. Most commonly, we will use your personal data where we need to provide you with the Services, enable you to use Professional Services, or where we need to comply with a legal obligation. We use your personal data for the following purposes:\n\n(i) to verify your identity to register you as a user, and create your account with us on the Platform;\n(ii) to provide the Services to you;\n(iii) to enable the provision of Professional Services to you;\n(iv) to monitor trends and personalise your experience;\n(v) to improve the functionality of our Services based on the information and feedback we receive from you;\n(vi) to improve customer service to effectively respond to your Service requests and support needs;\n(vii) to track transactions and process payments;\n(viii) to send periodic notifications to manage our relationship with you;\n(ix) to assist with the facilitation of the Professional Services offered to you;\n(x) to market and advertise the Services to you;\n(xi) to comply with legal obligations;\n(xii) to administer and protect our business and the Services;\n(xiii) to improve our business and delivery models;\n(xiv) to perform our obligations that arise out of the arrangement we are about to enter or have entered with you;\n(xv) to enforce our Terms; and\n(xvi) to respond to court orders, establish or exercise our legal rights, or defend ourselves against legal claims.`
    },
    { id: 'cookies', title: '5. COOKIES', content: `(a) Cookies are small files that a site or its service provider transfers to your device's hard drive through your web browser (if you allow) that enables the sites' or service providers' systems to recognise your browser and capture and remember certain information.\n\n(b) We use cookies to help us distinguish you from other users of the Platform, understand and save your preferences for future visits, keep track of advertisements and compile aggregate data about Platform traffic and interaction so that we can offer you a seamless user experience.` },
    { id: 'disclosures', title: '6. DISCLOSURES OF YOUR PERSONAL DATA', content: `(a) We may share your personal data with third parties set out below for the purposes set out in Section 4:\n\n(i) Service professionals to enable them to provide you with Professional Services;\n(ii) Internal third parties, which are other companies within the 1APP Company group of companies.\n(iii) External third parties such as trusted third parties including our associate partners, and service providers that provide services for us or on our behalf.` },
    { id: 'rights', title: '7. YOUR RIGHTS IN RELATION TO YOUR PERSONAL DATA', content: `You have the right to access, correct, or delete your personal data. You may also object to or restrict certain processing of your personal data. To exercise these rights, please contact us at privacy@1appcompany.com.` },
    { id: 'deletion', title: '8. DELETION OF ACCOUNT AND PERSONAL DATA', content: `You may request deletion of your account and personal data by contacting us. We will process your request in accordance with applicable laws and our data retention policies.` },
];

const COUNTRIES = ['INDIA', 'USA', 'SINGAPORE', 'UAE'];
const LANGUAGES = ['English', 'हिन्दी', 'தமிழ்', 'తెలుగు'];

export default function PrivacyPolicy() {
    const [active, setActive] = useState('background');
    const [activeCountry, setActiveCountry] = useState('INDIA');
    const [activeLang, setActiveLang] = useState('English');
    const sectionRefs = useRef({});

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
            { rootMargin: '-20% 0px -70% 0px' }
        );
        Object.values(sectionRefs.current).forEach(el => el && observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const scrollTo = (id) => sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px', display: 'grid', gridTemplateColumns: '160px 1fr 260px', gap: 32, alignItems: 'start' }}>

            {/* Left: Country + Language */}
            <div style={{ position: 'sticky', top: 80 }}>
                <div style={{ marginBottom: 24 }}>
                    {/* <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#888', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🌐</span> COUNTRIES
                    </div> */}
                    {/* {COUNTRIES.map(c => (
                        <div key={c} onClick={() => setActiveCountry(c)}
                            style={{ fontSize: '13px', padding: '4px 0', cursor: 'pointer', color: activeCountry === c ? '#111' : '#666', fontWeight: activeCountry === c ? 700 : 400 }}>
                            {c}
                        </div>
                    ))} */}
                </div>
                <div>
                    {/* <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#888', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🔤</span> LANGUAGE
                    </div> */}
                    {/* {LANGUAGES.map(l => (
                        <div key={l} onClick={() => setActiveLang(l)}
                            style={{ fontSize: '13px', padding: '4px 0', cursor: 'pointer', color: activeLang === l ? '#000000' : '#666', fontWeight: activeLang === l ? 700 : 400 }}>
                            {l}
                        </div>
                    ))} */}
                </div>
            </div>

            {/* Center: Content */}
            <div>
                <h1 style={{ fontWeight: 800, fontSize: '1.8rem', marginBottom: 4 }}>Privacy Policy</h1>
                <p style={{ color: '#888', fontStyle: 'italic', marginBottom: 24, fontSize: '14px' }}>Last updated: 2nd March 2026</p>

                <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 12 }}>
                    Welcome to 1APP Company's privacy policy ("Privacy Policy" or "Policy").
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 12 }}>
                    <strong>1APP Company Limited</strong> (formerly known as <strong>1App Technologies India Pvt. Ltd.</strong>), and its affiliates (collectively, "1APP Company", "we", "us" or "our") are engaged in the business of providing web-based solutions to facilitate connections between customers that seek specific services and service professionals that offer these services. This Policy outlines our practices in relation to the collection, storage, usage, processing and disclosure of personal data that you have consented to share with us when you access, use, or otherwise interact with our website available at{' '}
                    <a href="https://www.1appcompany.com/" style={{ color: '#000000' }}>https://www.1appcompany.com/</a>{' '}
                    or mobile application "1APP Company" (collectively, "Platform") or avail products or services that 1APP Company offers you on or through the Platform (collectively, the "Services"). In this Policy, the services offered to you by service professionals on or through the Platform are referred to as "Professional Services".
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 24 }}>
                    Please note that unless specifically defined in this Policy, capitalised terms shall have the same meaning ascribed to them in our Terms and Conditions, available at{' '}
                    <a href="/terms" style={{ color: '#000000' }}>https://www.1appcompany.com/terms</a>{' '}
                    ("Terms"). Please read this Policy in consonance with the Terms.
                </p>

                {SECTIONS.map(sec => (
                    <div key={sec.id} id={sec.id} ref={el => sectionRefs.current[sec.id] = el} style={{ marginBottom: 32 }}>
                        <h2 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 10 }}>{sec.title}</h2>
                        {sec.content.split('\n\n').map((para, i) => (
                            <p key={i} style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 10 }}>{para}</p>
                        ))}
                    </div>
                ))}
            </div>

            {/* Right: Sticky TOC */}
            <div style={{ position: 'sticky', top: 80 }}>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#888', marginBottom: 14 }}>PRIVACY POLICY</div>
                    {SECTIONS.map(sec => (
                        <div key={sec.id} onClick={() => scrollTo(sec.id)}
                            style={{ fontSize: '12px', padding: '5px 0 5px 10px', cursor: 'pointer', color: active === sec.id ? '#000000' : '#444', fontWeight: active === sec.id ? 700 : 400, borderLeft: active === sec.id ? '2px solid #000000' : '2px solid transparent', marginBottom: 2 }}>
                            {sec.title}
                        </div>
                    ))}
                </div>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, marginBottom: 6 }}>Need help?</p>
                    <p style={{ fontSize: '13px', color: '#555', marginBottom: 14 }}>If you have any questions about this Privacy Policy, please contact us.</p>
                    <a href="/contact" style={{ display: 'block', background: '#000000', color: '#fff', textAlign: 'center', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Contact Support</a>
                </div>
            </div>
        </div>
    );
}
