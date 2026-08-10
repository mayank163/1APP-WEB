import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
    return (
        <div className="d-flex flex-column justify-content-center align-items-center py-5 my-5">
            <div className="spinner-border" role="status" style={{ width: '3rem', height: '3rem', color: '#A5732F' }}>
                <span className="visually-hidden">Loading...</span>
            </div>
            {message && <p className="mt-3 fw-bold" style={{ color: '#A5732F' }}>{message}</p>}
        </div>
    );
};

export default LoadingSpinner;
