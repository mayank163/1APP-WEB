import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import { FaShoppingCart, FaUser, FaListAlt, FaSignOutAlt, FaMapMarkerAlt, FaChevronDown } from 'react-icons/fa';
import { BsStack } from 'react-icons/bs';
import SearchAutocomplete from './SearchAutocomplete';
import ServiceSearchAutocomplete from './ServiceSearchAutocomplete';

const tryHeroImg = (filename) => {
        try { return require(`../assets/hero/${filename}`); }
        catch { return ''; }
    };

const NavigationBar = () => {
    const { isAuthenticated, logout, user } = useContext(AuthContext);
    const { getCartItemsCount } = useContext(CartContext);
    const navigate = useNavigate();
    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="sticky-top bg-white border-bottom" style={{ zIndex: 1030 }}>
            <style>{`
                .navbar-dropdown .dropdown-item:active,
                .navbar-dropdown .dropdown-item:focus {
                    background-color: #000 !important;
                    color: #fff !important;
                }
                .navbar-dropdown .dropdown-item:active svg,
                .navbar-dropdown .dropdown-item:focus svg {
                    color: #fff !important;
                }
                .navbar-dropdown .dropdown-item.text-danger:active,
                .navbar-dropdown .dropdown-item.text-danger:focus {
                    background-color: transparent !important;
                    color: var(--bs-danger) !important;
                }
            `}</style>
            <div className="container">
                <div className="d-flex align-items-center py-3 gap-4">

                    {/* Logo */}
                    <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none flex-shrink-0">
                    <img src={tryHeroImg('1app_logo.png') } alt="Hero" style={{ height: '40px'}}/>
                    </Link>

                    {/* Right: Search + Cart + User */}
                    <div className="d-flex align-items-center gap-3 ms-auto">

                        {/* Search fields — shrink to content */}
                        <div className="d-none d-lg-flex align-items-center gap-2">
                            {/* <SearchAutocomplete wrapperStyle={{ minWidth: '185px', maxWidth: '200px' }} /> */}
                            <ServiceSearchAutocomplete wrapperStyle={{ minWidth: '200px', maxWidth: '200px' }} /></div>
                        {/* Cart */}
                        <Link to="/cart" className="position-relative text-dark" style={{ fontSize: '20px' }}>
                            <FaShoppingCart />
                            {getCartItemsCount() > 0 && (
                                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '9px' }}>
                                    {getCartItemsCount()}
                                </span>
                            )}
                        </Link>

                        {/* User */}
                        {isAuthenticated ? (
                            <div className="dropdown">
                                <button className="btn p-0 border-0 bg-transparent" type="button" data-bs-toggle="dropdown">
                                    <div className="rounded-circle overflow-hidden d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: 32, height: 32, border: '2px solid #2d6a4f', background: user?.profileImage?.url ? 'transparent' : '#6c757d' }}>
                                        {user?.profileImage?.url ? (
                                            <img src={user.profileImage.url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                                                {user?.name?.charAt(0)?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end shadow border-0 mt-2 navbar-dropdown">
                                    <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2 text-dark" to="/profile"><FaUser className="text-muted" /><span>Profile</span></Link></li>
                                    <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2 text-dark" to="/bookings"><FaListAlt className="text-muted" /><span>My Bookings</span></Link></li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li><button className="dropdown-item d-flex align-items-center gap-2 py-2 text-danger" onClick={handleLogout} style={{ border: 'none', background: 'none' }}>
                                        <FaSignOutAlt />
                                        <span>Logout</span>
                                    </button></li>
                                </ul>
                            </div>
                        ) : (
                            <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center" style={{ width: 32, height: 32, cursor: 'pointer' }} onClick={() => navigate('/login')}>
                                <FaUser size={14} color="#fff" />
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </nav>
    );
};

export default NavigationBar;
