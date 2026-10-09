import { cssValue } from '../utils/cssValue';
import '../styles/Reviews.css';
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
        <div className="ui-reviews-1" >
            <h1 className="ui-reviews-2" >Recently Added Reviews</h1>

            <div className="ui-reviews-3" >
                {reviews.map((r, i) => (
                    <div className="ui-reviews-4" key={i} style={{ "--ui-reviews-4-border-bottom": cssValue(i < reviews.length - 1 ? '1px solid #f0f0f0' : 'none', "borderBottom") }}>
                        {/* Avatar */}
                        <div className="ui-reviews-5" style={{ "--ui-reviews-5-background": cssValue(getColor(r.name), "background") }}>
                            {getInitials(r.name)}
                        </div>

                        {/* Content */}
                        <div className="ui-reviews-6" >
                            <div className="ui-reviews-7" >
                                <div className="ui-reviews-8" >
                                    <span className="ui-reviews-9" >{r.name}</span>
                                    <span className="ui-reviews-10" >
                                        {r.rating.toFixed(1)} ★
                                    </span>
                                </div>
                                <span className="ui-reviews-11" >{r.date}</span>
                            </div>
                            <p className="ui-reviews-12" >{r.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="ui-reviews-13" >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button className="ui-reviews-14" key={p} onClick={() => handlePage(p)}
                        style={{ "--ui-reviews-14-background": cssValue(p === page ? "var(--ui-color-27)" : "var(--ui-color-2)", "background"), "--ui-reviews-14-color": cssValue(p === page ? "var(--ui-color-2)" : "var(--ui-color-4)", "color"), "--ui-reviews-14-font-weight": cssValue(p === page ? 700 : 400, "fontWeight") }}>
                        {p}
                    </button>
                ))}
                <button className="ui-reviews-15" onClick={() => handlePage(Math.min(page + 1, totalPages))}
                    >
                    ›
                </button>
            </div>
        </div>
    );
}
