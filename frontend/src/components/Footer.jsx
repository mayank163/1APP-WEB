import '../styles/Footer.css';
import React from 'react';
import FloatingSupportChat from './FloatingSupportChat';
import { useNavigate } from 'react-router-dom';

const tryHeroImg = (filename) => {
    try {
        return require(`../assets/hero/${filename}`);
    } catch {
        return '';
    }
};

const LINKS = [
    { label: 'About Us', to: '/about' },
    { label: 'Terms & Conditions', to: '/terms' },
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Anti Discrimination Policy', to: '/anti-discrimination' },
    // { label: 'Reviews', to: '/reviews' },
    { label: 'Blogs', to: '/blogs' },
    { label: 'Contact Us', to: '/contact' },
];

const scrollTop = () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth',
    });
};

function FooterLink({ label, to }) {
    const navigate = useNavigate();

    const handleClick = (e) => {
        e.preventDefault();
        navigate(to || '/');
        scrollTop();
    };

    return (
        <a className="ui-footer-1"
            href={to || '/'}
            onClick={handleClick}



        >
            {label}
        </a>
    );
}

export default function Footer({ widgetOnly = false }) {
    const navigate = useNavigate();

    const goHome = () => {
        navigate('/');
        scrollTop();
    };

    if (widgetOnly) return <FloatingSupportChat />;

    return (
        <footer className="ui-footer-2"

        >

            {/* =========================
                TOP LINKS
            ========================= */}
            <div
                className="footer-links-wrapper ui-footer-3"

            >
                <nav className="footer-links-grid" aria-label="Footer navigation">
                    {LINKS.map((link) => (
                        <FooterLink
                            key={link.label}
                            label={link.label}
                            to={link.to}
                        />
                    ))}
                </nav>
            </div>


            {/* =========================
                DIVIDER
            ========================= */}
            <div className="ui-footer-4"

            />


            {/* =========================
                APP PROMO
            ========================= */}
            <section
                className="footer-app-section ui-footer-5"

            >

                {/* LEFT CONTENT */}
                <div
                    className="footer-app-content ui-footer-6"

                >

                    <h2 className="ui-footer-7"

                    >
                        The one app you need to
                        <br />
                        get everything done.
                    </h2>

                    <p className="ui-footer-8"

                    >
                        From custom guides made just for you to effortless
                        project planning, it's all here — in one free app.
                    </p>


                    {/* APP STORE BUTTONS */}
                    <div className="ui-footer-9"

                    >

                        <a className="ui-footer-10"
                            href="#"
                            onClick={(e) => e.preventDefault()}

                        >
                            <img className="ui-footer-11"
                                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                                alt="Download on the App Store"

                            />
                        </a>


                        <a className="ui-footer-12"
                            href="#"
                            onClick={(e) => e.preventDefault()}

                        >
                            <img className="ui-footer-13"
                                src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                                alt="Get it on Google Play"

                            />
                        </a>

                    </div>
                </div>


                {/* =========================
    PHONE MOCKUP
========================= */}
                <div
                    className="footer-phone ui-footer-14"

                >
                    <img className="ui-footer-15"
                        src={tryHeroImg('mobile.png')}
                        alt="1APP mobile application"

                    />
                </div>

            </section>


            {/* =========================
                BOTTOM DIVIDER
            ========================= */}
            <div className="ui-footer-16"

            />


            {/* =========================
                BOTTOM FOOTER
            ========================= */}
            <div
                className="footer-bottom ui-footer-17"

            >

                {/* LOGO */}
                <div className="ui-footer-18"
                    onClick={goHome}

                >
                    <img className="ui-footer-19"
                        src={tryHeroImg('1app_logo(white).png')}
                        alt="1APP"

                    />
                </div>


                {/* COPYRIGHT */}
                <p className="ui-footer-20"

                >
                    © 2026 1APP Company Limited
                    {' '}
                    (formerly known as 1APP Technologies)
                </p>


                {/* SOCIAL ICONS */}
                <div className="ui-footer-21"

                >

                    {[
                        'instagram.png',
                        'facebook.png',
                        'linkedin.png',
                    ].map((icon) => (
                        <a className="ui-footer-22"
                            href="#"
                            key={icon}
                            onClick={(e) => e.preventDefault()}

                        >
                            <img className="ui-footer-23"
                                src={tryHeroImg(icon)}
                                alt=""

                            />
                        </a>
                    ))}

                </div>

            </div>


            {/* =========================
                RESPONSIVE CSS
            ========================= */}


            <FloatingSupportChat />
        </footer>
    );
}