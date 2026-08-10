import React, { useState, useEffect, useRef } from 'react';

const SECTIONS = [
    { id: 'services', title: '1. SERVICES', content: `(a) The Services include the provision of the Platform that enables you to arrange and schedule different home-based services with independent third-party service providers of those services ("Service Professionals"). As a part of the Services, 1APP facilitates the transfer of payments to Service Professionals for the services they render to you and collects payments on behalf of such Service Professionals.\n\n(b) The services rendered by Service Professionals are referred to as "Pro Services". The term "Services" does not include the Pro Services. 1APP does not provide the Pro Services. Unless expressly stated otherwise, Service Professionals are solely liable and responsible for the Pro Services that they offer or otherwise provide through the Platform. 1APP and its affiliates do not provide the Pro Services. Service Professionals are not employees of 1APP or its affiliates. Service Professionals are not the agents, contractors, or partners of 1APP or its affiliates. Service Professionals do not have the authority to bind or represent 1APP.\n\n(c) The Platform is for your personal and non-commercial use only, unless otherwise agreed upon us in accordance with the terms of a separate agreement. Please note that the Platform is intended for use only within India. You agree that if you install the app/use the Services on the Platform from a legal jurisdiction other than the territory of India, you will be deemed to have accepted the net terms and conditions applicable in that jurisdiction.\n\n(d) The Services are made available under various brands owned by or otherwise licensed to 1APP and its affiliates.\n\n(e) A key part of the Services is 1APP's ability to send you text messages, electronic mails, or WhatsApp messages, including in connection with your bookings, your utilization of the Services, or as a part of its promotional and marketing strategies. While you may opt out of receiving these text messages by contacting us at privacy@1app.com or through the in-Platform settings, you agree and acknowledge that this may impact 1APP's ability to provide the Services (or a part of the Services) to you.\n\n(f) In certain instances, you may be required to furnish identification proof to avail the Services or the Pro Services, and hereby agree to do so. A failure to comply with this request may result in your inability to use the Services or Pro Services.\n\n(g) 1APP Credits:\n\ni. 1APP may, in its sole discretion, offer promotional codes that may be redeemed for credits, other features, or benefits related to the Services, and/or Pro Services, subject to any additional terms that 1APP may apply on a promotional order ("1APP Credits").\n\nii. You agree that (i) you shall use 1APP Credits in a lawful manner, and only for the purposes specified by such 1APP Credits, (ii) you shall not duplicate, sell, or transfer the 1APP Credits in any manner (including by posting such codes on a public forum) unless you have 1APP's express prior consent to do so, (iii) 1APP Credits may be disabled by 1APP at any time for any reason without any liability to 1APP, (iv) 1APP Credits are not valid for cash, and (v) 1APP Credits may expire prior to your use.` },
    { id: 'account', title: '2. ACCOUNT CREATION', content: `(a) To avail the Services, you will be required to create an account on the Platform ("Account"). For this Account, you may be required to furnish certain details, including but not limited to your phone number. To create an Account, you must be at least 18 years of age.\n\n(b) You warrant that all information furnished in connection with your Account is and shall remain accurate and true. You agree to promptly update your details on the Platform in the event of any change to or modification of this information.\n\n(c) You are solely responsible for maintaining the security and confidentiality of your Account and agree to immediately notify us of any disclosure or unauthorised use of your Account or any other breach of security with respect to your Account.\n\n(d) You are liable and accountable for all activities that take place through your Account, including activities performed by persons other than you. We shall not be liable for any unauthorised access to your Account.` },
    { id: 'user-content', title: '3. USER CONTENT', content: `(a) Our Platform may contain interactive features or services that allow users who have created an Account with us to post, upload, publish, display, transmit, or submit comments, reviews, suggestions, feedback, ideas, or other content on or through the Platform ("User Content").\n\n(b) As part of the effective provision of the Services and quality control purposes, we may request reviews from you about Service Professionals and you agree and acknowledge that Service Professionals may provide reviews about you to us. You must not knowingly provide false, inaccurate, or misleading information in respect of the reviews. Reviews will be used by us for quality control purposes and to determine whether Customers and Service Professionals are appropriate users of the Platform.\n\n(c) You grant us a non-exclusive, worldwide, perpetual, irrevocable, transferable, sublicensable, and royalty-free licence to (i) use, publish, display, store, host, transfer, process, communicate, distribute, make available, modify, adapt, translate, and create derivative works of, the User Content, for the functioning of, and in connection with, the Services and (ii) use the User Content for the purposes of advertising and promoting the Services, or furnishing evidence before a court or authority of competent jurisdiction under applicable laws.` },
    { id: 'consent', title: '4. CONSENT TO USE DATA', content: `(a) You agree that we may, in accordance with our Privacy Policy, collect and use your personal data. The Privacy Policy is available at https://1app.com/privacy-policy and it explains the categories of personal data that we collect or otherwise process about you and the manner in which we process such data.\n\n(b) In addition to any consent you may provide pursuant to the Privacy Policy, you hereby consent to us sharing your information with our affiliates or other third-party service providers. We may use information and data pertaining to your use of the Services for provision of the Services, analytics, trend identification, and purposes of statistics to further enhance the effectiveness and efficiency of our Services, and provision of beneficial proposals, and other services by us or any third parties.` },
    { id: 'bookings', title: '5. BOOKINGS', content: `(a) Orders: The Platform permits you to request various Pro Services at a time of your choosing based on availability. To make a booking, you should follow the instructions on the Platform and provide necessary information. We will make reasonable efforts to find a Service Professional who is able to provide your chosen service at the requested time.\n\n(b) Confirmation: Once you place a request we will provide confirmation of the booking via SMS, email, or a push notification. Once your booking has been confirmed, you will be required to make the payment in accordance with these Terms or as indicated on the Platform.\n\n(c) Cancellations: Bookings that are cancelled before confirmation on the Platform will not be charged, or in conditions as per the applicable cancellation policy.` },
    { id: 'pricing', title: '6. PRICING, FEES, AND PAYMENT TERMS', content: `(a) 1APP reserves the right to charge you for the different Services you may avail and/or for any other facilities you may use on, from time to time, on or via the Platform.\n\n(b) Charges and Fees in respect of Pro Services:\n\ni. In respect of Pro Services that you seek to avail through the Platform, you shall be required to pay Service Professionals the amount indicated on the Platform as well as upfront amounts towards (a) any additional Pro Services you may avail, (b) out-of-pocket expenses incurred by the Service Professional, and (c) expenses arising out of the purchase of goods required to provide the Pro Services ("Charges").\n\nii. 1APP shall notify you of the applicable Charges, Fees, and payment methods at the time of booking. Generally, you may make payments for Pro Services through credit cards, debit cards, net banking, wallets, UPI or COD.` },
    { id: 'conduct', title: '7. CUSTOMER CONDUCT', content: `1APP prohibits discrimination against Service Professionals on the basis of race, religion, caste, national origin, disability, sexual orientation, sex, marital status, gender identity, age or any other characteristic that may be protected under applicable law. You agree to treat Service Professionals with courtesy and respect.` },
    { id: 'third-party', title: '8. THIRD PARTY SERVICES', content: `The Platform may include services, content, documents, and information owned by, licensed to, or otherwise made available by a third party ("Third Party Services") or contain links to Third Party Services.` },
    { id: 'responsibilities', title: '9. YOUR RESPONSIBILITIES', content: `You are responsible for ensuring that your use of the Platform and the Services complies with all applicable laws and regulations. You agree not to misuse the Platform or help anyone else do so.` },
    { id: 'ip', title: '10. OUR INTELLECTUAL PROPERTY', content: `All intellectual property rights in the Platform and the Services are owned by or licensed to 1APP. You may not use our intellectual property without our prior written consent.` },
    { id: 'termination', title: '11. TERM AND TERMINATION', content: `These Terms shall remain in effect until terminated. 1APP may terminate or suspend your access to the Platform at any time, with or without cause, with or without notice.` },
    { id: 'disclaimers', title: '12. DISCLAIMERS AND WARRANTIES', content: `The Platform and Services are provided on an "as is" and "as available" basis without any warranties of any kind, either express or implied.` },
    { id: 'indemnity', title: '13. INDEMNITY', content: `You agree to indemnify and hold harmless 1APP and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising out of your use of the Platform or violation of these Terms.` },
    { id: 'jurisdiction', title: '14. JURISDICTION AND DISPUTE RESOLUTION', content: `These Terms shall be governed by the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.` },
    { id: 'grievance', title: '15. GRIEVANCE REDRESSAL', content: `If you have any grievances regarding the Services, you may contact our Grievance Officer at grievance@1appcompany.com. We will endeavour to resolve your grievance within 30 days of receipt.` },
    { id: 'miscellaneous', title: '16. MISCELLANEOUS PROVISIONS', content: `These Terms constitute the entire agreement between you and 1APP with respect to the subject matter hereof. If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.` },
];

export default function TermsAndConditions() {
    const [active, setActive] = useState('services');
    const sectionRefs = useRef({});

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
            { rootMargin: '-20% 0px -70% 0px' }
        );
        Object.values(sectionRefs.current).forEach(el => el && observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const scrollTo = (id) => {
        sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 40, alignItems: 'start' }}>

            {/* Left: Content */}
            <div>
                <h1 style={{ fontWeight: 900, fontSize: '2rem', marginBottom: 6 }}>TERMS AND CONDITIONS</h1>
                <p style={{ color: '#888', fontStyle: 'italic', marginBottom: 24 }}>Last Updated: 11th April, 2023</p>

                <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 16 }}>
                    These terms and conditions ("Terms") govern the use of software made available on or through, and/or services provided by, 1APP Company (the "Company", "we", "us", or "1APP"), including the "Platform" and various sub-services made available on or through the Platform. The "Services", These Terms also include our privacy policy available at{' '}
                    <a href="/privacy-policy" style={{ color: '#000000' }}>https://1app.com/privacy-policy</a>{' '}
                    ("Privacy Policy"), and any guidelines, additional, or supplemental terms, policies, and disclaimers made available or issued by us from time to time ("Supplemental Terms"). The Privacy Policy and the Supplemental Terms form an integral part of these Terms. In the event of a conflict between these Terms and the Privacy Policy or the Supplemental Terms, the Privacy Policy or the Supplemental Terms shall prevail.
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 16 }}>
                    The Terms constitute a binding and enforceable legal contract between 1APP Company (indeed, a company incorporated under the Companies Act, 2013 with its registered address at Unit No. 101, Ground Floor, Splendor Forum, Plot No. 3, Jasola District Centre, New Delhi - 110025, India) and its group of firms or its affiliates (the "1APP", "we", "us", or "our") and you, a user of the Services, or any legal entity that access the Services (defined below) on behalf of such user ("you" or "Customer"). By using the Services, you represent and warrant that you have full legal capacity and authority to agree to and bind yourself to these Terms.
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 32 }}>
                    By using the Services, you agree that you have read, understood, and are bound by, these Terms, as amended from time to time, and that you will comply with the requirements listed here. These Terms expressly supersede any prior written agreements with you. If you do not agree to these Terms, or comply with the requirements listed here, please do not use the Services.
                </p>

                {SECTIONS.map(sec => (
                    <div key={sec.id} id={sec.id} ref={el => sectionRefs.current[sec.id] = el} style={{ marginBottom: 36 }}>
                        <h2 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 12 }}>{sec.title}</h2>
                        {sec.content.split('\n\n').map((para, i) => (
                            <p key={i} style={{ fontSize: '14px', lineHeight: 1.8, color: '#333', marginBottom: 12 }}>{para}</p>
                        ))}
                    </div>
                ))}
            </div>

            {/* Right: Sticky TOC */}
            <div style={{ position: 'sticky', top: 80 }}>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#888', marginBottom: 14 }}>TERMS AND CONDITIONS</div>
                    {SECTIONS.map(sec => (
                        <div key={sec.id}
                            onClick={() => scrollTo(sec.id)}
                            style={{ fontSize: '13px', padding: '6px 0', cursor: 'pointer', color: active === sec.id ? '#000000' : '#444', fontWeight: active === sec.id ? 700 : 400, borderLeft: active === sec.id ? '2px solid #000000' : '2px solid transparent', paddingLeft: 10, marginBottom: 2 }}>
                            {sec.title}
                        </div>
                    ))}
                </div>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px' }}>
                    <p style={{ fontSize: '13px', color: '#555', marginBottom: 14 }}>Need help understanding our terms? Our support team is available 24/7.</p>
                    <a href="/contact" style={{ display: 'block', background: '#000000', color: '#fff', textAlign: 'center', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>Contact Support</a>
                </div>
            </div>
        </div>
    );
}
