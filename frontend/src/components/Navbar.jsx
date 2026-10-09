import { cssValue } from '../utils/cssValue';
import '../styles/Navbar.css';
import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import { FaShoppingCart, FaUser, FaListAlt, FaSignOutAlt, FaMapMarkerAlt, FaChevronDown, FaLock, FaHeadset } from 'react-icons/fa';
import { BsStack } from 'react-icons/bs';
import SearchAutocomplete from './SearchAutocomplete';
import ServiceSearchAutocomplete from './ServiceSearchAutocomplete';
import NotificationBell from './NotificationBell';
import { resolveImageUrl } from '../services/api';

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
        <nav className="sticky-top bg-white border-bottom ui-navbar-1" >

            <div className="container">
                <div className="d-flex align-items-center py-3 gap-4">

                    {/* Logo */}
                    <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none flex-shrink-0">
                    <img className="ui-navbar-2" src={tryHeroImg('1app_logo.png') } alt="Hero" />
                    </Link>

                    {/* Right: Search + Cart + User */}
                    <div className="d-flex align-items-center gap-3 ms-auto">

                        {/* Search fields — shrink to content */}
                        <div className="d-none d-lg-flex align-items-center gap-2">
                            {/* <SearchAutocomplete wrapperStyle={{ minWidth: '185px', maxWidth: '200px' }} /> */}
                            <ServiceSearchAutocomplete wrapperClassName="navbar-service-search" /></div>
                        {isAuthenticated && <NotificationBell />}

                        {/* Cart */}
                        <Link to="/cart" className="position-relative text-dark ui-navbar-3" >
                            <FaShoppingCart />
                            {getCartItemsCount() > 0 && (
                                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger ui-navbar-4" >
                                    {getCartItemsCount()}
                                </span>
                            )}
                        </Link>

                        {/* User */}
                        {isAuthenticated ? (
                            <div className="dropdown">
                                <button className="btn p-0 border-0 bg-transparent" type="button" data-bs-toggle="dropdown">
                                    <div className="rounded-circle overflow-hidden d-flex align-items-center justify-content-center flex-shrink-0 ui-navbar-5"
                                        style={{ "--ui-navbar-5-background": cssValue(user?.profileImage?.url ? "var(--ui-color-120)" : "var(--ui-color-84)", "background") }}>
                                        {user?.profileImage?.url ? (
                                            <img className="ui-navbar-6" src={resolveImageUrl(user.profileImage.url)} alt={user.name}  />
                                        ) : (
                                            <span className="ui-navbar-7" >
                                                {user?.name?.charAt(0)?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end shadow border-0 mt-2 navbar-dropdown">
                                    <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2 text-dark" to="/profile"><FaUser className="text-muted" /><span>Profile</span></Link></li>
                                    <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2 text-dark" to="/support"><FaHeadset className="text-muted" /><span>Support Tickets</span></Link></li>
                                    <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2 text-dark" to="/bookings"><FaListAlt className="text-muted" /><span>My Bookings</span></Link></li>
                                    <li><Link className="dropdown-item d-flex align-items-center gap-2 py-2 text-dark" to="/change-password"><FaLock className="text-muted" /><span>Reset Password</span></Link></li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li><button className="dropdown-item d-flex align-items-center gap-2 py-2 text-danger ui-navbar-8" onClick={handleLogout} >
                                        <FaSignOutAlt />
                                        <span>Logout</span>
                                    </button></li>
                                </ul>
                            </div>
                        ) : (
                            <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center ui-navbar-9"  onClick={() => navigate('/login')}>
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
