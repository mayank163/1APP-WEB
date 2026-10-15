import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/LegalDocument.css';

export default function LegalDocument({ title, sections, intro, renderParagraphs }) {
    const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
    const [expanded, setExpanded] = useState(() => new Set(sections.slice(0, 2).map(section => section.id)));
    const [active, setActive] = useState(sections[0]?.id);
    const sectionRefs = useRef({});

    useEffect(() => {
        const media = window.matchMedia('(max-width: 760px)');
        const update = () => setMobile(media.matches);
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
        }, { rootMargin: '-15% 0px -65% 0px' });
        Object.values(sectionRefs.current).forEach(element => element && observer.observe(element));
        return () => observer.disconnect();
    }, [sections]);

    const jumpTo = id => {
        setExpanded(previous => new Set([...previous, id]));
        setActive(id);
        requestAnimationFrame(() => sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };

    const supportCard = (
        <aside className="legal-support">
            <span className="legal-support-icon" aria-hidden="true">?</span>
            <h2>Need help?</h2>
            <p>If you have any questions about {title === 'Privacy Policy' ? 'this Privacy Policy' : 'these Terms'}, please contact us.</p>
            <Link to="/contact">Contact Support</Link>
        </aside>
    );

    return (
        <div className="legal-document">
            <nav className="legal-mobile-jump" aria-label={`${title} sections`}>
                <span>Jump to:</span>
                <div>
                    {sections.map(section => <button key={section.id} aria-current={active === section.id ? 'location' : undefined} onClick={() => jumpTo(section.id)}>{section.title}</button>)}
                </div>
            </nav>
            <article className="legal-document-content">
                <header className="legal-document-header">
                    <h1>{title}</h1>
                    <p>Last updated: October 2, 2026</p>
                </header>
                <div className="legal-document-intro">{renderParagraphs(intro, 'legal-intro-paragraph')}</div>
                <p className="legal-reading-note">Please refer to Section 1 to understand how {title === 'Privacy Policy' ? 'this Policy applies to you' : 'these Terms apply to you'}.</p>
                {sections.map((section, index) => (
                    <React.Fragment key={section.id}>
                        <section className="legal-document-section" id={section.id} ref={element => { sectionRefs.current[section.id] = element; }}>
                            <h2>
                                <button className="legal-section-toggle" aria-expanded={!mobile || expanded.has(section.id)} aria-controls={`${section.id}-body`} onClick={() => {
                                    if (!mobile) return;
                                    setExpanded(previous => {
                                        const next = new Set(previous);
                                        if (next.has(section.id)) next.delete(section.id);
                                        else next.add(section.id);
                                        return next;
                                    });
                                }}>{section.title}<span aria-hidden="true">{expanded.has(section.id) ? '−' : '+'}</span></button>
                            </h2>
                            <div id={`${section.id}-body`} hidden={mobile && !expanded.has(section.id)}>
                                {renderParagraphs(section.content, 'legal-section-paragraph')}
                            </div>
                            {mobile && !expanded.has(section.id) && <p className="legal-section-preview">{section.content.replace(/\*\*/g, '').split(/\n\s*\n/)[0]}</p>}
                        </section>
                        {index === 1 && <div className="legal-mobile-support">{supportCard}</div>}
                    </React.Fragment>
                ))}
            </article>
            <aside className="legal-document-sidebar">
                <nav aria-label={`${title} table of contents`}>
                    <h2>{title}</h2>
                    {sections.map(section => <button key={section.id} aria-current={active === section.id ? 'location' : undefined} onClick={() => jumpTo(section.id)}>{section.title}</button>)}
                </nav>
                {supportCard}
            </aside>
        </div>
    );
}
