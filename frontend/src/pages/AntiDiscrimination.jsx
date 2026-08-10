import React, { useState } from 'react';

const COUNTRIES = [
    { code: 'IND', flag: '🇮🇳', label: 'India' },
    { code: 'UAE', flag: '🇦🇪', label: 'UAE' },
    { code: 'KSA', flag: '🇸🇦', label: 'Saudi Arabia' },
    { code: 'SGP', flag: '🇸🇬', label: 'Singapore' },
];

const CONTENT = {
    IND: {
        dir: 'ltr',
        title: 'Anti Discrimination Policy',
        heading: 'Anti-Discrimination Policy',
        paragraphs: [
            '1App Company seeks to empower millions of service professionals across the world to deliver safe, reliable and high quality services at home. 1App Company therefore does not tolerate, and prohibits discrimination against customers or service providers based on religion, caste, race, national origin, disability, sexual orientation, sex, marital status, gender identity, age or any other characteristic that may be protected under applicable laws.',
            'Such discrimination includes, but is not limited to, refusing to provide or accept services based on any of these characteristics.',
            'Any customer or service partner found to have violated this prohibition will lose access to the 1App Company platform.',
        ],
    },
    UAE: {
        dir: 'rtl',
        title: 'سياسة مكافحة التمييز',
        heading: 'سياسة مكافحة التمييز',
        paragraphs: [
            'تسعى شركة 1App إلى تمكين ملايين محترفي الخدمات حول العالم من تقديم خدمات آمنة وموثوقة وعالية الجودة في المنازل. لذلك، لا تتسامح شركة 1App مع التمييز ضد العملاء أو مزودي الخدمات بسبب الدين أو الجنس أو العرق أو الأصل الوطني أو الإعاقة أو التوجه الجنسي أو الحالة الاجتماعية أو الهوية الجندرية أو العمر أو أي خاصية أخرى قد تكون محمية بموجب القوانين المعمول بها، وتحظره صراحةً.',
            'يشمل هذا التمييز، على سبيل المثال لا الحصر، رفض تقديم الخدمات أو قبولها استناداً إلى أي من هذه الخصائص.',
            'سيفقد أي عميل أو شريك خدمة يُثبت انتهاكه لهذا الحظر حق الوصول إلى منصة شركة 1App.',
        ],
    },
    KSA: {
        dir: 'rtl',
        title: 'سياسة مكافحة التمييز',
        heading: 'سياسة مكافحة التمييز',
        paragraphs: [
            'تسعى شركة 1App إلى تمكين ملايين محترفي الخدمات في جميع أنحاء العالم لتقديم خدمات آمنة وموثوقة وعالية الجودة في المنازل. وعليه، لا تتسامح شركة 1App مع أي شكل من أشكال التمييز ضد العملاء أو مزودي الخدمات بسبب الدين أو الجنس أو العرق أو الأصل الوطني أو الإعاقة أو التوجه الجنسي أو الحالة الاجتماعية أو الهوية الجندرية أو العمر أو أي خاصية أخرى قد تكون محمية وفقاً للأنظمة والتشريعات المعمول بها في المملكة العربية السعودية، وتحظره صراحةً.',
            'يشمل هذا التمييز، دون حصر، رفض تقديم الخدمات أو قبولها بناءً على أي من هذه الخصائص.',
            'سيُحرم أي عميل أو شريك خدمة تثبت مخالفته لهذا الحظر من الوصول إلى منصة شركة 1App نهائياً.',
        ],
    },
    SGP: {
        dir: 'ltr',
        title: 'Anti Discrimination Policy',
        heading: 'Anti-Discrimination Policy',
        paragraphs: [
            '1App Company seeks to empower millions of service professionals across the world to deliver safe, reliable and high quality services at home. 1App Company therefore does not tolerate, and prohibits discrimination against customers or service providers based on race, religion, nationality, disability, sexual orientation, sex, marital status, gender identity, age or any other characteristic protected under the laws of Singapore, including the Maintenance of Religious Harmony Act and the Employment Act.',
            'Such discrimination includes, but is not limited to, refusing to provide or accept services based on any of these characteristics.',
            'Any customer or service partner found to have violated this prohibition will lose access to the 1App Company platform.',
        ],
    },
};

export default function AntiDiscrimination() {
    const [country, setCountry] = useState('IND');
    const [open, setOpen] = useState(false);
    const selected = COUNTRIES.find(c => c.code === country);
    const content = CONTENT[country];

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px' }}>

                {/* Title card */}
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '40px 32px', textAlign: 'center', marginBottom: 24 }}>
                    <h1 style={{ fontWeight: 800, fontSize: '1.8rem', marginBottom: 20 }}>{content.title}</h1>

                    {/* Country dropdown */}
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                            onClick={() => setOpen(o => !o)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #ddd', borderRadius: 8, padding: '8px 14px', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                        >
                            <span>{selected.flag}</span>
                            <span>{selected.code}</span>
                            <span style={{ fontSize: 10, color: '#888' }}>▼</span>
                        </button>
                        {open && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 160 }}>
                                {COUNTRIES.map(c => (
                                    <div key={c.code}
                                        onClick={() => { setCountry(c.code); setOpen(false); }}
                                        style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8, background: c.code === country ? '#f5f5f5' : '#fff' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                                        onMouseLeave={e => e.currentTarget.style.background = c.code === country ? '#f5f5f5' : '#fff'}
                                    >
                                        <span>{c.flag}</span>
                                        <span style={{ fontWeight: c.code === country ? 700 : 400 }}>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Policy content card */}
                <div
                    style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '32px', direction: content.dir, textAlign: content.dir === 'rtl' ? 'right' : 'left' }}
                >
                    <h2 style={{ fontWeight: 700, fontSize: '15px', marginBottom: 16 }}>{content.heading}</h2>
                    {content.paragraphs.map((para, i) => (
                        <p
                            key={i}
                            style={{ fontSize: '13px', color: '#444', lineHeight: 1.9, marginBottom: i < content.paragraphs.length - 1 ? 16 : 0, fontStyle: 'italic' }}
                        >
                            {para}
                        </p>
                    ))}
                </div>

            </div>
        </div>
    );
}
