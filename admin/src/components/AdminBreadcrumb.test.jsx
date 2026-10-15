import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminBreadcrumb from './AdminBreadcrumb';
import { useAdminAuth } from '../context/AdminAuthContext';

jest.mock('react-router-dom', () => ({
    Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });

jest.mock('../context/AdminAuthContext', () => ({ useAdminAuth: jest.fn() }));

const show = (props) => render(<AdminBreadcrumb {...props} />);

test('links the section to an accessible route and marks the current page', () => {
    useAdminAuth.mockReturnValue({ can: resource => resource === 'services' });
    show({ section: 'Customer Management', items: [{ label: 'Categories' }] });
    expect(screen.getByRole('link', { name: 'Customer Management' })).toHaveAttribute('href', '/services');
    expect(screen.getByText('Categories')).toHaveAttribute('aria-current', 'page');
});

test('does not link to an inaccessible section', () => {
    useAdminAuth.mockReturnValue({ can: () => false });
    show({ section: 'Field Operations', items: [{ label: 'Verification' }] });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('parent actions close details and parent links return to their list', () => {
    useAdminAuth.mockReturnValue({ can: () => true });
    const onClick = jest.fn();
    show({ section: 'Field Operations', items: [
        { label: 'Technicians', to: '/technician-overview' },
        { label: 'Jobs', onClick },
        { label: 'Job Overview' },
    ] });
    expect(screen.getByRole('link', { name: 'Technicians' })).toHaveAttribute('href', '/technician-overview');
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }));
    expect(onClick).toHaveBeenCalledTimes(1);
});
