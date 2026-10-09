import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import BlogDetail from './BlogDetail';
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>, useParams: () => ({ id: 'money-guide' }) }));
jest.mock('../services/api', () => ({ resolveImageUrl: value => `/media/${value}` }));
jest.mock('../components/Shimmer', () => ({ BlogDetailShimmer: () => <div>Loading article</div> }));
const blog = { title: 'Money guide', subtitle: 'Build better habits', author: 'Jagriti', createdAt: '2026-10-10T09:00:00Z', description: 'A'.repeat(250), featuredImage: 'cover.jpg', imageAltText: 'Office desk', subcategory: { name: 'IT Support', category: { name: 'IT & Technology' } }, contentBlocks: [{ type: 'text-image', title: 'Why this matters', text: 'Keep track of your tools.', image: 'tools.jpg', altText: 'A team at work' }, { type: 'bullet-list', items: ['Review tools', 'Create a plan'] }, { type: 'quote', text: 'Small habits matter', attribution: 'Jagriti' }] };
const mount = () => render(<BlogDetail />);
test('renders the article cover, tags, metadata and full description', async () => {
    axios.get.mockResolvedValue({ data: { success: true, data: { blog } } }); mount();
    await screen.findByRole('heading', { name: 'Money guide', level: 1 });
    expect(screen.getByAltText('Office desk').getAttribute('src')).toBe('/media/cover.jpg');
    expect(screen.getByText('IT & Technology')).toBeTruthy(); expect(screen.getByText('IT Support')).toBeTruthy();
    expect(screen.getByText('10 October 2026')).toBeTruthy(); expect(screen.getByText('1 min read')).toBeTruthy();
    expect(screen.getByText(blog.description)).toBeTruthy(); expect(screen.getByText('Review tools').tagName).toBe('LI');
    expect(screen.getByText('Small habits matter').tagName).toBe('BLOCKQUOTE');
    expect(screen.getByAltText('A team at work').closest('section').className).toContain('blog-article-media-row');
});
test('does not fabricate images for older text-only blocks', async () => {
    axios.get.mockResolvedValue({ data: { success: true, data: { blog: { ...blog, featuredImage: null, contentBlocks: [{ title: 'Legacy heading', text: 'All the original text stays visible.' }] } } } }); mount();
    await screen.findByText('All the original text stays visible.');
    expect(screen.queryByRole('img')).toBeNull(); expect(screen.getByText('Legacy heading')).toBeTruthy();
});
test('shows a back link when an article is unavailable', async () => {
    axios.get.mockRejectedValue(new Error('Not found')); mount();
    await screen.findByRole('heading', { name: 'Blog not found' });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Back to blogs' }).getAttribute('href')).toBe('/blogs'));
});
