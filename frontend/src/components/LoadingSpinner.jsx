import '../styles/LoadingSpinner.css';
import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
    return (
        <div className="d-flex flex-column justify-content-center align-items-center py-5 my-5">
            <div className="spinner-border text-primary ui-loadingspinner-1" role="status" >
                <span className="visually-hidden">Loading...</span>
            </div>
            {message && <p className="mt-3 text-muted fw-bold">{message}</p>}
        </div>
    );
};

export default LoadingSpinner;
