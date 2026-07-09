import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
    return (
        <div className="d-flex flex-column justify-content-center align-items-center py-5 my-5">
            <div className="spinner-border text-dark" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Loading...</span>
            </div>
            {message && <p className="mt-3 text-muted fw-bold">{message}</p>}
        </div>
    );
};

export default LoadingSpinner;
