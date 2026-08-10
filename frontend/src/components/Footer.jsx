import React from 'react';
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
    { label: 'Reviews', to: '/reviews' },
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
        <a
            href={to || '/'}
            onClick={handleClick}
            style={{
                color: '#a9a9a9',
                textDecoration: 'none',
                fontSize: '14px',
                lineHeight: '1.5',
                transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.color = '#a9a9a9';
            }}
        >
            {label}
        </a>
    );
}

export default function Footer() {
    const navigate = useNavigate();

    const goHome = () => {
        navigate('/');
        scrollTop();
    };

    return (
        <footer
            style={{
                background: '#111111',
                color: '#ffffff',
                width: '100%',
                overflow: 'hidden',
            }}
        >

            {/* =========================
                TOP LINKS
            ========================= */}
            <div
                className="footer-links-wrapper"
                style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    padding: '45px 30px 35px',
                }}
            >
                <div
                    className="footer-links-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: '15px',
                        alignItems: 'center',
                    }}
                >
                    {LINKS.map((link) => (
                        <FooterLink
                            key={link.label}
                            label={link.label}
                            to={link.to}
                        />
                    ))}
                </div>
            </div>


            {/* =========================
                DIVIDER
            ========================= */}
            <div
                style={{
                    width: '100%',
                    height: '1px',
                    background: '#2b2b2b',
                }}
            />


            {/* =========================
                APP PROMO
            ========================= */}
            <section
                className="footer-app-section"
                style={{
                    position: 'relative',
                    maxWidth: '1200px',
                    minHeight: '470px',
                    margin: '0 auto',
                    padding: '70px 30px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    boxSizing: 'border-box',
                }}
            >

                {/* LEFT CONTENT */}
                <div
                    className="footer-app-content"
                    style={{
                        width: '52%',
                        paddingTop: '55px',
                        position: 'relative',
                        zIndex: 2,
                    }}
                >

                    <h2
                        style={{
                            color: '#ffffff',
                            fontSize: '44px',
                            lineHeight: '1.12',
                            fontWeight: 700,
                            margin: '0 0 22px',
                            letterSpacing: '-1px',
                        }}
                    >
                        The one app you need to
                        <br />
                        get everything done.
                    </h2>

                    <p
                        style={{
                            color: '#dddddd',
                            fontSize: '17px',
                            lineHeight: '1.55',
                            fontWeight: 500,
                            maxWidth: '560px',
                            margin: '0 0 30px',
                        }}
                    >
                        From custom guides made just for you to effortless
                        project planning, it's all here — in one free app.
                    </p>


                    {/* APP STORE BUTTONS */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            flexWrap: 'wrap',
                        }}
                    >

                        <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            style={{
                                display: 'inline-block',
                                lineHeight: 0,
                            }}
                        >
                            <img
                                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                                alt="Download on the App Store"
                                style={{
                                    height: '48px',
                                    width: 'auto',
                                    display: 'block',
                                }}
                            />
                        </a>


                        <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            style={{
                                display: 'inline-block',
                                lineHeight: 0,
                            }}
                        >
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                                alt="Get it on Google Play"
                                style={{
                                    height: '48px',
                                    width: 'auto',
                                    display: 'block',
                                }}
                            />
                        </a>

                    </div>
                </div>


                {/* =========================
    PHONE MOCKUP
========================= */}
<div
    className="footer-phone"
    style={{
        position: 'absolute',
        right: '-40px',
        bottom: '-5px',
        width: '500px',
        zIndex: 3,

        // Tilt phone to the right
        transform: 'rotate(0deg)',
        transformOrigin: 'center bottom',
    }}
>
    <img
        src={tryHeroImg('mobile.png')}
        alt="1APP mobile application"
        style={{
            width: '40%',
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
            filter: 'drop-shadow(0px 15px 30px rgba(0,0,0,0.45))',
            margin: '0px 0px 20px 160px'
        }}
    />
</div>

            </section>


            {/* =========================
                BOTTOM DIVIDER
            ========================= */}
            <div
                style={{
                    width: '100%',
                    height: '1px',
                    background: '#2b2b2b',
                }}
            />


            {/* =========================
                BOTTOM FOOTER
            ========================= */}
            <div
                className="footer-bottom"
                style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    padding: '25px 30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '25px',
                }}
            >

                {/* LOGO */}
                <div
                    onClick={goHome}
                    style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <img
                        src={tryHeroImg('1app_logo(white).png')}
                        alt="1APP"
                        style={{
                            height: '42px',
                            width: 'auto',
                            display: 'block',
                        }}
                    />
                </div>


                {/* COPYRIGHT */}
                <p
                    style={{
                        color: '#999999',
                        fontSize: '13px',
                        margin: 0,
                        textAlign: 'center',
                    }}
                >
                    © 2026 1APP Company Limited
                    {' '}
                    (formerly known as 1APP Technologies)
                </p>


                {/* SOCIAL ICONS */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}
                >

                    {[
                        'instagram.png',
                        'facebook.png',
                        'linkedin.png',
                    ].map((icon) => (
                        <a
                            href="#"
                            key={icon}
                            onClick={(e) => e.preventDefault()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <img
                                src={tryHeroImg(icon)}
                                alt=""
                                style={{
                                    width: '30px',
                                    height: '30px',
                                    objectFit: 'contain',
                                    display: 'block',
                                }}
                            />
                        </a>
                    ))}

                </div>

            </div>


            {/* =========================
                RESPONSIVE CSS
            ========================= */}
            <style>
                {`
                    .footer-links-grid {
                        grid-template-columns: repeat(7, 1fr) !important;
                    }

                    @media (max-width: 1000px) {

                        .footer-links-grid {
                            grid-template-columns: repeat(4, 1fr) !important;
                            row-gap: 18px !important;
                        }

                        .footer-app-section {
                            min-height: 560px !important;
                        }

                        .footer-app-content {
                            width: 60% !important;
                        }

                        .footer-phone {
                            width: 430px !important;
                            right: -80px !important;
                        }

                    }


                    @media (max-width: 768px) {

                        .footer-links-wrapper {
                            padding: 35px 20px 30px !important;
                        }

                        .footer-links-grid {
                            grid-template-columns: repeat(2, 1fr) !important;
                            row-gap: 18px !important;
                        }

                        .footer-app-section {
                            min-height: auto !important;
                            padding: 50px 20px 0 !important;
                            display: block !important;
                        }

                        .footer-app-content {
                            width: 100% !important;
                            padding-top: 0 !important;
                            padding-bottom: 30px !important;
                        }

                        .footer-app-content h2 {
                            font-size: 34px !important;
                        }

                        .footer-app-content p {
                            font-size: 15px !important;
                        }

                        .footer-phone {
                            position: relative !important;
                            right: auto !important;
                            bottom: auto !important;
                            width: 330px !important;
                            margin: 10px auto -10px !important;
                        }

                        .footer-bottom {
                            padding: 25px 20px !important;
                            flex-direction: column !important;
                            text-align: center !important;
                        }

                    }


                    @media (max-width: 480px) {

                        .footer-links-grid {
                            grid-template-columns: 1fr !important;
                        }

                        .footer-app-content h2 {
                            font-size: 30px !important;
                        }

                        .footer-phone {
                            width: 280px !important;
                        }

                    }
                `}
            </style>

        </footer>
    );
}