import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ServiceCard from '../components/ServiceCard';
import Services from './Services';
import ServiceDetail from './ServiceDetail';
import serviceService from '../services/serviceService';
import { CartContext } from '../context/CartContext';

jest.mock('react-router-dom', () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
    useParams: () => ({ id: 'service-1' }),
    useSearchParams: () => [new URLSearchParams('search=Cleaning')],
    useNavigate: () => jest.fn(),
}));
jest.mock('../context/CartContext', () => ({
    CartContext: require('react').createContext(),
}));
jest.mock('../context/SocketContext', () => ({ useSocket: () => ({ socket: null }) }));
jest.mock('../services/serviceService', () => ({
    getAllServices: jest.fn(),
    getServiceById: jest.fn(),
    getServiceReviews: jest.fn(),
}));
jest.mock('../services/api', () => ({ resolveImageUrl: image => image || '' }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), info: jest.fn() } }));

const service = {
    _id: 'service-1',
    name: 'Cleaning',
    category: { name: 'Home' },
    price: { min: 100, max: 250 },
    offerPrice: 0,
    actualPrice: 0,
    hasVariants: true,
    variants: [
        { _id: 'small', name: 'Small', actualPrice: 100, offerPrice: 0 },
        { _id: 'large', name: 'Large', actualPrice: 300, offerPrice: 250 },
    ],
};

const renderWithCart = component => render(
    <CartContext.Provider value={{ cartItems: [], addToCart: jest.fn(), updateQuantity: jest.fn() }}>
        {component}
    </CartContext.Provider>
);

test.each([
    [100, '100'],
    [0, '0'],
    [{ min: 100, max: 250 }, '100 – $250'],
    [{ min: 100, max: 100 }, '100'],
])('renders service cards with price %j', (price, expected) => {
    renderWithCart(<ServiceCard service={{ ...service, price }} />);
    expect(screen.getByText(expected)).toBeTruthy();
});

test('renders the minimum variant price in service search results', async () => {
    serviceService.getAllServices.mockResolvedValue({ success: true, data: { services: [service] } });
    renderWithCart(<Services />);
    expect(await screen.findByText('Starts at $100')).toBeTruthy();
});

test('renders a price range and updates the detail total when selecting a variant', async () => {
    serviceService.getServiceById.mockResolvedValue({ success: true, data: { service } });
    serviceService.getServiceReviews.mockResolvedValue({ success: false });
    renderWithCart(<ServiceDetail />);

    expect(await screen.findByText('$100.00 – $250.00')).toBeTruthy();
    // The first variant has no offer price: its actualPrice must be used.
    expect(screen.getAllByText('$100.00')).toHaveLength(2);
    fireEvent.click(screen.getByText('Large'));
    expect(screen.getAllByText('$250.00')).toHaveLength(2);
    expect(screen.getAllByText('$100.00')).toHaveLength(1);
});
