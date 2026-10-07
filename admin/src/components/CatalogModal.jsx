import React, { useId } from 'react';
import { Modal } from 'react-bootstrap';
import { FiUpload } from 'react-icons/fi';
import '../styles/CatalogModal.css';

export const StatusChoices = ({ value, onChange }) => (
    <fieldset className="catalog-modal-status"><legend>Status</legend><div>{['active', 'inactive', 'draft'].map(status => <label key={status} className={value === status ? 'selected' : ''}><input type="radio" name="catalog-status" value={status} checked={value === status} onChange={() => onChange(status)} />{status[0].toUpperCase() + status.slice(1)}</label>)}</div></fieldset>
);
export const IconUpload = ({ label = 'Icon', onChange, preview }) => (
    <label className="catalog-modal-field"><span>{label}</span><span className="catalog-upload">{preview && <img src={preview} alt="Selected icon" />}{label === 'Image' ? 'Upload Image' : 'Upload Icon'} <FiUpload /><input type="file" accept="image/*" onChange={onChange} /></span></label>
);
const CatalogModal = ({ title, onClose, busy = false, alert = false, dialogClassName = '', children }) => {
    const titleId = useId();
    return <Modal show centered onHide={onClose} backdrop={busy ? 'static' : true} keyboard={!busy} aria-labelledby={titleId} dialogClassName={`catalog-modal ${alert ? 'catalog-alert' : ''} ${dialogClassName}`}><Modal.Body><h2 id={titleId}>{title}</h2>{children}</Modal.Body></Modal>;
};
export default CatalogModal;
