import React from 'react';

// ─── Base shimmer block ───────────────────────────────────────────────────────
export const ShimmerBlock = ({ width = '100%', height = 16, className = '', style = {} }) => (
    <div
        className={`shimmer ${className}`}
        style={{ width, height, borderRadius: 6, ...style }}
    />
);

// ─── A full shimmer table row ─────────────────────────────────────────────────
const ShimmerRow = ({ cols }) => (
    <tr>
        {cols.map((w, i) => (
            <td key={i} style={{ padding: '14px 12px' }}>
                <ShimmerBlock width={w} height={14} />
            </td>
        ))}
    </tr>
);

// ─── Generic table shimmer ────────────────────────────────────────────────────
export const ShimmerTable = ({ cols, rows = 6 }) => (
    <div className="table-responsive">
        <table className="table align-middle" style={{ tableLayout: 'fixed' }}>
            <tbody>
                {Array.from({ length: rows }).map((_, i) => (
                    <ShimmerRow key={i} cols={cols} />
                ))}
            </tbody>
        </table>
    </div>
);

// ─── Dashboard stat cards ─────────────────────────────────────────────────────
export const ShimmerStatCards = () => (
    <div className="row g-4 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="col-lg-3 col-sm-6">
                <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <ShimmerBlock width="60%" height={12} />
                        <ShimmerBlock width={34} height={34} style={{ borderRadius: 8, flexShrink: 0 }} />
                    </div>
                    <ShimmerBlock width="50%" height={28} className="mb-2" />
                    <ShimmerBlock width="70%" height={11} />
                </div>
            </div>
        ))}
    </div>
);

// ─── Dashboard chart + queue shimmer ─────────────────────────────────────────
export const ShimmerDashboardCharts = () => (
    <div className="row g-4 mb-4">
        <div className="col-lg-8">
            <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
                <ShimmerBlock width="50%" height={18} className="mb-4" />
                <ShimmerBlock width="100%" height={300} style={{ borderRadius: 10 }} />
            </div>
        </div>
        <div className="col-lg-4">
            <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
                <ShimmerBlock width="60%" height={18} className="mb-4" />
                <div className="d-flex flex-column gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="d-flex justify-content-between align-items-center">
                            <ShimmerBlock width="55%" height={13} />
                            <ShimmerBlock width={36} height={22} style={{ borderRadius: 12 }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// ─── Offer cards shimmer ──────────────────────────────────────────────────────
export const ShimmerOfferCards = ({ count = 3 }) => (
    <div className="row g-4">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="col-md-4">
                <div className="card border-0 shadow-sm rounded-3 p-4 bg-white" style={{ borderTop: '3px solid #e0e0e0' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <ShimmerBlock width="45%" height={26} style={{ borderRadius: 12 }} />
                        <ShimmerBlock width="25%" height={14} />
                    </div>
                    <ShimmerBlock width="60%" height={22} className="mb-2" />
                    <ShimmerBlock width="85%" height={13} className="mb-3" />
                    <ShimmerBlock width="100%" height={34} style={{ borderRadius: 8 }} />
                </div>
            </div>
        ))}
    </div>
);

// ─── Blog list shimmer ────────────────────────────────────────────────────────
export const ShimmerBlogTable = ({ rows = 5 }) => (
    <ShimmerTable
        rows={rows}
        cols={['80px', '35%', '13%', '13%', '6%', '9%', '10%', '8%']}
    />
);

// ─── Category / Subcategory table shimmer ────────────────────────────────────
export const ShimmerCategoryTable = ({ rows = 6 }) => (
    <ShimmerTable
        rows={rows}
        cols={['60px', '35%', '20%', '15%']}
    />
);

// ─── User table shimmer ───────────────────────────────────────────────────────
export const ShimmerUserTable = ({ rows = 7 }) => (
    <ShimmerTable
        rows={rows}
        cols={['20%', '18%', '22%', '15%', '12%']}
    />
);

// ─── Booking table shimmer ────────────────────────────────────────────────────
export const ShimmerBookingTable = ({ rows = 7 }) => (
    <ShimmerTable
        rows={rows}
        cols={['22%', '18%', '12%', '14%', '10%']}
    />
);

// ─── Service table shimmer ────────────────────────────────────────────────────
export const ShimmerServiceTable = ({ rows = 6 }) => (
    <ShimmerTable
        rows={rows}
        cols={['14%', '14%', '22%', '10%', '10%', '8%', '6%', '8%']}
    />
);

// ─── Sub-category (service management) table shimmer ─────────────────────────
export const ShimmerSubcategoryTable = ({ rows = 6 }) => (
    <ShimmerTable
        rows={rows}
        cols={['60px', '50px', '18%', '18%', '12%', '10%', '8%']}
    />
);
