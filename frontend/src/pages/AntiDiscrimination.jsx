import { cssValue } from '../utils/cssValue';
import '../styles/AntiDiscrimination.css';
import React, { useState } from 'react';

const COUNTRIES = [
    { code: 'USD', flag: '🇺🇸', label: 'USD' },
    { code: 'UAE', flag: '🇦🇪', label: 'UAE' },
    { code: 'KSA', flag: '🇸🇦', label: 'Saudi Arabia' },
    { code: 'SGP', flag: '🇸🇬', label: 'Singapore' },
];

const CONTENT = {
    USD: {
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
    const [country, setCountry] = useState('USD');
    const [open, setOpen] = useState(false);
    const selected = COUNTRIES.find(c => c.code === country);
    const content = CONTENT[country];

    return (
        <div className="ui-antidiscrimination-1" >
            <div className="ui-antidiscrimination-2" >

                {/* Title card */}
                <div className="ui-antidiscrimination-3" >
                    <h1 className="ui-antidiscrimination-4" >{content.title}</h1>

                    {/* Country dropdown */}
                    <div className="ui-antidiscrimination-5" >
                        <button className="ui-antidiscrimination-6"
                            onClick={() => setOpen(o => !o)}

                        >
                            <span>{selected.flag}</span>
                            <span>{selected.code}</span>
                            <span className="ui-antidiscrimination-7" >▼</span>
                        </button>
                        {open && (
                            <div className="ui-antidiscrimination-8" >
                                {COUNTRIES.map(c => (
                                    <div className="ui-antidiscrimination-9" key={c.code}
                                        onClick={() => { setCountry(c.code); setOpen(false); }}
                                        style={{ "--ui-antidiscrimination-9-background": cssValue(c.code === country ? "var(--ui-color-35)" : "var(--ui-color-2)", "background") }}


                                    >
                                        <span>{c.flag}</span>
                                        <span className="ui-antidiscrimination-10" style={{ "--ui-antidiscrimination-10-font-weight": cssValue(c.code === country ? 700 : 400, "fontWeight") }}>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Policy content card */}
                <div className="ui-antidiscrimination-11"
                    style={{ "--ui-antidiscrimination-11-direction": cssValue(content.dir, "direction"), "--ui-antidiscrimination-11-text-align": cssValue(content.dir === 'rtl' ? 'right' : 'left', "textAlign") }}
                >
                    <h2 className="ui-antidiscrimination-12" >{content.heading}</h2>
                    {content.paragraphs.map((para, i) => (
                        <p className="ui-antidiscrimination-13"
                            key={i}
                            style={{ "--ui-antidiscrimination-13-margin-bottom": cssValue(i < content.paragraphs.length - 1 ? 16 : 0, "marginBottom") }}
                        >
                            {para}
                        </p>
                    ))}
                </div>

            </div>
        </div>
    );
}
