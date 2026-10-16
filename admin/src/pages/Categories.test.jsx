import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Categories from './Categories';
import adminApi from '../services/adminApi';
jest.mock('../services/adminApi', () => ({ __esModule: true, default: { getAdminCategories: jest.fn(), deleteCategory: jest.fn() } }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../utils/helpers', () => ({ getImageUrl: value => value }));
jest.mock('../components/CatalogManagementLayout', () => ({
  __esModule: true,
  loadCatalog: async fetch => (await fetch()).data.categories,
  default: ({ items, onDelete, children }) => <div>{items.map(item => <button key={item._id} onClick={() => onDelete(item._id)}>Delete {item.name}</button>)}{children}</div>,
}));
jest.mock('../components/CatalogModal', () => ({ __esModule: true, default: ({ title, children }) => <div role="dialog">{title}{children}</div>, IconUpload: () => null, StatusChoices: () => null }));
beforeEach(() => {
  jest.clearAllMocks();
  adminApi.getAdminCategories.mockResolvedValue({ data: { categories: [{ _id: 'a', name: 'Cameras' }] } });
});
test('delete asks for confirmation and removes category after successful API response', async () => {
  adminApi.deleteCategory.mockResolvedValue({ success: true });
  render(<Categories />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Cameras' }));
  expect(adminApi.deleteCategory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete category' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Cameras' })).toBeNull());
  expect(adminApi.deleteCategory).toHaveBeenCalledWith('a');
});
test('dependency conflict explains why deletion is blocked and preserves category', async () => {
  adminApi.deleteCategory.mockRejectedValue({ response: { status: 409, data: { serviceCount: 2, subcategoryCount: 1 } } });
  render(<Categories />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Cameras' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete category' }));
  await screen.findByText(/2 services and 1 subcategories/);
  expect(screen.getByRole('button', { name: 'Delete Cameras' })).toBeTruthy();
});
