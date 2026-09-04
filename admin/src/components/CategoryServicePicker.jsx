import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';

const emptyCategoryInfo = {
  _id: '', name: '',
  subcategory: { _id: '', name: '', service: { _id: '', name: '' } },
};

/**
 * CategoryServicePicker
 * Reads/writes form.categoryInfo as a nested object:
 * {
 *   _id, name,
 *   subcategory: { _id, name, service: { _id, name } }
 * }
 */
const CategoryServicePicker = ({ form, setForm }) => {
  const info = form.categoryInfo || emptyCategoryInfo;

  const [categories,    setCategories]    = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [services,      setServices]      = useState([]);
  const [loadingSub,    setLoadingSub]    = useState(false);
  const [loadingSvc,    setLoadingSvc]    = useState(false);

  // Load categories once
  useEffect(() => {
    adminApi.getCategories()
      .then((res) => setCategories(res.data?.categories || []))
      .catch(() => {});
  }, []);

  // Load subcategories when category changes
  useEffect(() => {
    if (!info._id) { setSubcategories([]); setServices([]); return; }
    setLoadingSub(true);
    adminApi.getSubCategoriesByCategory(info._id)
      .then((res) => setSubcategories(res.data?.subcategories || []))
      .catch(() => setSubcategories([]))
      .finally(() => setLoadingSub(false));
  }, [info._id]);

  // Load services when subcategory changes
  useEffect(() => {
    if (!info.subcategory?._id) { setServices([]); return; }
    setLoadingSvc(true);
    adminApi.getServicesBySubCategory(info.subcategory._id)
      .then((res) => setServices(res.data?.services || []))
      .catch(() => setServices([]))
      .finally(() => setLoadingSvc(false));
  }, [info.subcategory?._id]);

  const setInfo = (patch) =>
    setForm({ ...form, categoryInfo: { ...info, ...patch } });

  const handleCategory = (e) => {
    const id  = e.target.value;
    const cat = categories.find((c) => c._id === id);
    setInfo({ _id: id, name: cat?.name || '', subcategory: { _id: '', name: '', service: { _id: '', name: '' } } });
  };

  const handleSubcategory = (e) => {
    const id  = e.target.value;
    const sub = subcategories.find((s) => s._id === id);
    setInfo({ subcategory: { _id: id, name: sub?.name || '', service: { _id: '', name: '' } } });
  };

  const handleService = (e) => {
    const id = e.target.value;
    if (id === '__manual__') {
      setInfo({ subcategory: { ...info.subcategory, service: { _id: '__manual__', name: '' } } });
    } else {
      const svc = services.find((s) => s._id === id);
      setInfo({ subcategory: { ...info.subcategory, service: { _id: id, name: svc?.name || '' } } });
    }
  };

  const isManualService = info.subcategory?.service?._id === '__manual__';

  return (
    <div className="row g-3">
      {/* Category */}
      <div className="col-md-4">
        <label className="tj-label">Category</label>
        <select className="form-select tj-input" value={info._id || ''} onChange={handleCategory}>
          <option value="">— Select Category —</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {/* Subcategory */}
      {info._id && (
        <div className="col-md-4">
          <label className="tj-label">
            Subcategory
            {loadingSub && <span className="spinner-border spinner-border-sm ms-2" style={{ color: '#A5732F' }} />}
          </label>
          <select
            className="form-select tj-input"
            value={info.subcategory?._id || ''}
            onChange={handleSubcategory}
            disabled={loadingSub}
          >
            <option value="">— Select Subcategory —</option>
            {subcategories.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Service */}
      {info.subcategory?._id && (
        <div className="col-md-4">
          <label className="tj-label">
            Service
            {loadingSvc && <span className="spinner-border spinner-border-sm ms-2" style={{ color: '#A5732F' }} />}
          </label>
          <select
            className="form-select tj-input"
            value={isManualService ? '__manual__' : (info.subcategory?.service?._id || '')}
            onChange={handleService}
            disabled={loadingSvc}
          >
            <option value="">— Select Service —</option>
            {services.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            <option value="__manual__">Other (type manually)</option>
          </select>
        </div>
      )}

      {/* Manual service name input */}
      {isManualService && (
        <div className="col-md-4">
          <label className="tj-label">Service Name</label>
          <input
            className="form-control tj-input"
            placeholder="Type service name…"
            value={info.subcategory?.service?.name || ''}
            onChange={(e) =>
              setInfo({ subcategory: { ...info.subcategory, service: { _id: '__manual__', name: e.target.value } } })
            }
          />
        </div>
      )}
    </div>
  );
};

export default CategoryServicePicker;
