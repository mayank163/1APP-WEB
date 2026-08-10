import React, { useState } from 'react';

const AVATAR_COLORS = ['#f5c842', '#f5d4a2', '#f5a87a', '#a2c4f5', '#d4a2f5', '#f5a2c4', '#a2f5e8', '#e8d5b0'];

const ALL_REVIEWS = [
    { name: 'Shikha gulati', rating: 5.0, text: 'Very good in behaviour n very nice work', date: '03 June 2026' },
    { name: 'Muskan', rating: 5.0, text: 'Good sarvice you are madam', date: '03 June 2026' },
    { name: 'Satla sridhar', rating: 5.0, text: 'Good work 👌', date: '03 June 2026' },
    { name: 'Shama K T', rating: 5.0, text: 'She did well, finished quickly.', date: '03 June 2026' },
    { name: 'Priyanka Sharma', rating: 5.0, text: 'The experience was wonderful. She was very polite and sweet. Will book her again. 🖤', date: '03 June 2026' },
    { name: 'Nita H', rating: 5.0, text: 'Very thorough, fast, respectful, well behaved and a true professional. She is reliable, punctual and manages to finish a significant amount of work within the time without compromising on quality. Very thankful and grateful for her services alwa ...read more', date: '03 June 2026' },
    { name: 'Office', rating: 5.0, text: 'Good behavior and professional attitude', date: '03 June 2026' },
    { name: 'Pooja', rating: 5.0, text: 'Nice she is good at cleaning, but she will say first reasons after that she will start work', date: '03 June 2026' },
    { name: 'Amrita kumari', rating: 5.0, text: 'Very good servic', date: '03 June 2026' },
    { name: 'Rahul Verma', rating: 4.5, text: 'Good service overall, would recommend.', date: '02 June 2026' },
    { name: 'Sunita Devi', rating: 5.0, text: 'Excellent work, very professional.', date: '02 June 2026' },
    { name: 'Kiran Bala', rating: 5.0, text: 'Very satisfied with the service.', date: '01 June 2026' },
    { name: 'Deepak Singh', rating: 4.0, text: 'Good but could be better.', date: '01 June 2026' },
    { name: 'Meena Kumari', rating: 5.0, text: 'Outstanding service!', date: '31 May 2026' },
    { name: 'Anjali Gupta', rating: 5.0, text: 'Very happy with the results.', date: '31 May 2026' },
    { name: 'Vikram Nair', rating: 5.0, text: 'Prompt and professional.', date: '30 May 2026' },
    { name: 'Lakshmi R', rating: 5.0, text: 'Will definitely book again.', date: '30 May 2026' },
    { name: 'Suresh Kumar', rating: 4.5, text: 'Nice experience overall.', date: '29 May 2026' },
];

const PER_PAGE = 9;

const getInitials = (name) => name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const getColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

export default function Reviews() {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(ALL_REVIEWS.length / PER_PAGE);
    const reviews = ALL_REVIEWS.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const handlePage = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px' }}>
            <h1 style={{ fontWeight: 800, fontSize: '1.8rem', marginBottom: 28 }}>Recently Added Reviews</h1>

            <div style={{ border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                {reviews.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '20px 24px', borderBottom: i < reviews.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                        {/* Avatar */}
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: getColor(r.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#555', flexShrink: 0 }}>
                            {getInitials(r.name)}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{r.name}</span>
                                    <span style={{ background: '#000000', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        {r.rating.toFixed(1)} ★
                                    </span>
                                </div>
                                <span style={{ fontSize: '13px', color: '#999', flexShrink: 0 }}>{r.date}</span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#555', margin: 0, lineHeight: 1.6 }}>{r.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 32 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => handlePage(p)}
                        style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #ddd', background: p === page ? '#000000' : '#fff', color: p === page ? '#fff' : '#333', fontWeight: p === page ? 700 : 400, fontSize: '14px', cursor: 'pointer' }}>
                        {p}
                    </button>
                ))}
                <button onClick={() => handlePage(Math.min(page + 1, totalPages))}
                    style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: '14px', cursor: 'pointer' }}>
                    ›
                </button>
            </div>
        </div>
    );
}
