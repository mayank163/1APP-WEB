import React, { createContext, useState, useEffect } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);

    // Load cart from LocalStorage on mount
    useEffect(() => {
        const storedCart = localStorage.getItem('1App_cart');
        if (storedCart) {
            try {
                setCartItems(JSON.parse(storedCart));
            } catch (err) {
                console.error('Error parsing cart data', err);
            }
        }
    }, []);

    // Save cart to LocalStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('1App_cart', JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (service, quantity = 1) => {
        setCartItems((prevItems) => {
            const existingIndex = prevItems.findIndex(item => item.service._id === service._id);
            if (existingIndex > -1) {
                const newItems = [...prevItems];
                newItems[existingIndex].quantity += quantity;
                return newItems;
            }
            return [...prevItems, { service, quantity }];
        });
    };

    const removeFromCart = (serviceId) => {
        setCartItems((prevItems) => prevItems.filter(item => item.service._id !== serviceId));
    };

    const updateQuantity = (serviceId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(serviceId);
            return;
        }
        setCartItems((prevItems) => 
            prevItems.map(item => 
                item.service._id === serviceId ? { ...item, quantity: parseInt(quantity) } : item
            )
        );
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const getCartTotal = () => {
        return cartItems.reduce((total, item) => total + (item.service.price * item.quantity), 0);
    };

    const getCartItemsCount = () => {
        return cartItems.reduce((count, item) => count + item.quantity, 0);
    };

    return (
        <CartContext.Provider value={{
            cartItems,
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
