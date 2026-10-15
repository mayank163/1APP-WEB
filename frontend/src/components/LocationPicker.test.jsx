import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LocationPicker from './LocationPicker';

let locate;
let geocode;
beforeEach(() => {
    locate = jest.fn();
    geocode = jest.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: locate } });
    window.google = { maps: {
        Map: jest.fn(() => ({ setCenter: jest.fn(), setZoom: jest.fn() })),
        Marker: jest.fn(() => ({ addListener: jest.fn(), setPosition: jest.fn(), setVisible: jest.fn() })),
        Geocoder: jest.fn(() => ({ geocode })),
        places: { Autocomplete: jest.fn(() => ({ addListener: jest.fn() })) },
    } };
});
afterEach(() => { delete window.google; });

test('fills the structured address from the device location, including zero latitude', () => {
    const onChange = jest.fn();
    render(<LocationPicker onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }));
    expect(screen.getByRole('button').disabled).toBe(true);
    act(() => locate.mock.calls[0][0]({ coords: { latitude: 0, longitude: 12 } }));
    const component = (long_name, type) => ({ long_name, types: [type] });
    act(() => geocode.mock.calls[0][1]([{
        formatted_address: '12 Main Street, Test City',
        address_components: [component('12', 'street_number'), component('Main Street', 'route'), component('Test City', 'locality'), component('Test State', 'administrative_area_level_1'), component('12345', 'postal_code')],
    }], 'OK'));
    expect(onChange).toHaveBeenCalledWith({ address: '12 Main Street, Test City', lat: 0, lng: 12, addressLine: '12 Main Street', city: 'Test City', state: 'Test State', zipcode: '12345', replaceAddressFields: true });
    expect(screen.getByPlaceholderText('Search address on map…').value).toBe('12 Main Street, Test City');
});

test('permission denial keeps the address unchanged and allows retry', () => {
    const onChange = jest.fn();
    render(<LocationPicker value={{ address: 'Existing address' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }));
    act(() => locate.mock.calls[0][1]({ code: 1 }));
    expect(screen.getByRole('alert').textContent).toContain('denied');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Search address on map…').value).toBe('Existing address');
    expect(screen.getByRole('button').disabled).toBe(false);
});

test('does not change an address after the form has closed', () => {
    const onChange = jest.fn();
    const { unmount } = render(<LocationPicker onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }));
    unmount();
    act(() => locate.mock.calls[0][0]({ coords: { latitude: 12, longitude: 34 } }));
    expect(geocode).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
});
