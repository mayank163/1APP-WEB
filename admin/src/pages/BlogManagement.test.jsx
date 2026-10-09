import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BlogManagement from './BlogManagement';
import adminApi from '../services/adminApi';

jest.mock('../services/adminApi', () => ({ __esModule: true, default: { getBlogs: jest.fn(), getCategories: jest.fn(), getSubCategories: jest.fn(), deleteBlog: jest.fn(), updateBlog: jest.fn() } }));
jest.mock('../components/AdminImage', () => () => null);
jest.mock('../components/Shimmer', () => ({ ShimmerBlogTable: () => <div>Loading</div> }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const blogs = [
    { _id: '1', title: 'Wallet guide', description: 'Manage money', isPublished: true, contentBlocks: [{}], createdAt: '2026-10-01' },
    { _id: '2', title: 'Team news', description: 'Meet the team', isPublished: false, contentBlocks: [], createdAt: '2026-10-02' }
];
beforeEach(() => {
    jest.clearAllMocks();
    adminApi.getBlogs.mockResolvedValue({ success: true, data: { blogs } });
    adminApi.getCategories.mockResolvedValue({ success: true, data: { categories: [] } });
    adminApi.getSubCategories.mockResolvedValue({ success: true, data: { subcategories: [] } });
    adminApi.deleteBlog.mockResolvedValue({ success: true });
    adminApi.updateBlog.mockResolvedValue({ success: true });
});
test('filters real posts by search and status, then resets', async () => {
    render(<BlogManagement />);
    await screen.findByText('Wallet guide');
    fireEvent.change(screen.getByLabelText('Search blogs'), { target: { value: 'Team' } });
    expect(screen.queryByText('Wallet guide')).toBeNull();
    expect(screen.getByText('Team news')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'Published' } });
    expect(screen.getByText('No blogs match your filters.')).toBeTruthy();
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByText('Wallet guide')).toBeTruthy();
});
test('deletes only after confirmation and supports cancel', async () => {
    render(<BlogManagement />);
    await screen.findByText('Wallet guide');
    fireEvent.click(screen.getByLabelText('Actions for Wallet guide'));
    fireEvent.click(screen.getByText('Delete Blog', { selector: 'button' }));
    expect(adminApi.deleteBlog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    expect(adminApi.deleteBlog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Actions for Wallet guide'));
    fireEvent.click(screen.getByText('Delete Blog', { selector: 'button' }));
    fireEvent.click(screen.getByText('Delete', { selector: 'button' }));
    await waitFor(() => expect(adminApi.deleteBlog).toHaveBeenCalledWith('1'));
});
test('publish action persists publication and clears archive and schedule', async () => {
    render(<BlogManagement />);
    await screen.findByText('Team news');
    fireEvent.click(screen.getByLabelText('Actions for Team news'));
    fireEvent.click(screen.getByText('Publish Now'));
    await waitFor(() => expect(adminApi.updateBlog).toHaveBeenCalled());
    const [id, data] = adminApi.updateBlog.mock.calls[0];
    expect(id).toBe('2');
    expect(data.get('isPublished')).toBe('true');
    expect(data.get('isArchived')).toBe('false');
    expect(data.get('scheduledAt')).toBe('');
});
