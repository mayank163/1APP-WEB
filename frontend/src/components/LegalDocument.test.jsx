import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LegalDocument from './LegalDocument';

jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }));

const sections = [1, 2, 3].map(number => ({ id: `section-${number}`, title: `${number}. Section`, content: `Content ${number}` }));
const renderDocument = mobile => {
    window.matchMedia = jest.fn(() => ({ matches: mobile, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
    window.IntersectionObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() }));
    return render(<LegalDocument title="Privacy Policy" sections={sections} intro="Introduction" renderParagraphs={text => <p>{text}</p>} />);
};

test('mobile expands the first two sections and lets readers open and close later sections', () => {
    const { container } = renderDocument(true);
    expect(container.querySelector('#section-1-body').hidden).toBe(false);
    expect(container.querySelector('#section-2-body').hidden).toBe(false);
    expect(container.querySelector('#section-3-body').hidden).toBe(true);
    const toggle = container.querySelector('#section-3 .legal-section-toggle');
    fireEvent.click(toggle);
    expect(container.querySelector('#section-3-body').hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(container.querySelector('#section-3-body').hidden).toBe(true);
});

test('mobile section navigation opens its destination', () => {
    const { container } = renderDocument(true);
    fireEvent.click(container.querySelector('.legal-mobile-jump button:last-child'));
    expect(container.querySelector('#section-3-body').hidden).toBe(false);
});

test('desktop keeps every legal section expanded', () => {
    const { container } = renderDocument(false);
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeTruthy();
    sections.forEach(section => expect(container.querySelector(`#${section.id}-body`).hidden).toBe(false));
});
