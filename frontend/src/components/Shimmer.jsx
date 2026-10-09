import { cssValue } from '../utils/cssValue';
import '../styles/Shimmer.css';
/**
 * Shimmer skeleton components — one file, used across all screens.
 * Each exported component matches the real layout of its page.
 */
import React from 'react';

// ── Primitive ────────────────────────────────────────────────────────────────
const S = ({ w = '100%', h = 16, r = 8, style = {}, className = '' }) => (
    <div
        className={`shimmer ui-shimmer-1 ${className}`}
        style={{ "--ui-shimmer-1-width": cssValue(w, "width"), "--ui-shimmer-1-height": cssValue(h, "height"), "--ui-shimmer-1-border-radius": cssValue(r, "borderRadius"), ...style }}
    />
);

// ── Home page ────────────────────────────────────────────────────────────────
export const HomeShimmer = () => (
    <div className="home-page">
        {/* Hero */}
        <div className="ui-shimmer-2" >
            <S h={420} r={32} />
        </div>

        {/* New & Noteworthy */}
        <section className="py-5 bg-white">
            <div className="container">
                <S className="ui-shimmer-3" w={220} h={28}  />
                <div className="ui-shimmer-4" >
                    {Array(5).fill(0).map((_, i) => (
                        <div key={i}>
                            <S className="ui-shimmer-5" h={200} r={16}  />
                            <S h={16} w="80%" />
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Most Booked */}
        <section className="py-5 bg-white">
            <div className="container">
                <S className="ui-shimmer-6" w={240} h={28}  />
                <div className="ui-shimmer-7" >
                    {Array(4).fill(0).map((_, i) => (
                        <div key={i}>
                            <S className="ui-shimmer-8" h={200} r={16}  />
                            <S className="ui-shimmer-9" h={16} w="75%"  />
                            <S className="ui-shimmer-10" h={12} w="50%"  />
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
                    <div className="ui-shimmer-11" >
                        <S w={200} h={28} />
                        <S w={60} h={16} />
                    </div>
                    <div className="ui-shimmer-12" >
                        {Array(4).fill(0).map((_, i) => (
                            <div key={i}>
                                <S className="ui-shimmer-13" h={220} r={16}  />
                                <S className="ui-shimmer-14" h={16} w="70%"  />
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
    <div className="ui-shimmer-15" >
        <div className="ui-shimmer-16" >
            {/* Left sidebar */}
            <div className="ui-shimmer-17" >
                <S className="ui-shimmer-18" h={28} w="75%"  />
                <S className="ui-shimmer-19" h={16} w="55%"  />
                <S className="ui-shimmer-20" h={56} r={12}  />
                <div className="ui-shimmer-21" >
                    {Array(9).fill(0).map((_, i) => (
                        <div className="ui-shimmer-22" key={i} >
                            <S className="ui-shimmer-23" h={48} w={48} r={10}  />
                            <S className="ui-shimmer-24" h={10} w="90%"  />
                        </div>
                    ))}
                </div>
            </div>

            {/* Center */}
            <div>
                <S className="ui-shimmer-25" h={220} r={16}  />
                <S className="ui-shimmer-26" h={22} w="55%"  />
                {Array(3).fill(0).map((_, i) => (
                    <div className="ui-shimmer-27" key={i} >
                        <S className="ui-shimmer-28" w={110} h={110} r={12}  />
                        <div className="ui-shimmer-29" >
                            <S className="ui-shimmer-30" h={18} w="70%"  />
                            <S className="ui-shimmer-31" h={12} w="35%"  />
                            <S className="ui-shimmer-32" h={12} w="90%"  />
                            <S className="ui-shimmer-33" h={12} w="80%"  />
                            <div className="ui-shimmer-34" >
                                <S h={14} w="20%" />
                                <S h={32} w={80} r={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Right */}
            <div className="ui-shimmer-35" >
                <div className="ui-shimmer-36" >
                    <S className="ui-shimmer-37" h={18} w="60%"  />
                    {Array(4).fill(0).map((_, i) => (
                        <div className="ui-shimmer-38" key={i} >
                            <S className="ui-shimmer-39" w={15} h={15} r={50}  />
                            <S h={13} w="80%" />
                        </div>
                    ))}
                </div>
                <div className="ui-shimmer-40" >
                    <S className="ui-shimmer-41" h={22} w="40%"  />
                    <S h={200} r={12} />
                </div>
            </div>
        </div>
    </div>
);

// ── ServiceDetail page ────────────────────────────────────────────────────────
export const ServiceDetailShimmer = () => (
    <div className="ui-shimmer-42" >
        {/* Gallery */}
        <div className="ui-shimmer-43" >
            <S className="ui-shimmer-44" h={260}  />
            <S className="ui-shimmer-45" h={260}  />
        </div>

        {/* Title block */}
        <S className="ui-shimmer-46" h={28} w="65%"  />
        <S className="ui-shimmer-47" h={16} w="30%"  />
        <S className="ui-shimmer-48" h={18} w="25%"  />
        <div className="ui-shimmer-49"  />

        {/* Variants */}
        <S className="ui-shimmer-50" h={18} w="40%"  />
        <div className="ui-shimmer-51" >
            {Array(3).fill(0).map((_, i) => <S key={i} h={80} w={160} r={12} />)}
        </div>
        <div className="ui-shimmer-52"  />

        {/* Process steps */}
        <S className="ui-shimmer-53" h={24} w="35%"  />
        {Array(3).fill(0).map((_, i) => (
            <div className="ui-shimmer-54" key={i} >
                <S className="ui-shimmer-55" w={30} h={30} r={50}  />
                <div className="ui-shimmer-56" >
                    <S className="ui-shimmer-57" h={16} w="50%"  />
                    <S className="ui-shimmer-58" h={12} w="90%"  />
                    <S h={12} w="75%" />
                </div>
            </div>
        ))}
        <div className="ui-shimmer-59"  />

        {/* What's covered */}
        <S className="ui-shimmer-60" h={20} w="35%"  />
        {Array(4).fill(0).map((_, i) => (
            <div className="ui-shimmer-61" key={i} >
                <S w={16} h={16} r={50} />
                <S h={14} w="60%" />
            </div>
        ))}

        {/* Reviews */}
        <div className="ui-shimmer-62" >
            <S className="ui-shimmer-63" h={40} w="25%"  />
            <S className="ui-shimmer-64" h={14} w="15%"  />
            {Array(3).fill(0).map((_, i) => (
                <div className="ui-shimmer-65" key={i} >
                    <S className="ui-shimmer-66" w={40} h={40} r={50}  />
                    <div className="ui-shimmer-67" >
                        <S className="ui-shimmer-68" h={14} w="30%"  />
                        <S className="ui-shimmer-69" h={12} w="85%"  />
                        <S h={12} w="70%" />
                    </div>
                </div>
            ))}
        </div>

        {/* Sticky footer placeholder */}
        <div className="ui-shimmer-70"  />
    </div>
);

// ── Bookings page ─────────────────────────────────────────────────────────────
export const BookingsShimmer = () => (
    <div className="ui-shimmer-71" >
        <div className="ui-shimmer-72" >
            {Array(6).fill(0).map((_, i) => (
                <div className="ui-shimmer-73" key={i} >
                    <div className="ui-shimmer-74" >
                        <S className="ui-shimmer-75" w={70} h={70} r={10}  />
                        <div className="ui-shimmer-76" >
                            <S className="ui-shimmer-77" h={16} w="75%"  />
                            <S className="ui-shimmer-78" h={12} w="50%"  />
                            <S h={12} w="35%" />
                        </div>
                    </div>
                    <S className="ui-shimmer-79" h={1}  />
                    <div className="ui-shimmer-80" >
                        <S h={12} w="40%" />
                        <S h={20} w="25%" r={20} />
                    </div>
                    <div className="ui-shimmer-81" >
                        <S h={12} w="35%" />
                        <S h={12} w="25%" />
                    </div>
                    <S className="ui-shimmer-82" h={38} r={10}  />
                </div>
            ))}
        </div>
    </div>
);

// ── Blogs page ────────────────────────────────────────────────────────────────
export const BlogsShimmer = () => (
    <div className="ui-shimmer-83" >
        <S className="ui-shimmer-84" h={28} w={300}  />

        {/* Hero */}
        <div className="ui-shimmer-85" >
            <div>
                <S className="ui-shimmer-86" h={260} r={12}  />
                <S className="ui-shimmer-87" h={14} w="25%"  />
                <S className="ui-shimmer-88" h={22} w="80%"  />
                <S h={14} w="60%" />
            </div>
            <div className="ui-shimmer-89" >
                {Array(2).fill(0).map((_, i) => (
                    <div className="ui-shimmer-90" key={i} >
                        <S className="ui-shimmer-91" w={110} h={80} r={8}  />
                        <div className="ui-shimmer-92" >
                            <S className="ui-shimmer-93" h={10} w="40%"  />
                            <S className="ui-shimmer-94" h={14} w="90%"  />
                            <S h={12} w="70%" />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Tabs */}
        <div className="ui-shimmer-95" >
            {Array(6).fill(0).map((_, i) => <S key={i} h={32} w={80} r={20} />)}
        </div>

        {/* Scroll rows */}
        {[0, 1].map(r => (
            <div className="ui-shimmer-96" key={r} >
                {Array(5).fill(0).map((_, i) => (
                    <div className="ui-shimmer-97" key={i} >
                        <S className="ui-shimmer-98" h={130} r={10}  />
                        <S className="ui-shimmer-99" h={10} w="40%"  />
                        <S h={13} w="90%" />
                    </div>
                ))}
            </div>
        ))}
    </div>
);

// ── BlogDetail page ───────────────────────────────────────────────────────────
export const BlogDetailShimmer = () => (
    <div className="ui-shimmer-100" >
        <S className="ui-shimmer-101" h={14} w={200}  />
        <S className="ui-shimmer-102" h={36} w="70%"  />
        <S className="ui-shimmer-103" h={16} w="50%"  />
        <S className="ui-shimmer-104" h={2} w={60}  />

        {/* Block 1: full-width image */}
        <S className="ui-shimmer-105" h={380} r={16}  />
        <S className="ui-shimmer-106" h={12} w="30%"  />
        <S className="ui-shimmer-107" h={26} w="60%"  />
        <S className="ui-shimmer-108" h={14} w="80%"  />

        {/* Block 2: side-by-side */}
        <div className="ui-shimmer-109" >
            <S className="ui-shimmer-110" w="45%" h={260} r={12}  />
            <div className="ui-shimmer-111" >
                <S className="ui-shimmer-112" h={12} w="35%"  />
                <S className="ui-shimmer-113" h={22} w="75%"  />
                <S className="ui-shimmer-114" h={14} w="100%"  />
                <S h={14} w="90%" />
            </div>
        </div>
    </div>
);

// ── Profile page ──────────────────────────────────────────────────────────────
export const ProfileShimmer = () => (
    <div className="container py-4">
        <S className="ui-shimmer-115" h={32} w={180}  />
        <S className="ui-shimmer-116" h={4} w={152} r={2}  />
        <div className="row g-4">
            <div className="col-lg-4">
                <div className="card border-0 shadow-sm rounded-4 bg-white p-4 text-center">
                    <S className="ui-shimmer-117" w={100} h={100} r={50}  />
                    <S className="ui-shimmer-118" h={22} w="60%"  />
                    <S className="ui-shimmer-119" h={20} w="30%" r={20}  />
                    <S className="ui-shimmer-120" h={1}  />
                    <div className="ui-shimmer-121" >
                        <S h={14} w="80%" />
                        <S h={14} w="70%" />
                    </div>
                </div>
            </div>
            <div className="col-lg-8">
                <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                    <S className="ui-shimmer-122" h={22} w="50%"  />
                    <div className="row g-3">
                        <div className="col-md-6">
                            <S className="ui-shimmer-123" h={12} w="40%"  />
                            <S h={42} r={8} />
                        </div>
                        <div className="col-md-6">
                            <S className="ui-shimmer-124" h={12} w="40%"  />
                            <S h={42} r={8} />
                        </div>
                        <div className="col-12">
                            <S className="ui-shimmer-125" h={12} w="40%"  />
                            <S h={110} r={8} />
                        </div>
                    </div>
                    <S className="ui-shimmer-126" h={42} w={140} r={8}  />
                </div>
            </div>
        </div>
    </div>
);

// ── Cart page ─────────────────────────────────────────────────────────────────
export const CartShimmer = () => (
    <div className="ui-shimmer-127" >
        <div className="ui-shimmer-128" >
            <div className="ui-shimmer-129" >
                {[80, 100, 80].map((h, i) => <S key={i} h={h} r={14} />)}
            </div>
            <div className="ui-shimmer-130" >
                <S h={180} r={14} />
                <S h={240} r={14} />
            </div>
        </div>
    </div>
);

// ── Checkout page ─────────────────────────────────────────────────────────────
export const CheckoutShimmer = () => (
    <div className="ui-shimmer-131" >
        <div className="ui-shimmer-132" >
            <div className="ui-shimmer-133" >
                <S w={28} h={28} r={50} />
                <S h={28} w={220} />
            </div>
            <div className="ui-shimmer-134" >
                <S h={400} r={14} />
                <div className="ui-shimmer-135" >
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
