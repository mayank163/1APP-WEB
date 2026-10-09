import '../styles/Pagination.css';
import React from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const Pagination = ({ page = 1, totalPages = 1, total = 0, limit = 10, onPageChange, onLimitChange }) => {
    const currentPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
    const firstItem = total === 0 ? 0 : (currentPage - 1) * limit + 1;
    const lastItem = Math.min(currentPage * limit, total);
    const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
        .filter(number => number === 1 || number === totalPages || Math.abs(number - currentPage) <= 1);

    if (total === 0) return null;

    return (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3" aria-label="Pagination">
            <small className="text-muted">Showing {firstItem} to {lastItem} of {total}</small>
            <nav className="d-flex align-items-center gap-1" aria-label="Pages">
                <button type="button" className="btn btn-sm btn-light border" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
                    <FaChevronLeft />
                </button>
                {pageNumbers.map((number, index) => (
                    <React.Fragment key={number}>
                        {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-muted">...</span>}
                        <button type="button" className={`btn btn-sm ${currentPage === number ? 'btn-brand' : 'btn-light border'}`} aria-current={currentPage === number ? 'page' : undefined} onClick={() => onPageChange(number)}>
                            {number}
                        </button>
                    </React.Fragment>
                ))}
                <button type="button" className="btn btn-sm btn-light border" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
                    <FaChevronRight />
                </button>
            </nav>
            <select className="form-select form-select-sm admin-pagination-1"  aria-label="Rows per page" value={limit} onChange={event => onLimitChange(Number(event.target.value))}>
                {[10, 25, 50].map(size => <option key={size} value={size}>{size} per page</option>)}
            </select>
        </div>
    );
};

export default Pagination;
