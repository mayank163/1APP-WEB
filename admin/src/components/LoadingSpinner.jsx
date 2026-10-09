import '../styles/LoadingSpinner.css';
import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
    return (
        <div className="d-flex flex-column justify-content-center align-items-center py-5 my-5">
            <div className="spinner-border admin-loading-spinner-1" role="status" >
                <span className="visually-hidden">Loading...</span>
            </div>
            {message && <p className="mt-3 fw-bold admin-loading-spinner-2" >{message}</p>}
        </div>
    );
};

export default LoadingSpinner;
