import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServiceEditor from './ServiceEditor';
import adminApi from '../services/adminApi';

jest.mock('../services/adminApi', () => ({ __esModule: true, default: { createService: jest.fn(), updateService: jest.fn() } }));
jest.mock('react-quill-new', () => ({ __esModule: true, default: ({ value, onChange }) => <textarea aria-label="Rich description" value={value} onChange={event => onChange(event.target.value)} /> }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const categories = [{ _id: 'category1', name: 'Networking' }];
const subcategories = [{ _id: 'sub1', name: 'Installation', category: { _id: 'category1' } }];
const renderEditor = (props = {}) => render(<ServiceEditor categories={categories} subcategories={subcategories} onClose={jest.fn()} onSaved={jest.fn()} {...props} />);
const fillBasic = () => {
    fireEvent.change(screen.getByLabelText('Service Name *'), { target: { value: 'Mesh Setup' } });
    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'category1' } });
    fireEvent.change(screen.getByLabelText('Sub-category *'), { target: { value: 'sub1' } });
    fireEvent.change(screen.getByLabelText('Duration (minutes) *'), { target: { value: '90' } });
};
beforeEach(() => { jest.clearAllMocks(); adminApi.createService.mockResolvedValue({ success: true }); adminApi.updateService.mockResolvedValue({ success: true }); });
test('preserves basic information across sections and publishes quote pricing', async () => {
    const onSaved = jest.fn(); renderEditor({ onSaved, service: { longDescription: '<p>Network setup</p>', featuredImage: 'cover.png', processSteps: [{ title: 'Install', stepNumber: 1 }] } }); fillBasic();
    fireEvent.click(screen.getByRole('button', { name: '02 Pricing' }));
    fireEvent.click(screen.getByRole('button', { name: /Get a Quote/ }));
    fireEvent.click(screen.getByRole('button', { name: '08 Preview' }));
    expect(screen.getByText('Mesh Setup')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish Service' })[0]);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const payload = adminApi.createService.mock.calls[0][0];
    expect(payload.get('status')).toBe('active'); expect(payload.get('pricingType')).toBe('quote'); expect(payload.get('actualPrice')).toBe('0'); expect(payload.get('subcategory')).toBe('sub1');
});
test('draft action explicitly saves draft status for an existing service', async () => {
    renderEditor({ service: { _id: 'service1', name: 'Mesh Setup', category: categories[0], subcategory: subcategories[0], actualPrice: 71, serviceDuration: 90, status: 'active' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);
    await waitFor(() => expect(adminApi.updateService).toHaveBeenCalled());
    expect(adminApi.updateService.mock.calls[0][0]).toBe('service1');
    expect(adminApi.updateService.mock.calls[0][1].get('status')).toBe('draft');
});
test('does not send incomplete service and clears subcategory when category changes', () => {
    renderEditor(); fireEvent.click(screen.getAllByRole('button', { name: 'Publish Service' })[0]);
    expect(adminApi.createService).not.toHaveBeenCalled(); fillBasic();
    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: '' } });
    expect(screen.getByLabelText('Sub-category *').value).toBe('');
});

test('blocks every later section until basic information is complete', () => {
    renderEditor();
    for (const label of ['02 Pricing', '03 Variants & Add-ons', '04 Content', '05 Media', '06 Requirements', '07 Process', '08 Preview']) {
        fireEvent.click(screen.getByRole('button', { name: label }));
        expect(screen.getByRole('heading', { name: 'Basic Information' })).toBeTruthy();
        expect(screen.getByRole('alert').textContent).toMatch(/service name/);
    }
    fillBasic();
    fireEvent.change(screen.getByLabelText('Duration (minutes) *'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toMatch(/duration/);
});
test('requires pricing, content, media and process while skipping both optional sections', () => {
    renderEditor(); fillBasic();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toMatch(/base price/);
    fireEvent.change(screen.getByLabelText('Base Price (USD) *'), { target: { value: '71' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Variants & Add-ons' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip / Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toMatch(/description/);
    fireEvent.change(screen.getByLabelText('Rich description'), { target: { value: '<p>Network installation</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toMatch(/featured image/);
});
test('empty requirements and tools do not block process or publishing', async () => {
    renderEditor({ service: { name: 'Mesh Setup', category: categories[0], subcategory: subcategories[0], actualPrice: 71, serviceDuration: 90, longDescription: '<p>Installation</p>', featuredImage: 'cover.png', processSteps: [{ title: 'Install', stepNumber: 1 }] } });
    fireEvent.click(screen.getByRole('button', { name: '06 Requirements' }));
    expect(screen.getByRole('heading', { name: 'Requirements & Tools' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip / Continue' }));
    expect(screen.getByRole('heading', { name: 'Our Process' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish Service' })[0]);
    await waitFor(() => expect(adminApi.createService).toHaveBeenCalled());
    const payload = adminApi.createService.mock.calls[0][0];
    for (const key of ['variants', 'addons', 'requirements', 'tools']) expect(payload.get(key)).toBe('[]');
});
test('cannot bypass missing process or an earlier step cleared after completion', () => {
    renderEditor({ service: { name: 'Mesh Setup', category: categories[0], subcategory: subcategories[0], actualPrice: 71, serviceDuration: 90, longDescription: '<p>Installation</p>', featuredImage: 'cover.png' } });
    fireEvent.click(screen.getByRole('button', { name: '08 Preview' }));
    expect(screen.getByRole('heading', { name: 'Our Process' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/process step/);
    fireEvent.click(screen.getByRole('button', { name: /Basic Info/ }));
    fireEvent.change(screen.getByLabelText('Service Name *'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '08 Preview' }));
    expect(screen.getByRole('heading', { name: 'Basic Information' })).toBeTruthy();
});
