import { cssValue } from '../utils/cssValue';
import '../styles/TermsAndConditions.css';
import React, { useState, useEffect, useRef } from 'react';
import '../styles/PrivacyPolicy.css';

const TERMS_TEXT = `1App ("1App", "we", "us", or "our") provides a mobile application and website that allows customers to discover, book, manage, and pay for technology-related services and support (the "Services"). These Terms and Conditions ("Terms") govern your access to and use of the 1App application, website, and associated services.

By creating an account or using the Services, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy, as updated from time to time.

**1. ACCEPTANCE OF TERMS**

These Terms form a legally binding agreement between you and 1App.

By accessing or using the Services, you represent that you are at least 18 years of age, have full legal capacity to enter into this agreement, and are authorized to act on behalf of any entity for which you are using the Services.

If you do not agree to these Terms, you must not use the Services.

**2. PLATFORM DESCRIPTION**

1App operates as a technology marketplace that connects customers with service professionals and support providers.

The platform may facilitate booking, scheduling, technician assignment, customer support, payment processing, communication, service updates, and related administrative services.

1App does not itself provide all services listed through the platform. Service professionals and support providers are independent parties and are solely responsible for the quality, safety, and completion of the services they provide.

**3. ACCOUNT REGISTRATION**

To use certain features of the platform, you may need to create an account.

You agree to provide accurate, current, and complete information during registration and to update that information promptly when it changes.

You are responsible for safeguarding your account credentials and for all activity that occurs through your account, whether or not authorized by you.

We reserve the right to suspend or terminate accounts that are inaccurate, fraudulent, abusive, or otherwise in violation of these Terms.

**4. BOOKINGS AND APPOINTMENTS**

You may request services through the platform by selecting a service, time, date, location, and any relevant requirements.

1App will attempt to match your request with an available service professional or provider. Availability is subject to the service provider's schedule, location, and operational constraints.

Once a booking is accepted or confirmed, the booking becomes subject to the applicable service terms, payment requirements, and scheduling conditions.

You agree to provide accurate service details, access information, and any required instructions that may affect the service.

**5. PRICING, FEES, AND PAYMENT**

The price of services, charges, and fees may be displayed on the platform before confirmation of a booking.

You agree to pay all amounts due for the services selected, including applicable taxes, service charges, or additional fees communicated at the time of booking or service completion.

Payments may be processed through authorized payment methods supported by 1App, including card payments or other approved methods. Payment processing may involve third-party providers.

If a payment fails, is disputed, or is otherwise not processed, 1App may suspend or cancel the related service request until the issue is resolved.

**6. CANCELLATIONS, RESCHEDULING, AND REFUNDS**

Cancellations or rescheduling may be subject to the platform's cancellation policy, the service provider's terms, and the timing of the request.

If a booking is cancelled before confirmation or within the applicable free cancellation window, the amount charged may be refunded or reversed in accordance with the policy presented at the time of booking.

Refunds, credits, or adjustments for completed services are determined based on the circumstances of the service, the applicable policy, and any dispute resolution process available through the platform.

**7. SERVICE STANDARDS AND PROFESSIONAL RESPONSIBILITIES**

Service providers are responsible for the services they provide and must comply with applicable laws, professional standards, and platform requirements.

You agree to treat service professionals respectfully and to provide a safe and suitable environment for the service to be completed.

If a service is not performed as described, is delayed materially, or fails to meet agreed standards, you may submit a complaint or request support through the platform.

1App may review disputes and determine reasonable remedies, but 1App does not guarantee the outcome of any service provider's work.

**8. CUSTOMER CONDUCT**

You agree not to use the Services for unlawful, abusive, fraudulent, or harmful purposes.

You must not harass, threaten, discriminate against, or otherwise mistreat service professionals, other customers, or 1App staff.

You agree not to interfere with the operation of the platform, attempt to bypass restrictions, or misuse communication features, support channels, or payment systems.

**9. USER CONTENT AND COMMUNICATIONS**

You may submit reviews, feedback, chat messages, photos, support requests, or other content through the platform.

You represent that any content you provide is accurate, lawful, and does not infringe the rights of others.

You grant 1App a non-exclusive, worldwide, royalty-free license to use, store, process, display, and communicate content that is necessary to provide the Services and improve the platform.

1App may moderate, review, store, or remove content that violates these Terms, applicable law, or the platform's policies.

**10. LOCATION, DEVICE, AND ACCESS PERMISSIONS**

Certain features may require access to device hardware or location information, including your location, camera, microphone, photo files, or notifications.

By enabling the relevant permissions, you consent to the use of such features as necessary to provide the requested service, support experience, or booking process.

You acknowledge that disabling required permissions may prevent certain platform features from working correctly.

**11. INTELLECTUAL PROPERTY**

All content, branding, software, design, features, and materials used in or related to the platform are the property of 1App or its licensors.

You may not reproduce, distribute, modify, reverse engineer, or commercially exploit the platform or any content without prior written permission.

**12. PRIVACY AND DATA USE**

Your use of the Services is also governed by our Privacy Policy.

We may collect, process, and share personal information for account management, service execution, support, payment verification, fraud prevention, communication, analytics, and compliance with applicable law.

By using the Services, you consent to the collection, use, and disclosure of your information as described in the Privacy Policy.

**13. LIMITATION OF LIABILITY**

To the maximum extent permitted by applicable law, 1App shall not be liable for indirect, incidental, special, consequential, or punitive damages arising out of or relating to the use of the Services.

1App does not guarantee uninterrupted availability, error-free operation, or the completion of any service by a third-party provider.

Our total liability for any claim arising from the Services shall not exceed the amount actually paid by you to 1App for the relevant service, if any.

**14. INDEMNIFICATION**

You agree to indemnify and hold harmless 1App, its affiliates, officers, directors, employees, and agents from any claims, damages, liabilities, losses, or expenses arising out of your use of the Services, your violation of these Terms, or your infringement of any third-party rights.

**15. TERM AND TERMINATION**

These Terms remain in effect until terminated.

1App may suspend or terminate your access to the Services at any time if you breach these Terms, fail to pay amounts due, engage in fraudulent activity, or otherwise create legal, operational, or security risk.

Upon termination, your right to use the Services will end immediately, although any obligations that survive termination will continue to apply.

**16. DISPUTE RESOLUTION AND GOVERNING LAW**

These Terms are governed by the laws of the Republic of India, without regard to conflict-of-law principles.

Any disputes arising out of or relating to these Terms or the Services shall first be attempted to be resolved amicably through the support and communication channels available on the platform.

If a dispute cannot be resolved informally, it shall be subject to the exclusive jurisdiction of the competent courts located in New Delhi, India.

**17. GRIEVANCE REDRESSAL**

If you have questions, complaints, or concerns regarding the Services or these Terms, you may contact us through the support channels available in the application or through the official support contact listed on the platform.

We will make reasonable efforts to address your concern promptly and in accordance with applicable law.

**18. MISCELLANEOUS**

These Terms, together with the Privacy Policy and any supplemental policies, constitute the entire agreement between you and 1App regarding your use of the Services.

If any provision of these Terms is found to be invalid, unenforceable, or illegal, the remaining provisions shall remain in full force and effect.

1App may revise these Terms from time to time. The most recent version will be posted on the platform and will be effective as of the date of publication.

By continuing to use the Services after changes are made, you agree to the updated Terms.`;

const firstSectionIndex = TERMS_TEXT.indexOf('**1. ACCEPTANCE OF TERMS');
const INTRO = TERMS_TEXT.slice(0, firstSectionIndex).trim();
const SECTIONS = TERMS_TEXT.slice(firstSectionIndex).split(/(?=^\*\*\d+\. )/m).map(section => {
    const [heading, ...body] = section.split('\n');
    const title = heading.replace(/^\*\*|\*\*$/g, '');
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { id, title, content: body.join('\n').trim() };
});

const renderInline = (text) => text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a className="ui-termsandconditions-1" key={index} href={link[2]} target="_blank" rel="noreferrer" >{link[1]}</a>;
    return part;
});

const renderParagraphs = (content, className) => content.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
    <p className={`ui-termsandconditions-2 ${className}`} key={index}>{renderInline(paragraph)}</p>
));

export default function TermsAndConditions() {
    const [active, setActive] = useState(SECTIONS[0]?.id || '');
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
        <div className="privacy-policy-layout ui-termsandconditions-3" >
            <div className="privacy-policy-content">
                <h1 className="ui-termsandconditions-4" >Terms & Conditions</h1>
                <p className="ui-termsandconditions-5" >Last updated: October 2, 2026</p>
                {renderParagraphs(INTRO, 'legal-intro-paragraph')}

                {SECTIONS.map(sec => (
                    <div className="ui-termsandconditions-6" key={sec.id} id={sec.id} ref={el => sectionRefs.current[sec.id] = el} >
                        <h2 className="ui-termsandconditions-7" >{sec.title}</h2>
                        {renderParagraphs(sec.content, 'legal-section-paragraph')}
                    </div>
                ))}
            </div>

            <div className="privacy-policy-toc">
                <div className="ui-termsandconditions-8" >
                    <div className="ui-termsandconditions-9" >TERMS & CONDITIONS</div>
                    {SECTIONS.map(sec => (
                        <div className="ui-termsandconditions-10" key={sec.id} onClick={() => scrollTo(sec.id)}
                            style={{ "--ui-termsandconditions-10-color": cssValue(active === sec.id ? "var(--ui-color-27)" : "var(--ui-color-34)", "color"), "--ui-termsandconditions-10-font-weight": cssValue(active === sec.id ? 700 : 400, "fontWeight"), "--ui-termsandconditions-10-border-left": cssValue(active === sec.id ? '2px solid #000000' : '2px solid transparent', "borderLeft") }}>
                            {sec.title}
                        </div>
                    ))}
                </div>
                <div className="ui-termsandconditions-11" >
                    <p className="ui-termsandconditions-12" >Need help?</p>
                    <p className="ui-termsandconditions-13" >If you have any questions about these Terms, please contact us.</p>
                    <a className="ui-termsandconditions-14" href="/contact" >Contact Support</a>
                </div>
            </div>
        </div>
    );
}
