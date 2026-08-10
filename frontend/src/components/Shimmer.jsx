/**
 * Shimmer skeleton components — one file, used across all screens.
 * Each exported component matches the real layout of its page.
 */
import React from 'react';

// ── Primitive ────────────────────────────────────────────────────────────────
const S = ({ w = '100%', h = 16, r = 8, style = {} }) => (
    <div
        className="shimmer"
        style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }}
    />
);

// ── Home page ────────────────────────────────────────────────────────────────
export const HomeShimmer = () => (
    <div className="home-page">
        {/* Hero */}
        <div style={{ padding: '12px' }}>
            <S h={420} r={32} />
        </div>

        {/* New & Noteworthy */}
        <section className="py-5 bg-white">
            <div className="container">
                <S w={220} h={28} style={{ marginBottom: 24 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20 }}>
                    {Array(5).fill(0).map((_, i) => (
                        <div key={i}>
                            <S h={200} r={16} style={{ marginBottom: 12 }} />
                            <S h={16} w="80%" />
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Most Booked */}
        <section className="py-5 bg-white">
            <div className="container">
                <S w={240} h={28} style={{ marginBottom: 24 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i}>
                            <S h={200} r={16} style={{ marginBottom: 12 }} />
                            <S h={16} w="75%" style={{ marginBottom: 8 }} />
                            <S h={12} w="50%" style={{ marginBottom: 6 }} />
                            <S h={14} w="40%" />
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Category section x2 */}
        {[0, 1].map(s => (
            <section key={s} className="py-5 bg-white">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                        <S w={200} h={28} />
                        <S w={60} h={16} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                        {Array(4).fill(0).map((_, i) => (
                            <div key={i}>
                                <S h={220} r={16} style={{ marginBottom: 12 }} />
                                <S h={16} w="70%" style={{ marginBottom: 6 }} />
                                <S h={14} w="35%" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        ))}
    </div>
);

// ── Services page ─────────────────────────────────────────────────────────────
export const ServicesShimmer = () => (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', display: 'grid', gridTemplateColumns: '300px 1fr 280px', gap: 20 }}>
            {/* Left sidebar */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 20 }}>
                <S h={28} w="75%" style={{ marginBottom: 10 }} />
                <S h={16} w="55%" style={{ marginBottom: 20 }} />
                <S h={56} r={12} style={{ marginBottom: 20 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {Array(9).fill(0).map((_, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <S h={48} w={48} r={10} style={{ margin: '0 auto 8px' }} />
                            <S h={10} w="90%" style={{ margin: '0 auto' }} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Center */}
            <div>
                <S h={220} r={16} style={{ marginBottom: 24 }} />
                <S h={22} w="55%" style={{ marginBottom: 16 }} />
                {Array(3).fill(0).map((_, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, display: 'flex', gap: 16 }}>
                        <S w={110} h={110} r={12} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <S h={18} w="70%" style={{ marginBottom: 10 }} />
                            <S h={12} w="35%" style={{ marginBottom: 10 }} />
                            <S h={12} w="90%" style={{ marginBottom: 6 }} />
                            <S h={12} w="80%" style={{ marginBottom: 18 }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <S h={14} w="20%" />
                                <S h={32} w={80} r={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 20 }}>
                    <S h={18} w="60%" style={{ marginBottom: 16 }} />
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                            <S w={15} h={15} r={50} style={{ flexShrink: 0 }} />
                            <S h={13} w="80%" />
                        </div>
                    ))}
                </div>
                <div style={{ background: '#fff', borderRadius: 16, padding: 20 }}>
                    <S h={22} w="40%" style={{ marginBottom: 16 }} />
                    <S h={200} r={12} />
                </div>
            </div>
        </div>
    </div>
);

// ── ServiceDetail page ────────────────────────────────────────────────────────
export const ServiceDetailShimmer = () => (
    <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px 80px' }}>
        {/* Gallery */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <S h={260} style={{ flex: 1, borderRadius: 12 }} />
            <S h={260} style={{ flex: 1, borderRadius: 12 }} />
        </div>

        {/* Title block */}
        <S h={28} w="65%" style={{ marginBottom: 10 }} />
        <S h={16} w="30%" style={{ marginBottom: 8 }} />
        <S h={18} w="25%" style={{ marginBottom: 24 }} />
        <div style={{ height: 1, background: '#eee', marginBottom: 24 }} />

        {/* Variants */}
        <S h={18} w="40%" style={{ marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {Array(3).fill(0).map((_, i) => <S key={i} h={80} w={160} r={12} />)}
        </div>
        <div style={{ height: 1, background: '#eee', marginBottom: 24 }} />

        {/* Process steps */}
        <S h={24} w="35%" style={{ marginBottom: 20 }} />
        {Array(3).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 28 }}>
                <S w={30} h={30} r={50} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <S h={16} w="50%" style={{ marginBottom: 8 }} />
                    <S h={12} w="90%" style={{ marginBottom: 4 }} />
                    <S h={12} w="75%" />
                </div>
            </div>
        ))}
        <div style={{ height: 1, background: '#eee', marginBottom: 24 }} />

        {/* What's covered */}
        <S h={20} w="35%" style={{ marginBottom: 16 }} />
        {Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <S w={16} h={16} r={50} />
                <S h={14} w="60%" />
            </div>
        ))}

        {/* Reviews */}
        <div style={{ marginTop: 32 }}>
            <S h={40} w="25%" style={{ marginBottom: 8 }} />
            <S h={14} w="15%" style={{ marginBottom: 24 }} />
            {Array(3).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid #f0f0f0' }}>
                    <S w={40} h={40} r={50} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <S h={14} w="30%" style={{ marginBottom: 6 }} />
                        <S h={12} w="85%" style={{ marginBottom: 4 }} />
                        <S h={12} w="70%" />
                    </div>
                </div>
            ))}
        </div>

        {/* Sticky footer placeholder */}
        <div style={{ height: 70 }} />
    </div>
);

// ── Bookings page ─────────────────────────────────────────────────────────────
export const BookingsShimmer = () => (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 20px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 360px))', gap: 20, width: '100%', maxWidth: 1140 }}>
            {Array(6).fill(0).map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <S w={70} h={70} r={10} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <S h={16} w="75%" style={{ marginBottom: 8 }} />
                            <S h={12} w="50%" style={{ marginBottom: 6 }} />
                            <S h={12} w="35%" />
                        </div>
                    </div>
                    <S h={1} style={{ background: '#f0f0f0', marginBottom: 14 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <S h={12} w="40%" />
                        <S h={20} w="25%" r={20} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <S h={12} w="35%" />
                        <S h={12} w="25%" />
                    </div>
                    <S h={38} r={10} style={{ marginTop: 16 }} />
                </div>
            ))}
        </div>
    </div>
);

// ── Blogs page ────────────────────────────────────────────────────────────────
export const BlogsShimmer = () => (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
        <S h={28} w={300} style={{ marginBottom: 24 }} />

        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, marginBottom: 32 }}>
            <div>
                <S h={260} r={12} style={{ marginBottom: 12 }} />
                <S h={14} w="25%" style={{ marginBottom: 8 }} />
                <S h={22} w="80%" style={{ marginBottom: 6 }} />
                <S h={14} w="60%" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array(2).fill(0).map((_, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10 }}>
                        <S w={110} h={80} r={8} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <S h={10} w="40%" style={{ marginBottom: 6 }} />
                            <S h={14} w="90%" style={{ marginBottom: 4 }} />
                            <S h={12} w="70%" />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            {Array(6).fill(0).map((_, i) => <S key={i} h={32} w={80} r={20} />)}
        </div>

        {/* Scroll rows */}
        {[0, 1].map(r => (
            <div key={r} style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                {Array(5).fill(0).map((_, i) => (
                    <div key={i} style={{ minWidth: 160, flexShrink: 0 }}>
                        <S h={130} r={10} style={{ marginBottom: 8 }} />
                        <S h={10} w="40%" style={{ marginBottom: 6 }} />
                        <S h={13} w="90%" />
                    </div>
                ))}
            </div>
        ))}
    </div>
);

// ── BlogDetail page ───────────────────────────────────────────────────────────
export const BlogDetailShimmer = () => (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 20px 80px' }}>
        <S h={14} w={200} style={{ margin: '0 auto 16px' }} />
        <S h={36} w="70%" style={{ margin: '0 auto 12px' }} />
        <S h={16} w="50%" style={{ margin: '0 auto 32px' }} />
        <S h={2} w={60} style={{ margin: '0 auto 48px' }} />

        {/* Block 1: full-width image */}
        <S h={380} r={16} style={{ marginBottom: 24 }} />
        <S h={12} w="30%" style={{ marginBottom: 8 }} />
        <S h={26} w="60%" style={{ marginBottom: 12 }} />
        <S h={14} w="80%" style={{ marginBottom: 56 }} />

        {/* Block 2: side-by-side */}
        <div style={{ display: 'flex', gap: 32, background: '#f7f5f2', borderRadius: 16, padding: 24, marginBottom: 56 }}>
            <S w="45%" h={260} r={12} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <S h={12} w="35%" style={{ marginBottom: 10 }} />
                <S h={22} w="75%" style={{ marginBottom: 12 }} />
                <S h={14} w="100%" style={{ marginBottom: 6 }} />
                <S h={14} w="90%" />
            </div>
        </div>
    </div>
);

// ── Profile page ──────────────────────────────────────────────────────────────
export const ProfileShimmer = () => (
    <div className="container py-4">
        <S h={32} w={180} style={{ marginBottom: 6 }} />
        <S h={4} w={152} r={2} style={{ marginBottom: 32 }} />
        <div className="row g-4">
            <div className="col-lg-4">
                <div className="card border-0 shadow-sm rounded-4 bg-white p-4 text-center">
                    <S w={100} h={100} r={50} style={{ margin: '0 auto 16px' }} />
                    <S h={22} w="60%" style={{ margin: '0 auto 8px' }} />
                    <S h={20} w="30%" r={20} style={{ margin: '0 auto 24px' }} />
                    <S h={1} style={{ marginBottom: 16 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <S h={14} w="80%" />
                        <S h={14} w="70%" />
                    </div>
                </div>
            </div>
            <div className="col-lg-8">
                <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                    <S h={22} w="50%" style={{ marginBottom: 24 }} />
                    <div className="row g-3">
                        <div className="col-md-6">
                            <S h={12} w="40%" style={{ marginBottom: 6 }} />
                            <S h={42} r={8} />
                        </div>
                        <div className="col-md-6">
                            <S h={12} w="40%" style={{ marginBottom: 6 }} />
                            <S h={42} r={8} />
                        </div>
                        <div className="col-12">
                            <S h={12} w="40%" style={{ marginBottom: 6 }} />
                            <S h={110} r={8} />
                        </div>
                    </div>
                    <S h={42} w={140} r={8} style={{ marginTop: 16 }} />
                </div>
            </div>
        </div>
    </div>
);

// ── Cart page ─────────────────────────────────────────────────────────────────
export const CartShimmer = () => (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[80, 100, 80].map((h, i) => <S key={i} h={h} r={14} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <S h={180} r={14} />
                <S h={240} r={14} />
            </div>
        </div>
    </div>
);

// ── Checkout page ─────────────────────────────────────────────────────────────
export const CheckoutShimmer = () => (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '28px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <S w={28} h={28} r={50} />
                <S h={28} w={220} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
                <S h={400} r={14} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <S h={120} r={14} />
                    <S h={260} r={14} />
                </div>
            </div>
        </div>
    </div>
);

export default {
    HomeShimmer,
    ServicesShimmer,
    ServiceDetailShimmer,
    BookingsShimmer,
    BlogsShimmer,
    BlogDetailShimmer,
    ProfileShimmer,
    CartShimmer,
    CheckoutShimmer,
};
