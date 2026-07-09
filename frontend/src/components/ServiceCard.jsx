import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { FaClock, FaRupeeSign, FaShoppingCart } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { resolveImageUrl } from '../services/api';

const ServiceCard = ({ service }) => {
    const { addToCart } = useContext(CartContext);

    const handleAddToCart = (e) => {
        e.preventDefault(); // Prevents navigation if the card has a link wrapper
        addToCart(service);
        toast.success(`${service.subcategory?.name || service.name} added to cart!`);
    };

    return (
        <div className="card h-100 shadow-sm border-0 rounded-3 overflow-hidden hover-shadow transition-all">
            <div className="position-relative" style={{ height: '200px' }}>
                <img
                    src={resolveImageUrl(service.imageUrl) || 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400'}
                    alt={service.name}
                    className="w-100 h-100 object-fit-cover"
                />
                <span className="position-absolute top-3 start-3 badge bg-primary bg-gradient shadow-sm px-3 py-2 text-uppercase fs-8 fw-semibold">
                    {service.name}
                </span>
            </div>

            <div className="card-body d-flex flex-column p-4">
                <h5 className="card-title fw-bold text-dark mb-2 text-truncate-2" style={{ height: '48px', lineHeight: '24px' }}>
                    {service.subcategory?.name || service.name}
                </h5>
                <div className="text-muted small fw-semibold mb-2">{service.category?.name || service.category}</div>
                <p className="card-text text-muted mb-4 text-truncate-3" style={{ height: '72px', fontSize: '0.9rem' }}>
                    {service.description}
                </p>

                <div className="d-flex justify-content-between align-items-center mb-4 mt-auto">
                    <div className="d-flex align-items-center gap-1 text-primary fw-bold fs-5">
                        <FaRupeeSign className="fs-6" />
                        <span>{service.price}</span>
                    </div>
                    <div className="d-flex align-items-center gap-1 text-muted small fw-medium">
                        <FaClock />
                        <span>{service.duration} mins</span>
                    </div>
                </div>

                <div className="d-flex gap-2">
                    <Link to={`/service/${service._id}`} className="btn btn-outline-secondary flex-grow-1 fw-semibold py-2">
                        Details
                    </Link>
                    <button
                        onClick={handleAddToCart}
                        className="btn btn-warning flex-grow-1 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                    >
                        <FaShoppingCart />
                        <span>Add</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServiceCard;
