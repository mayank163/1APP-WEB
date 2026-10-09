import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import OfferManagement from './OfferManagement';
import adminApi from '../services/adminApi';
jest.mock('../services/adminApi', () => ({ getOffers: jest.fn(), getOfferOptions: jest.fn(), createOffer: jest.fn(), updateOffer: jest.fn(), deactivateOffer: jest.fn(), uploadOfferImage: jest.fn(), getOfferRedemptions: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const fixture = { _id: '507f1f77bcf86cd799439011', code: 'AC25', title: 'AC service deal', description: 'Save on AC installation', discountType: 'percentage', discountValue: 25, maximumDiscount: 500, applicability: 'all', services: [], categories: [], customers: [], eligibility: 'all', minimumOrderValue: 0, used: 30, totalLimit: 80, perCustomerLimit: 1, status: 'active', publicationStatus: 'active', startsAt: '2026-10-09T00:00:00Z', endsAt: '2026-10-12T00:00:00Z', icon: 'tag', image: '', currency: 'USD' };
beforeEach(() => { jest.clearAllMocks(); adminApi.getOffers.mockResolvedValue({ data: { offers: [fixture] } }); adminApi.getOfferOptions.mockResolvedValue({ data: { services: [], categories: [], customers: [] } }); });
test('loads API data and searches without seeded coupons', async () => {
    render(<OfferManagement />);
    expect(await screen.findByText(fixture.title)).toBeInTheDocument();
    expect(screen.queryByText('Flash 6-Hour Sale')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search coupons'), { target: { value: 'missing' } });
    expect(screen.getByText(/No coupons found/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText(fixture.title)).toBeInTheDocument();
});
test('deactivation persists after confirmation and retains usage', async () => {
    adminApi.deactivateOffer.mockResolvedValue({ data: { offer: { ...fixture, status: 'inactive', publicationStatus: 'inactive' } } });
    render(<OfferManagement />); await screen.findByText(fixture.title);
    const open = () => { fireEvent.click(screen.getByLabelText(`Actions for ${fixture.title} (${fixture._id})`)); fireEvent.click(screen.getByRole('button', { name: 'Deactivate Coupon' })); };
    open(); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(adminApi.deactivateOffer).not.toHaveBeenCalled();
    open(); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate Coupon' }));
    expect(await screen.findByText('• Inactive')).toBeInTheDocument();
    expect(adminApi.deactivateOffer).toHaveBeenCalledWith(fixture._id);
    expect(screen.getByText('30 / 80 used')).toBeInTheDocument();
});
test('seven-step wizard submits numeric settings and IST timestamps to API', async () => {
    adminApi.createOffer.mockImplementation(async payload => ({ data: { offer: { ...fixture, ...payload, _id: '507f1f77bcf86cd799439012', status: 'scheduled' } } }));
    render(<OfferManagement />); await screen.findByText(fixture.title);
    fireEvent.click(screen.getByRole('button', { name: 'Create Coupon' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Enter a code');
    for (const [label, value] of [['Coupon code', 'NEW30'], ['Coupon title', 'New offer'], ['Short description', 'First booking discount']]) fireEvent.change(dialog.getByLabelText(label), { target: { value } });
    fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
    fireEvent.change(dialog.getByLabelText('Discount value'), { target: { value: '30' } });
    fireEvent.change(dialog.getByLabelText('Maximum discount'), { target: { value: '500' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
    fireEvent.change(dialog.getByLabelText('Start date'), { target: { value: '2026-11-01' } });
    fireEvent.change(dialog.getByLabelText('Start time'), { target: { value: '04:18' } });
    fireEvent.click(dialog.getByRole('button', { name: '72 hours (3 days)' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
    fireEvent.change(dialog.getByLabelText('Total redemptions allowed'), { target: { value: '100' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Next' }));
    expect(dialog.getByText('Live customer-facing preview')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Create Coupon' }));
    await waitFor(() => expect(adminApi.createOffer).toHaveBeenCalled());
    expect(adminApi.createOffer.mock.calls[0][0]).toMatchObject({ code: 'NEW30', discountValue: 30, maximumDiscount: '500', totalLimit: '100', startsAt: '2026-10-31T22:48:00.000Z', endsAt: '2026-11-03T22:48:00.000Z' });
    expect(await screen.findByText('New offer')).toBeInTheDocument();
});
test('draft can be saved before completing required publication fields', async () => {
    adminApi.createOffer.mockResolvedValue({ data: { offer: { ...fixture, title: '', description: '', code: 'DRAFT1', status: 'draft', publicationStatus: 'draft' } } });
    render(<OfferManagement />); await screen.findByText(fixture.title);
    fireEvent.click(screen.getByRole('button', { name: 'Create Coupon' }));
    fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'DRAFT1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));
    await waitFor(() => expect(adminApi.createOffer).toHaveBeenCalledWith(expect.objectContaining({ code: 'DRAFT1', publicationStatus: 'draft', discountValue: 0 })));
});
test('API failures show retry and never show fake records', async () => {
    adminApi.getOffers.mockRejectedValueOnce(new Error('offline'));
    render(<OfferManagement />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load coupons');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(fixture.title)).toBeInTheDocument();
});

test('uploaded image appears in preview and is included when saving the draft', async () => {
    adminApi.uploadOfferImage.mockResolvedValue({ data: { image: 'offers/1234-abcd.webp' } });
    adminApi.createOffer.mockResolvedValue({ data: { offer: { ...fixture, image: 'offers/1234-abcd.webp', status: 'draft', publicationStatus: 'draft' } } });
    render(<OfferManagement />); await screen.findByText(fixture.title);
    fireEvent.click(screen.getByRole('button', { name: 'Create Coupon' }));
    const file = new File(['png'], 'coupon.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload promotional image'), { target: { files: [file] } });
    expect(await screen.findByAltText('Promotional banner')).toHaveAttribute('src', expect.stringContaining('/offers/1234-abcd.webp'));
    expect(adminApi.uploadOfferImage.mock.calls[0][0].get('image')).toBe(file);
    fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'UPLOAD1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));
    await waitFor(() => expect(adminApi.createOffer).toHaveBeenCalledWith(expect.objectContaining({ image: 'offers/1234-abcd.webp' })));
});

test('failed image upload shows the server error and allows the same file to be retried', async () => {
    adminApi.uploadOfferImage.mockRejectedValueOnce({ response: { data: { message: 'Unable to upload promotional image. Please try again.' } } }).mockResolvedValueOnce({ data: { image: 'offers/1234-abcd.webp' } });
    render(<OfferManagement />); await screen.findByText(fixture.title);
    fireEvent.click(screen.getByRole('button', { name: 'Create Coupon' }));
    const input = screen.getByLabelText('Upload promotional image');
    const file = new File(['png'], 'coupon.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to upload promotional image');
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByAltText('Promotional banner')).toBeInTheDocument();
});
