import React, { createContext, useState, useEffect, useContext } from 'react';
import cartService from '../services/cartService';
import { AuthContext } from './AuthContext';

export const CartContext = createContext();

const GUEST_CART_KEY = 'vmarc_cart';

// ─── helpers for guest (localStorage) cart ────────────────────────────────────
const readGuestCart = () => {
    try {
        return JSON.parse(localStorage.getItem(GUEST_CART_KEY)) || [];
    } catch {
        return [];
    }
};

const writeGuestCart = (items) => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
};

const clearGuestCart = () => {
    localStorage.removeItem(GUEST_CART_KEY);
};

// ─── shape normaliser ─────────────────────────────────────────────────────────
// Backend returns { service: { _id, name, price, ... }, quantity }
// Guest cart already stores the same shape, so no conversion needed.

export const CartProvider = ({ children }) => {
    const { isAuthenticated, user } = useContext(AuthContext);
    const [cartItems, setCartItems] = useState([]);
    const [cartLoading, setCartLoading] = useState(false);

    // ── Load cart whenever auth state changes ──────────────────────────────────
    useEffect(() => {
        if (isAuthenticated) {
            loadCartFromDB();
        } else {
            setCartItems(readGuestCart());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    // ── When user logs in, merge any pending guest cart then clear it ──────────
    useEffect(() => {
        if (!isAuthenticated) return;

        const guestItems = readGuestCart();
        if (guestItems.length === 0) return;

        const mergeItems = guestItems.map(i => ({
            serviceId: i.service._id,
            quantity: i.quantity
        }));

        cartService.mergeCart(mergeItems)
            .then(res => {
                if (res.success) {
                    setCartItems(res.data.cart);
                    clearGuestCart();
                }
            })
            .catch(err => console.error('Cart merge failed:', err.message));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const loadCartFromDB = async () => {
        setCartLoading(true);
        try {
            const res = await cartService.getCart();
            if (res.success) setCartItems(res.data.cart);
        } catch (err) {
            console.error('Failed to load cart:', err.message);
        } finally {
            setCartLoading(false);
        }
    };

    // ── addToCart ──────────────────────────────────────────────────────────────
    const addToCart = async (service, quantity = 1) => {
        if (isAuthenticated) {
            try {
                const res = await cartService.addToCart(service._id, quantity);
                if (res.success) setCartItems(res.data.cart);
                return !res.duplicate; // true = added, false = already there
            } catch (err) {
                console.error('addToCart error:', err.message);
                return false;
            }
        }

        // Guest path
        let added = false;
        setCartItems(prev => {
            if (prev.find(i => i.service._id === service._id)) return prev;
            const next = [...prev, { service, quantity }];
            writeGuestCart(next);
            added = true;
            return next;
        });
        return added;
    };

    // ── removeFromCart ─────────────────────────────────────────────────────────
    const removeFromCart = async (serviceId) => {
        if (isAuthenticated) {
            try {
                const res = await cartService.removeFromCart(serviceId);
                if (res.success) setCartItems(res.data.cart);
            } catch (err) {
                console.error('removeFromCart error:', err.message);
            }
            return;
        }

        setCartItems(prev => {
            const next = prev.filter(i => i.service._id !== serviceId);
            writeGuestCart(next);
            return next;
        });
    };

    // ── updateQuantity ─────────────────────────────────────────────────────────
    const updateQuantity = async (serviceId, quantity) => {
        const qty = parseInt(quantity);

        if (isAuthenticated) {
            try {
                const res = await cartService.updateCartItem(serviceId, qty);
                if (res.success) setCartItems(res.data.cart);
            } catch (err) {
                console.error('updateQuantity error:', err.message);
            }
            return;
        }

        // Guest path — qty ≤ 0 means remove
        setCartItems(prev => {
            let next;
            if (qty <= 0) {
                next = prev.filter(i => i.service._id !== serviceId);
            } else {
                next = prev.map(i =>
                    i.service._id === serviceId ? { ...i, quantity: qty } : i
                );
            }
            writeGuestCart(next);
            return next;
        });
    };

    // ── clearCart ──────────────────────────────────────────────────────────────
    const clearCart = async () => {
        if (isAuthenticated) {
            try {
                await cartService.clearCart();
            } catch (err) {
                console.error('clearCart error:', err.message);
            }
        } else {
            clearGuestCart();
        }
        setCartItems([]);
    };

    // ── derived helpers (sync — no API needed) ─────────────────────────────────
    const getCartTotal = () =>
        cartItems.reduce((total, item) => total + (item.service.price * item.quantity), 0);

    const getCartItemsCount = () =>
        cartItems.reduce((count, item) => count + item.quantity, 0);

    return (
        <CartContext.Provider value={{
            cartItems,
            cartLoading,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            getCartTotal,
            getCartItemsCount
        }}>
            {children}
        </CartContext.Provider>
    );
};
