import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { getImageUrl } from '../utils/helpers';
import {
    FaPlus, FaEdit, FaTrash, FaLayerGroup, FaDollarSign,
    FaClock, FaCheckCircle, FaTimesCircle, FaCopy,
    FaList, FaQuestion, FaImage, FaTools, FaStar,
    FaPercentage, FaTag, FaFileImage, FaVideo
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const SubcategoryManagement = () => {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [filteredSubcategories, setFilteredSubcategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');

    // Main form fields
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
    const [serviceName, setServiceName] = useState('');
    const [shortDescriptionPoints, setShortDescriptionPoints] = useState([]);
    const [newShortDescriptionPoint, setNewShortDescriptionPoint] = useState('');
    const [longDescription, setLongDescription] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [status, setStatus] = useState('active');
    const [isFeatured, setIsFeatured] = useState(false);
    const [serviceDuration, setServiceDuration] = useState('');
    const [hasVariants, setHasVariants] = useState(false);
    
    // Pricing (non-variant)
    const [actualPrice, setActualPrice] = useState('');
    const [discountPercentage, setDiscountPercentage] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    
    // Variants
    const [variants, setVariants] = useState([]);
    const [variantForm, setVariantForm] = useState({
        name: '',
        sizeCapacity: '',
        unit: '',
        actualPrice: '',
        discountPercentage: '',
        offerPrice: '',
        duration: ''
    });
    const [editingVariantIndex, setEditingVariantIndex] = useState(null);
    
    // Add-ons
    const [addons, setAddons] = useState([]);
    const [addonForm, setAddonForm] = useState({
        name: '',
        description: '',
        price: ''
    });
    const [editingAddonIndex, setEditingAddonIndex] = useState(null);
    
    // Included/Excluded items
    const [includedItems, setIncludedItems] = useState([]);
    const [excludedItems, setExcludedItems] = useState([]);
    const [newIncludedItem, setNewIncludedItem] = useState('');
    const [newExcludedItem, setNewExcludedItem] = useState('');
    
    // FAQs
    const [faqs, setFaqs] = useState([]);
    const [faqForm, setFaqForm] = useState({
        question: '',
        answer: '',
        order: 0
    });
    const [editingFaqIndex, setEditingFaqIndex] = useState(null);
    
    // Media
    const [featuredImage, setFeaturedImage] = useState('');
    const [featuredImageFile, setFeaturedImageFile] = useState(null);
    const [gallery, setGallery] = useState([]);
    const [galleryImageFiles, setGalleryImageFiles] = useState([]); // File objects parallel to gallery array
    const [galleryForm, setGalleryForm] = useState({
        type: 'image',
        url: '',
        order: 0,
        _file: null
    });
    const [editingGalleryIndex, setEditingGalleryIndex] = useState(null);
    
    // Requirements & Tools
    const [requirements, setRequirements] = useState([]);
    const [requirementImageFiles, setRequirementImageFiles] = useState([]);
    const [newRequirement, setNewRequirement] = useState('');
    const [newRequirementFile, setNewRequirementFile] = useState(null);
    const [newRequirementPreview, setNewRequirementPreview] = useState('');
    const [tools, setTools] = useState([]);
    const [toolImageFiles, setToolImageFiles] = useState([]);
    const [toolForm, setToolForm] = useState({ name: '', description: '', image: '', _file: null });
    const [editingToolIndex, setEditingToolIndex] = useState(null);

    // Process Steps
    const [processSteps, setProcessSteps] = useState([]);
    const [processStepImageFiles, setProcessStepImageFiles] = useState([]);
    const [processStepForm, setProcessStepForm] = useState({ title: '', description: '', image: '', _file: null, _preview: '' });
    const [editingStepIndex, setEditingStepIndex] = useState(null);
    
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [svcRes, catRes, subRes] = await Promise.all([
                adminApi.getServices(),
                adminApi.getCategories(),
                adminApi.getSubCategories()
            ]);
            if (svcRes.success) setServices(svcRes.data.services.filter(s => s.status !== 'inactive' && s.isActive !== false));
            if (catRes.success) setCategories(catRes.data.categories);
            if (subRes.success) setSubcategories(subRes.data.subcategories);
        } catch {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Filter subcategories when category changes
    useEffect(() => {
        if (selectedCategoryId) {
            setFilteredSubcategories(subcategories.filter(s => s.category?._id === selectedCategoryId));
            setSelectedSubcategoryId('');
        } else {
            setFilteredSubcategories([]);
        }
    }, [selectedCategoryId, subcategories]);

    // Calculate offer price when actual price or discount percentage changes
    useEffect(() => {
        if (actualPrice && discountPercentage) {
            const calcOfferPrice = parseFloat(actualPrice) - (parseFloat(actualPrice) * parseFloat(discountPercentage) / 100);
            setOfferPrice(Math.round(calcOfferPrice * 100) / 100);
        } else if (actualPrice) {
            setOfferPrice(parseFloat(actualPrice));
        } else {
            setOfferPrice('');
        }
    }, [actualPrice, discountPercentage]);

    // Calculate variant offer price
    useEffect(() => {
        if (variantForm.actualPrice && variantForm.discountPercentage) {
            const calcOfferPrice = parseFloat(variantForm.actualPrice) - (parseFloat(variantForm.actualPrice) * parseFloat(variantForm.discountPercentage) / 100);
            setVariantForm(prev => ({
                ...prev,
                offerPrice: Math.round(calcOfferPrice * 100) / 100
            }));
        } else if (variantForm.actualPrice) {
            setVariantForm(prev => ({
                ...prev,
                offerPrice: parseFloat(variantForm.actualPrice)
            }));
        }
    }, [variantForm.actualPrice, variantForm.discountPercentage]);

    const resetForm = () => {
        setEditingId(null);
        setSelectedCategoryId('');
        setSelectedSubcategoryId('');
        setServiceName('');
        setShortDescriptionPoints([]);
        setNewShortDescriptionPoint('');
        setLongDescription('');
        setServiceType('');
        setStatus('active');
        setIsFeatured(false);
        setServiceDuration('');
        setHasVariants(false);
        setActualPrice('');
        setDiscountPercentage('');
        setOfferPrice('');
        setVariants([]);
        setAddons([]);
        setIncludedItems([]);
        setExcludedItems([]);
        setFaqs([]);
        setFeaturedImage('');
        setFeaturedImageFile(null);
        setGallery([]);
        setRequirements([]);
        setTools([]);
        setProcessSteps([]);
        setProcessStepImageFiles([]);
        setProcessStepForm({ title: '', description: '', image: '', _file: null, _preview: '' });
        setEditingStepIndex(null);

        // Reset nested forms
        setVariantForm({ name: '', sizeCapacity: '', unit: '', actualPrice: '', discountPercentage: '', offerPrice: '', duration: '' });
        setAddonForm({ name: '', description: '', price: '' });
        setFaqForm({ question: '', answer: '', order: 0 });
        setGalleryImageFiles([]);
        setToolImageFiles([]);
        setRequirementImageFiles([]);
        setNewRequirement('');
        setNewRequirementFile(null);
        setNewRequirementPreview('');
        setGalleryForm({ type: 'image', url: '', order: 0, _file: null });
        setToolForm({ name: '', description: '', image: '', _file: null });
        setEditingVariantIndex(null);
        setEditingAddonIndex(null);
        setEditingFaqIndex(null);
        setEditingGalleryIndex(null);
        setEditingToolIndex(null);
    };

    const handleOpenCreate = () => { resetForm(); setShowForm(true); };

    const handleOpenEdit = (svc) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditingId(svc._id);
    const catId = svc.category?._id || '';
    setSelectedCategoryId(catId);
    setFilteredSubcategories(subcategories.filter(s => s.category?._id === catId));
    setSelectedSubcategoryId(svc.subcategory?._id || '');
    setServiceName(svc.name || '');
    setShortDescriptionPoints(svc.shortDescription || []);
    setNewShortDescriptionPoint('');
    setLongDescription(svc.longDescription || '');
    setServiceType(svc.serviceType || '');
    setStatus(svc.status || 'active');
    setIsFeatured(svc.isFeatured || false);
    setServiceDuration(svc.serviceDuration || '');
    setHasVariants(svc.hasVariants || false);
    
    // FIX: Ensure prices are properly set as strings for form inputs
    setActualPrice(svc.actualPrice?.toString() || '');
    setDiscountPercentage(svc.discountPercentage?.toString() || '');
    setOfferPrice(svc.offerPrice?.toString() || '');
    
    setVariants(svc.variants || []);
    setAddons(svc.addons || []);
    setIncludedItems(svc.includedItems || []);
    setExcludedItems(svc.excludedItems || []);
    setFaqs(svc.faqs || []);
    setFeaturedImage(svc.featuredImage || '');
    setFeaturedImageFile(null);
    setGallery(svc.gallery || []);
    setGalleryImageFiles((svc.gallery || []).map(() => null));
    setRequirements(svc.requirements || []);
    setRequirementImageFiles((svc.requirements || []).map(() => null));
    setTools(svc.tools || []);
    setToolImageFiles((svc.tools || []).map(() => null));
    setProcessSteps(svc.processSteps || []);
    setProcessStepImageFiles((svc.processSteps || []).map(() => null));
    setShowForm(true);
};

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this service?')) return;
        try {
            const res = await adminApi.deleteService(id);
            if (res.success) { toast.success('Service deleted!'); fetchData(); }
        } catch { toast.error('Deletion failed'); }
    };

    // Short Description Points handlers
    const handleAddShortDescriptionPoint = () => {
        if (!newShortDescriptionPoint.trim()) return;
        if (shortDescriptionPoints.length >= 3) {
            toast.error('Maximum 3 points allowed');
            return;
        }
        setShortDescriptionPoints([...shortDescriptionPoints, newShortDescriptionPoint.trim()]);
        setNewShortDescriptionPoint('');
    };

    const handleRemoveShortDescriptionPoint = (index) => {
        setShortDescriptionPoints(shortDescriptionPoints.filter((_, i) => i !== index));
    };

    // Variant handlers
    const handleAddVariant = () => {
        if (!variantForm.name || !variantForm.actualPrice) {
            toast.error('Variant name and price are required');
            return;
        }
        const newVariant = {
            ...variantForm,
            actualPrice: Number(variantForm.actualPrice),
            discountPercentage: Number(variantForm.discountPercentage) || 0,
            offerPrice: Number(variantForm.offerPrice) || Number(variantForm.actualPrice),
            duration: Number(variantForm.duration) || 0,
            isActive: true
        };

        if (editingVariantIndex !== null) {
            const updated = [...variants];
            updated[editingVariantIndex] = newVariant;
            setVariants(updated);
            setEditingVariantIndex(null);
        } else {
            setVariants([...variants, newVariant]);
        }
        setVariantForm({ name: '', sizeCapacity: '', unit: '', actualPrice: '', discountPercentage: '', offerPrice: '', duration: '' });
    };

    const handleEditVariant = (index) => {
        setVariantForm(variants[index]);
        setEditingVariantIndex(index);
    };

    const handleRemoveVariant = (index) => {
        setVariants(variants.filter((_, i) => i !== index));
        if (editingVariantIndex === index) {
            setEditingVariantIndex(null);
            setVariantForm({ name: '', sizeCapacity: '', unit: '', actualPrice: '', discountPercentage: '', offerPrice: '', duration: '' });
        }
    };

    // Add-on handlers
    const handleAddAddon = () => {
        if (!addonForm.name || !addonForm.price) {
            toast.error('Add-on name and price are required');
            return;
        }
        if (editingAddonIndex !== null) {
            const updated = [...addons];
            updated[editingAddonIndex] = { ...addonForm, price: Number(addonForm.price) };
            setAddons(updated);
            setEditingAddonIndex(null);
        } else {
            setAddons([...addons, { ...addonForm, price: Number(addonForm.price), isActive: true }]);
        }
        setAddonForm({ name: '', description: '', price: '' });
    };

    const handleEditAddon = (index) => {
        setAddonForm(addons[index]);
        setEditingAddonIndex(index);
    };

    const handleRemoveAddon = (index) => {
        setAddons(addons.filter((_, i) => i !== index));
        if (editingAddonIndex === index) {
            setEditingAddonIndex(null);
            setAddonForm({ name: '', description: '', price: '' });
        }
    };

    // FAQ handlers
    const handleAddFaq = () => {
        if (!faqForm.question || !faqForm.answer) {
            toast.error('FAQ question and answer are required');
            return;
        }
        if (editingFaqIndex !== null) {
            const updated = [...faqs];
            updated[editingFaqIndex] = { ...faqForm, order: Number(faqForm.order) || 0 };
            setFaqs(updated);
            setEditingFaqIndex(null);
        } else {
            setFaqs([...faqs, { ...faqForm, order: Number(faqForm.order) || 0 }]);
        }
        setFaqForm({ question: '', answer: '', order: 0 });
    };

    const handleEditFaq = (index) => {
        setFaqForm(faqs[index]);
        setEditingFaqIndex(index);
    };

    const handleRemoveFaq = (index) => {
        setFaqs(faqs.filter((_, i) => i !== index));
        if (editingFaqIndex === index) {
            setEditingFaqIndex(null);
            setFaqForm({ question: '', answer: '', order: 0 });
        }
    };

    // Gallery handlers
    const handleAddGalleryItem = () => {
        if (galleryForm.type === 'image' && !galleryForm._file && !galleryForm.url) {
            toast.error('Please select an image file');
            return;
        }
        if (galleryForm.type !== 'image' && !galleryForm.url) {
            toast.error('URL is required for video/youtube/vimeo');
            return;
        }
        const item = { type: galleryForm.type, url: galleryForm.url, order: Number(galleryForm.order) || 0 };
        if (editingGalleryIndex !== null) {
            const updatedGallery = [...gallery];
            updatedGallery[editingGalleryIndex] = item;
            setGallery(updatedGallery);
            const updatedFiles = [...galleryImageFiles];
            updatedFiles[editingGalleryIndex] = galleryForm._file || galleryImageFiles[editingGalleryIndex];
            setGalleryImageFiles(updatedFiles);
            setEditingGalleryIndex(null);
        } else {
            setGallery([...gallery, item]);
            setGalleryImageFiles([...galleryImageFiles, galleryForm._file || null]);
        }
        setGalleryForm({ type: 'image', url: '', order: 0, _file: null });
    };

    const handleEditGallery = (index) => {
        setGalleryForm({ ...gallery[index], _file: galleryImageFiles[index] || null });
        setEditingGalleryIndex(index);
    };

    const handleRemoveGallery = (index) => {
        setGallery(gallery.filter((_, i) => i !== index));
        setGalleryImageFiles(galleryImageFiles.filter((_, i) => i !== index));
        if (editingGalleryIndex === index) {
            setEditingGalleryIndex(null);
            setGalleryForm({ type: 'image', url: '', order: 0, _file: null });
        }
    };

    // Tool handlers
    const handleAddTool = () => {
        if (!toolForm.name) {
            toast.error('Tool name is required');
            return;
        }
        const tool = { name: toolForm.name, description: toolForm.description, image: toolForm.image };
        if (editingToolIndex !== null) {
            const updatedTools = [...tools];
            updatedTools[editingToolIndex] = tool;
            setTools(updatedTools);
            const updatedFiles = [...toolImageFiles];
            updatedFiles[editingToolIndex] = toolForm._file || toolImageFiles[editingToolIndex];
            setToolImageFiles(updatedFiles);
            setEditingToolIndex(null);
        } else {
            setTools([...tools, tool]);
            setToolImageFiles([...toolImageFiles, toolForm._file || null]);
        }
        setToolForm({ name: '', description: '', image: '', _file: null });
    };

    const handleEditTool = (index) => {
        setToolForm({ ...tools[index], _file: toolImageFiles[index] || null });
        setEditingToolIndex(index);
    };

    const handleRemoveTool = (index) => {
        setTools(tools.filter((_, i) => i !== index));
        setToolImageFiles(toolImageFiles.filter((_, i) => i !== index));
        if (editingToolIndex === index) {
            setEditingToolIndex(null);
            setToolForm({ name: '', description: '', image: '', _file: null });
        }
    };

    // List item handlers
    const handleAddIncludedItem = () => {
        if (!newIncludedItem.trim()) return;
        setIncludedItems([...includedItems, { title: newIncludedItem.trim(), icon: '' }]);
        setNewIncludedItem('');
    };

    const handleRemoveIncludedItem = (index) => {
        setIncludedItems(includedItems.filter((_, i) => i !== index));
    };

    const handleAddExcludedItem = () => {
        if (!newExcludedItem.trim()) return;
        setExcludedItems([...excludedItems, { title: newExcludedItem.trim(), icon: '' }]);
        setNewExcludedItem('');
    };

    const handleRemoveExcludedItem = (index) => {
        setExcludedItems(excludedItems.filter((_, i) => i !== index));
    };

    // Process Step handlers
    const handleProcessStepImageSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setProcessStepForm(prev => ({
            ...prev,
            _file: file,
            _preview: URL.createObjectURL(file),
            image: URL.createObjectURL(file),
        }));
    };

    const handleAddProcessStep = () => {
        if (!processStepForm.title.trim()) {
            toast.error('Step title is required');
            return;
        }
        const step = {
            stepNumber: editingStepIndex !== null ? processSteps[editingStepIndex].stepNumber : processSteps.length + 1,
            title: processStepForm.title.trim(),
            description: processStepForm.description.trim(),
            image: processStepForm.image,
        };
        if (editingStepIndex !== null) {
            const updatedSteps = [...processSteps];
            updatedSteps[editingStepIndex] = step;
            setProcessSteps(updatedSteps);
            const updatedFiles = [...processStepImageFiles];
            updatedFiles[editingStepIndex] = processStepForm._file || processStepImageFiles[editingStepIndex];
            setProcessStepImageFiles(updatedFiles);
            setEditingStepIndex(null);
        } else {
            setProcessSteps(prev => [...prev, step]);
            setProcessStepImageFiles(prev => [...prev, processStepForm._file || null]);
        }
        setProcessStepForm({ title: '', description: '', image: '', _file: null, _preview: '' });
    };

    const handleEditProcessStep = (index) => {
        const step = processSteps[index];
        setProcessStepForm({
            title: step.title,
            description: step.description || '',
            image: step.image || '',
            _file: processStepImageFiles[index] || null,
            _preview: step.image ? (step.image.startsWith('blob:') ? step.image : getImageUrl(step.image)) : '',
        });
        setEditingStepIndex(index);
    };

    const handleRemoveProcessStep = (index) => {
        const updated = processSteps.filter((_, i) => i !== index)
            .map((s, i) => ({ ...s, stepNumber: i + 1 }));
        setProcessSteps(updated);
        setProcessStepImageFiles(processStepImageFiles.filter((_, i) => i !== index));
        if (editingStepIndex === index) {
            setEditingStepIndex(null);
            setProcessStepForm({ title: '', description: '', image: '', _file: null, _preview: '' });
        }
    };

    const handleAddRequirement = () => {
        if (!newRequirement.trim()) return;
        setRequirements([...requirements, { title: newRequirement.trim(), image: newRequirementPreview }]);
        setRequirementImageFiles([...requirementImageFiles, newRequirementFile || null]);
        setNewRequirement('');
        setNewRequirementFile(null);
        setNewRequirementPreview('');
    };

    const handleRemoveRequirement = (index) => {
        setRequirements(requirements.filter((_, i) => i !== index));
        setRequirementImageFiles(requirementImageFiles.filter((_, i) => i !== index));
    };

    const handleRequirementImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewRequirementFile(file);
            setNewRequirementPreview(URL.createObjectURL(file));
        }
    };

    // Handle file selection for gallery
    const handleGalleryFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setGalleryForm({ ...galleryForm, url, _file: file });
        }
    };

    // Handle file selection for tool image
    const handleToolImageFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setToolForm({ ...toolForm, image: url, _file: file });
        }
    };

    // Handle file selection for featured image
    const handleFeaturedImageFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFeaturedImageFile(file);
            const url = URL.createObjectURL(file);
            setFeaturedImage(url);
        }
    };

   const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCategoryId || !selectedSubcategoryId || !serviceName.trim()) {
        toast.error('Category, Subcategory, and Name are required!');
        return;
    }
    
    if (shortDescriptionPoints.length === 0) {
        toast.error('Please add at least one short description point');
        return;
    }
    
    if (!hasVariants && !actualPrice) {
        toast.error('Please set the actual price');
        return;
    }
    
    if (hasVariants && variants.length === 0) {
        toast.error('Please add at least one variant');
        return;
    }
    
    setSubmitting(true);
    try {
        const formData = new FormData();
        formData.append('name', serviceName);
        formData.append('shortDescription', JSON.stringify(shortDescriptionPoints));
        formData.append('longDescription', longDescription || '');
        formData.append('category', selectedCategoryId);
        formData.append('subcategory', selectedSubcategoryId);
        formData.append('serviceType', serviceType || '');
        formData.append('status', status);
        formData.append('isFeatured', isFeatured);
        formData.append('serviceDuration', serviceDuration || 0);
        formData.append('hasVariants', hasVariants);
        
        // FIX: Always send pricing data, even for non-variant
        if (!hasVariants) {
            // Make sure to send actualPrice as a number
            const priceValue = parseFloat(actualPrice) || 0;
            const discountValue = parseFloat(discountPercentage) || 0;
            
            // Calculate offer price on the frontend to ensure it's sent
            let offerValue = priceValue;
            if (discountValue > 0) {
                offerValue = priceValue - (priceValue * discountValue / 100);
                offerValue = Math.round(offerValue * 100) / 100;
            }
            
            formData.append('actualPrice', priceValue.toString());
            formData.append('discountPercentage', discountValue.toString());
            formData.append('offerPrice', offerValue.toString());
        } else {
            // For variants, we still need to set these to 0 or default values
            formData.append('actualPrice', '0');
            formData.append('discountPercentage', '0');
            formData.append('offerPrice', '0');
        }
        
        // Append variants as JSON
        formData.append('variants', JSON.stringify(variants));
        
        // Append add-ons as JSON
        formData.append('addons', JSON.stringify(addons));
        
        // Append lists as JSON
        formData.append('includedItems', JSON.stringify(includedItems));
        formData.append('excludedItems', JSON.stringify(excludedItems));
        
        // Append FAQs as JSON
        formData.append('faqs', JSON.stringify(faqs));
        
        // Append gallery as JSON (blob urls will be replaced by backend via uploaded files)
        formData.append('gallery', JSON.stringify(gallery));
        // Append gallery image files
        galleryImageFiles.forEach(file => {
            if (file) formData.append('galleryImages', file);
        });
        
        // Append requirements and tools as JSON
        formData.append('requirements', JSON.stringify(requirements));
        // Append requirement image files
        requirementImageFiles.forEach(file => {
            if (file) formData.append('requirementImages', file);
        });
        formData.append('tools', JSON.stringify(tools));
        // Append tool image files
        toolImageFiles.forEach(file => {
            if (file) formData.append('toolImages', file);
        });

        // Append process steps as JSON
        // Mark steps that have a NEW file to upload with __new__ so the
        // controller only assigns an uploaded file to those slots, preserving
        // the correct index even when some steps have no image.
        formData.append('processSteps', JSON.stringify(processSteps.map((s, i) => ({
            stepNumber: s.stepNumber,
            title: s.title,
            description: s.description || '',
            image: processStepImageFiles[i]
                ? '__new__'                                          // new file coming
                : (s.image && !s.image.startsWith('blob:') ? s.image : ''), // keep existing or empty
        }))));
        // Append ONLY the new process step image files (parallel to __new__ slots)
        processStepImageFiles.forEach(file => {
            if (file) formData.append('processStepImages', file);
        });
        
        if (featuredImageFile) {
            formData.append('featuredImage', featuredImageFile);
        } else if (featuredImage && !featuredImage.startsWith('blob:')) {
            formData.append('featuredImageUrl', featuredImage);
        }

        let res;
        if (editingId) {
            res = await adminApi.updateService(editingId, formData);
            if (res.success) toast.success('Service updated!');
        } else {
            res = await adminApi.createService(formData);
            if (res.success) toast.success('Service created!');
        }
        setShowForm(false);
        fetchData();
        if (editingId) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to save service');
    } finally {
        setSubmitting(false);
    }
};

    // Helper to get display price
    const getDisplayPrice = (svc) => {
        if (svc.hasVariants && svc.variants?.length) {
            const prices = svc.variants.map(v => v.offerPrice || v.actualPrice);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            return min === max ? `$${min}` : `$${min} - $${max}`;
        }
        return `$${svc.offerPrice || svc.actualPrice || 0}`;
    };

    const getDisplayDuration = (svc) => {
        if (svc.hasVariants && svc.variants?.length) {
            const durations = svc.variants.map(v => v.duration).filter(d => d > 0);
            if (durations.length === 0) return svc.serviceDuration ? `${svc.serviceDuration} min` : '—';
            const max = Math.max(...durations);
            return `${max} min`;
        }
        return svc.serviceDuration ? `${svc.serviceDuration} min` : '—';
    };

    const filteredServices = [...services]
    .filter((svc) => {
        const keyword = searchTerm.toLowerCase();

        return (
            svc.name?.toLowerCase().includes(keyword) ||
            svc.category?.name?.toLowerCase().includes(keyword) ||
            svc.subcategory?.name?.toLowerCase().includes(keyword) ||
            svc.serviceType?.toLowerCase().includes(keyword)
        );
    })
    .sort((a, b) => {
        const first = a.name.toLowerCase();
        const second = b.name.toLowerCase();

        return sortOrder === 'asc'
            ? first.localeCompare(second)
            : second.localeCompare(first);
    });

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-extrabold text-dark mb-1">Service Management</h1>
                    <p className="text-muted">Manage services with variants, add-ons, FAQs, and more</p>
                </div>
                {!showForm && (
                    <button onClick={handleOpenCreate} className="btn btn-dark fw-bold d-flex align-items-center gap-2 px-4 shadow-sm">
                        <FaPlus /><span>Add Service</span>
                    </button>
                )}
            </div>

            {showForm && (
                <div className="card border-0 shadow-sm rounded-3 bg-white p-4 mb-4">
                    <h5 className="fw-bold mb-4 border-bottom pb-2">
                        {editingId ? 'Edit Service' : 'Create New Service'}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        {/* Basic Information */}
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Service Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="form-control bg-light border-0"
                                    placeholder="e.g., Deep Cleaning Service"
                                    value={serviceName}
                                    onChange={(e) => setServiceName(e.target.value)}
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Service Type</label>
                                <input
                                    type="text"
                                    className="form-control bg-light border-0"
                                    placeholder="e.g., Premium, Standard"
                                    value={serviceType}
                                    onChange={(e) => setServiceType(e.target.value)}
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted small fw-bold">Category *</label>
                                <select
                                    required
                                    className="form-select bg-light border-0"
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                >
                                    <option value="">Choose category...</option>
                                    {categories.map(cat => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted small fw-bold">Sub-Category *</label>
                                <select
                                    required
                                    className="form-select bg-light border-0"
                                    value={selectedSubcategoryId}
                                    onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                                    disabled={!selectedCategoryId}
                                >
                                    <option value="">Choose sub-category...</option>
                                    {filteredSubcategories.map(sub => (
                                        <option key={sub._id} value={sub._id}>{sub.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted small fw-bold">Status</label>
                                <select
                                    className="form-select bg-light border-0"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="draft">Draft</option>
                                </select>
                            </div>
                            
                            {/* Short Description Points */}
                            <div className="col-md-12">
                                <label className="form-label text-muted small fw-bold">
                                    Short Description Points * (Max 3)
                                </label>
                                <div className="d-flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        
                                        className="form-control bg-light border-0"
                                        placeholder="Add a point..."
                                        value={newShortDescriptionPoint}
                                        onChange={(e) => setNewShortDescriptionPoint(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddShortDescriptionPoint())}
                                        disabled={shortDescriptionPoints.length >= 3}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleAddShortDescriptionPoint} 
                                        className="btn btn-sm btn-dark"
                                        disabled={shortDescriptionPoints.length >= 3}
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                    {shortDescriptionPoints.map((point, i) => (
                                        <span key={i} className="badge bg-primary text-white p-2">
                                            {i + 1}. {point}
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveShortDescriptionPoint(i)} 
                                                className="btn btn-sm btn-link text-white p-0 ms-2"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="col-md-12">
                                <label className="form-label text-muted small fw-bold">Long Description</label>
                                <textarea
                                    rows="3"
                                    className="form-control bg-light border-0"
                                    placeholder="Detailed description of the service"
                                    value={longDescription}
                                    onChange={(e) => setLongDescription(e.target.value)}
                                />
                            </div>
                            
                            <div className="col-md-4">
                                <label className="form-label text-muted small fw-bold">
                                    <FaClock className="me-1" /> Service Duration (Minutes) *
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    className="form-control bg-light border-0"
                                    placeholder="e.g., 60"
                                    value={serviceDuration}
                                    onChange={(e) => setServiceDuration(e.target.value)}
                                />
                            </div>
                            
                            <div className="col-md-4">
                                <div className="form-check mt-4">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id="isFeatured"
                                        checked={isFeatured}
                                        onChange={(e) => setIsFeatured(e.target.checked)}
                                    />
                                    <label className="form-check-label" htmlFor="isFeatured">
                                        Featured Service
                                    </label>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="form-check mt-4">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id="hasVariants"
                                        checked={hasVariants}
                                        onChange={(e) => {
                                            setHasVariants(e.target.checked);
                                            if (!e.target.checked) {
                                                setVariants([]);
                                            }
                                        }}
                                    />
                                    <label className="form-check-label" htmlFor="hasVariants">
                                        Has Variants (Size/Capacity options)
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Pricing Section */}
                        {!hasVariants ? (
                            <div className="row g-3 mb-4">
                                <div className="col-md-4">
                                    <label className="form-label text-muted small fw-bold">
                                        <FaDollarSign className="me-1" /> Actual Price *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="1"
                                        className="form-control bg-light border-0"
                                        placeholder="799"
                                        value={actualPrice}
                                        onChange={(e) => setActualPrice(e.target.value)}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small fw-bold">
                                        <FaPercentage className="me-1" /> Discount Percentage
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        className="form-control bg-light border-0"
                                        placeholder="20"
                                        value={discountPercentage}
                                        onChange={(e) => setDiscountPercentage(e.target.value)}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label text-muted small fw-bold">
                                        <FaTag className="me-1" /> Offer Price
                                    </label>
                                    <input
                                        type="number"
                                        className="form-control bg-light border-0"
                                        value={offerPrice}
                                        disabled
                                        style={{ backgroundColor: '#e9ecef' }}
                                    />
                                    <small className="text-muted">Auto-calculated based on discount</small>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4">
                                <h6 className="fw-bold border-bottom pb-2"><FaCopy className="me-2" />Variants</h6>
                                <div className="row g-2 mb-3">
                                    <div className="col-md-3">
                                        <input
                                            type="text"
                                            className="form-control bg-light border-0"
                                            placeholder="Variant name*"
                                            value={variantForm.name}
                                            onChange={(e) => setVariantForm({...variantForm, name: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <input
                                            type="text"
                                            className="form-control bg-light border-0"
                                            placeholder="Size/Capacity"
                                            value={variantForm.sizeCapacity}
                                            onChange={(e) => setVariantForm({...variantForm, sizeCapacity: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-md-1">
                                        <input
                                            type="text"
                                            className="form-control bg-light border-0"
                                            placeholder="Unit"
                                            value={variantForm.unit}
                                            onChange={(e) => setVariantForm({...variantForm, unit: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <input
                                            type="number"
                                            className="form-control bg-light border-0"
                                            placeholder="Price*"
                                            value={variantForm.actualPrice}
                                            onChange={(e) => setVariantForm({...variantForm, actualPrice: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <input
                                            type="number"
                                            className="form-control bg-light border-0"
                                            placeholder="Discount %"
                                            value={variantForm.discountPercentage}
                                            onChange={(e) => setVariantForm({...variantForm, discountPercentage: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-md-1">
                                        <input
                                            type="number"
                                            className="form-control bg-light border-0"
                                            placeholder="Min"
                                            value={variantForm.duration}
                                            onChange={(e) => setVariantForm({...variantForm, duration: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-md-1">
                                        <input
                                            type="text"
                                            className="form-control bg-light border-0"
                                            placeholder="Offer"
                                            value={variantForm.offerPrice || variantForm.actualPrice}
                                            disabled
                                            style={{ backgroundColor: '#e9ecef' }}
                                        />
                                    </div>
                                </div>
                                <div className="d-flex gap-2 mb-3">
                                    <button type="button" onClick={handleAddVariant} className="btn btn-sm btn-dark">
                                        {editingVariantIndex !== null ? 'Update Variant' : 'Add Variant'}
                                    </button>
                                    {editingVariantIndex !== null && (
                                        <button type="button" onClick={() => {
                                            setEditingVariantIndex(null);
                                            setVariantForm({ name: '', sizeCapacity: '', unit: '', actualPrice: '', discountPercentage: '', offerPrice: '', duration: '' });
                                        }} className="btn btn-sm btn-secondary">Cancel</button>
                                    )}
                                </div>
                                {variants.length > 0 && (
                                    <div className="table-responsive">
                                        <table className="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Size</th>
                                                    <th>Unit</th>
                                                    <th>Actual Price</th>
                                                    <th>Discount %</th>
                                                    <th>Offer Price</th>
                                                    <th>Duration</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {variants.map((v, i) => (
                                                    <tr key={i}>
                                                        <td>{v.name}</td>
                                                        <td>{v.sizeCapacity || '—'}</td>
                                                        <td>{v.unit || '—'}</td>
                                                        <td>${v.actualPrice}</td>
                                                        <td>{v.discountPercentage || 0}%</td>
                                                        <td className="text-success fw-bold">${v.offerPrice || v.actualPrice}</td>
                                                        <td>{v.duration ? `${v.duration}m` : '—'}</td>
                                                        <td>
                                                            <button type="button" onClick={() => handleEditVariant(i)} className="btn btn-sm btn-light me-1"><FaEdit /></button>
                                                            <button type="button" onClick={() => handleRemoveVariant(i)} className="btn btn-sm btn-light"><FaTrash /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Add-ons */}
                        <div className="mb-4">
                            <h6 className="fw-bold border-bottom pb-2">Add-Ons</h6>
                            <div className="row g-2 mb-3">
                                <div className="col-md-4">
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="Add-on name*"
                                        value={addonForm.name}
                                        onChange={(e) => setAddonForm({...addonForm, name: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="Description"
                                        value={addonForm.description}
                                        onChange={(e) => setAddonForm({...addonForm, description: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-2">
                                    <input
                                        type="number"
                                        className="form-control bg-light border-0"
                                        placeholder="Price*"
                                        value={addonForm.price}
                                        onChange={(e) => setAddonForm({...addonForm, price: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-2 d-flex gap-2">
                                    <button type="button" onClick={handleAddAddon} className="btn btn-sm btn-dark">
                                        {editingAddonIndex !== null ? 'Update' : 'Add'}
                                    </button>
                                    {editingAddonIndex !== null && (
                                        <button type="button" onClick={() => {
                                            setEditingAddonIndex(null);
                                            setAddonForm({ name: '', description: '', price: '' });
                                        }} className="btn btn-sm btn-secondary">Cancel</button>
                                    )}
                                </div>
                            </div>
                            {addons.length > 0 && (
                                <div className="d-flex flex-wrap gap-2">
                                    {addons.map((a, i) => (
                                        <span key={i} className="badge bg-light text-dark border p-2">
                                            {a.name} (${a.price})
                                            <button type="button" onClick={() => handleEditAddon(i)} className="btn btn-sm btn-link p-0 ms-2"><FaEdit size={12} /></button>
                                            <button type="button" onClick={() => handleRemoveAddon(i)} className="btn btn-sm btn-link p-0 ms-1"><FaTrash size={12} /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Included/Excluded Items */}
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <h6 className="fw-bold border-bottom pb-2"><FaList className="me-2" />Included Items</h6>
                                <div className="d-flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="Add included item"
                                        value={newIncludedItem}
                                        onChange={(e) => setNewIncludedItem(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIncludedItem())}
                                    />
                                    <button type="button" onClick={handleAddIncludedItem} className="btn btn-sm btn-dark">Add</button>
                                </div>
                                {includedItems.map((item, i) => (
                                    <span key={i} className="badge bg-success text-white me-2 mb-2 p-2">
                                        {item.title}
                                        <button type="button" onClick={() => handleRemoveIncludedItem(i)} className="btn btn-sm btn-link text-white p-0 ms-2">×</button>
                                    </span>
                                ))}
                            </div>
                            <div className="col-md-6">
                                <h6 className="fw-bold border-bottom pb-2">Excluded Items</h6>
                                <div className="d-flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="Add excluded item"
                                        value={newExcludedItem}
                                        onChange={(e) => setNewExcludedItem(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExcludedItem())}
                                    />
                                    <button type="button" onClick={handleAddExcludedItem} className="btn btn-sm btn-dark">Add</button>
                                </div>
                                {excludedItems.map((item, i) => (
                                    <span key={i} className="badge bg-danger text-white me-2 mb-2 p-2">
                                        {item.title}
                                        <button type="button" onClick={() => handleRemoveExcludedItem(i)} className="btn btn-sm btn-link text-white p-0 ms-2">×</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* FAQs */}
                        <div className="mb-4">
                            <h6 className="fw-bold border-bottom pb-2"><FaQuestion className="me-2" />FAQs</h6>
                            <div className="row g-2 mb-3">
                                <div className="col-md-4">
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="Question*"
                                        value={faqForm.question}
                                        onChange={(e) => setFaqForm({...faqForm, question: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="Answer*"
                                        value={faqForm.answer}
                                        onChange={(e) => setFaqForm({...faqForm, answer: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-2">
                                    <input
                                        type="number"
                                        className="form-control bg-light border-0"
                                        placeholder="Order"
                                        value={faqForm.order}
                                        onChange={(e) => setFaqForm({...faqForm, order: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-2 d-flex gap-2">
                                    <button type="button" onClick={handleAddFaq} className="btn btn-sm btn-dark">
                                        {editingFaqIndex !== null ? 'Update' : 'Add'}
                                    </button>
                                    {editingFaqIndex !== null && (
                                        <button type="button" onClick={() => {
                                            setEditingFaqIndex(null);
                                            setFaqForm({ question: '', answer: '', order: 0 });
                                        }} className="btn btn-sm btn-secondary">Cancel</button>
                                    )}
                                </div>
                            </div>
                            {faqs.length > 0 && (
                                <div className="list-group">
                                    {faqs.map((f, i) => (
                                        <div key={i} className="list-group-item d-flex justify-content-between align-items-center">
                                            <div><strong>{f.question}</strong> - {f.answer}</div>
                                            <div>
                                                <button type="button" onClick={() => handleEditFaq(i)} className="btn btn-sm btn-light me-1"><FaEdit /></button>
                                                <button type="button" onClick={() => handleRemoveFaq(i)} className="btn btn-sm btn-light"><FaTrash /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Media */}
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <h6 className="fw-bold border-bottom pb-2"><FaImage className="me-2" />Featured Image</h6>
                                <div className="mb-2">
                                    <input
                                        type="file"
                                        
                                        accept="image/*"
                                        className="form-control bg-light border-0"
                                        onChange={handleFeaturedImageFileSelect}
                                        id="featuredImageUpload"
                                    />
                                    <label htmlFor="featuredImageUpload" className="btn btn-outline-secondary btn-sm mt-2">
                                        <FaFileImage className="me-1" /> Choose File
                                    </label>
                                    {featuredImage && (
                                        <div className="mt-2">
                                            <img 
                                                src={featuredImage.startsWith('blob:') ? featuredImage : getImageUrl(featuredImage)} 
                                                alt="Featured" 
                                                style={{ maxHeight: '100px', maxWidth: '100px' }} 
                                            />
                                            <span className="ms-2 text-success">✓ {featuredImageFile ? 'New file selected' : 'Current image'}</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    className="form-control bg-light border-0 mt-2"
                                    placeholder="Or enter image URL"
                                    value={featuredImage}
                                    onChange={(e) => setFeaturedImage(e.target.value)}
                                    disabled={!!featuredImageFile}
                                />
                            </div>
                            <div className="col-md-6">
                                <h6 className="fw-bold border-bottom pb-2">Gallery</h6>
                                <div className="row g-2 mb-2">
                                    <div className="col-auto">
                                        <select
                                            className="form-select bg-light border-0"
                                            value={galleryForm.type}
                                            onChange={(e) => setGalleryForm({ ...galleryForm, type: e.target.value, url: '', _file: null })}
                                        >
                                            <option value="image">Image</option>
                                            <option value="video">Video</option>
                                            <option value="youtube">YouTube</option>
                                            <option value="vimeo">Vimeo</option>
                                        </select>
                                    </div>
                                    {galleryForm.type === 'image' ? (
                                        <div className="col">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="d-none"
                                                id="galleryFileUpload"
                                                onChange={handleGalleryFileSelect}
                                            />
                                            <label htmlFor="galleryFileUpload" className="btn btn-outline-secondary btn-sm w-100">
                                                <FaFileImage className="me-1" />
                                                {galleryForm._file ? galleryForm._file.name : 'Choose Image'}
                                            </label>
                                            {galleryForm.url && (
                                                <img src={galleryForm.url} alt="preview" style={{ maxHeight: 50, maxWidth: 80, marginTop: 4 }} />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="col">
                                            <input
                                                type="text"
                                                className="form-control bg-light border-0"
                                                placeholder="URL*"
                                                value={galleryForm.url}
                                                onChange={(e) => setGalleryForm({ ...galleryForm, url: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    <div className="col-auto">
                                        <input
                                            type="number"
                                            className="form-control bg-light border-0"
                                            placeholder="Order"
                                            style={{ width: 70 }}
                                            value={galleryForm.order}
                                            onChange={(e) => setGalleryForm({ ...galleryForm, order: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-auto d-flex gap-1">
                                        <button type="button" onClick={handleAddGalleryItem} className="btn btn-sm btn-dark">
                                            {editingGalleryIndex !== null ? 'Update' : 'Add'}
                                        </button>
                                        {editingGalleryIndex !== null && (
                                            <button type="button" onClick={() => { setEditingGalleryIndex(null); setGalleryForm({ type: 'image', url: '', order: 0, _file: null }); }} className="btn btn-sm btn-secondary">Cancel</button>
                                        )}
                                    </div>
                                </div>
                                {gallery.length > 0 && (
                                    <div className="d-flex flex-wrap gap-2">
                                        {gallery.map((g, i) => (
                                            <span key={i} className="badge bg-light text-dark border p-2">
                                                {g.type === 'image' ? (
                                                    galleryImageFiles[i] ? <><FaImage className="me-1" />{galleryImageFiles[i].name.substring(0, 15)}</> : <><FaImage className="me-1" />{g.url?.substring(0, 20)}</>  
                                                ) : (
                                                    <><FaVideo className="me-1" />{g.url?.substring(0, 20)}</>
                                                )}
                                                <button type="button" onClick={() => handleEditGallery(i)} className="btn btn-sm btn-link p-0 ms-2"><FaEdit size={12} /></button>
                                                <button type="button" onClick={() => handleRemoveGallery(i)} className="btn btn-sm btn-link p-0 ms-1"><FaTrash size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Requirements & Tools */}
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <h6 className="fw-bold border-bottom pb-2">Requirements</h6>
                                <div className="row g-2 mb-2">
                                    <div className="col">
                                        <input
                                            type="text"
                                            className="form-control bg-light border-0"
                                            placeholder="Add requirement"
                                            value={newRequirement}
                                            onChange={(e) => setNewRequirement(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRequirement())}
                                        />
                                    </div>
                                    <div className="col-auto">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="d-none"
                                            id="requirementImageUpload"
                                            onChange={handleRequirementImageSelect}
                                        />
                                        <label htmlFor="requirementImageUpload" className="btn btn-outline-secondary btn-sm">
                                            <FaFileImage className="me-1" />
                                            {newRequirementFile ? newRequirementFile.name.substring(0, 10) : 'Image'}
                                        </label>
                                        {newRequirementPreview && (
                                            <img src={newRequirementPreview} alt="preview" style={{ maxHeight: 32, maxWidth: 48, marginLeft: 4 }} />
                                        )}
                                    </div>
                                    <div className="col-auto">
                                        <button type="button" onClick={handleAddRequirement} className="btn btn-sm btn-dark">Add</button>
                                    </div>
                                </div>
                                {requirements.map((req, i) => (
                                    <span key={i} className="badge bg-info text-white me-2 mb-2 p-2 d-inline-flex align-items-center gap-1">
                                        {(requirementImageFiles[i] || req.image) && <FaImage size={10} />}
                                        {req.title}
                                        <button type="button" onClick={() => handleRemoveRequirement(i)} className="btn btn-sm btn-link text-white p-0 ms-1">×</button>
                                    </span>
                                ))}
                            </div>
                            <div className="col-md-6">
                                <h6 className="fw-bold border-bottom pb-2"><FaTools className="me-2" />Tools</h6>
                                <div className="row g-2 mb-2">
                                    <div className="col">
                                        <input
                                            type="text"
                                            className="form-control bg-light border-0"
                                            placeholder="Tool name*"
                                            value={toolForm.name}
                                            onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })}
                                        />
                                    </div>
                                    {/* <div className="col-md-4">
                                        <input
                                            type="text"
                                            className="form-control bg-light border-0"
                                            placeholder="Description"
                                            value={toolForm.description}
                                            onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })}
                                        />
                                    </div> */}
                                    <div className="col-auto">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="d-none"
                                            id="toolImageUpload"
                                            onChange={handleToolImageFileSelect}
                                        />
                                        <label htmlFor="toolImageUpload" className="btn btn-outline-secondary btn-sm w-100">
                                            <FaFileImage className="me-1" />
                                            {toolForm._file ? toolForm._file.name.substring(0, 12) : 'Tool Image'}
                                        </label>
                                        {toolForm.image && (
                                            <img src={toolForm.image} alt="preview" style={{ maxHeight: 40, maxWidth: 60, marginTop: 4 }} />
                                        )}
                                    </div>
                                    <div className="col-auto">
                                        <button type="button" onClick={handleAddTool} className="btn btn-sm btn-dark">
                                            {editingToolIndex !== null ? 'Update' : 'Add'}
                                        </button>
                                        {editingToolIndex !== null && (
                                            <button type="button" onClick={() => { setEditingToolIndex(null); setToolForm({ name: '', description: '', image: '', _file: null }); }} className="btn btn-sm btn-secondary">Cancel</button>
                                        )}
                                    </div>
                                </div>
                                {tools.length > 0 && (
                                    <div className="d-flex flex-wrap gap-2">
                                        {tools.map((t, i) => (
                                            <span key={i} className="badge bg-light text-dark border p-2 d-flex align-items-center gap-1">
                                                {(toolImageFiles[i] || t.image) && <FaImage size={10} />}
                                                {t.name} {t.description && `(${t.description})`}
                                                <button type="button" onClick={() => handleEditTool(i)} className="btn btn-sm btn-link p-0 ms-1"><FaEdit size={12} /></button>
                                                <button type="button" onClick={() => handleRemoveTool(i)} className="btn btn-sm btn-link p-0"><FaTrash size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Process Steps */}
                        <div className="mb-4">
                            <h6 className="fw-bold border-bottom pb-2">
                                <FaList className="me-2 text-primary" />Our Process Steps
                            </h6>
                            <p className="text-muted small mb-3">
                                Add step-by-step process cards shown to customers explaining how the service works.
                            </p>

                            {/* Step Entry Form */}
                            <div className="card border-0 bg-light rounded-3 p-3 mb-3">
                                <div className="row g-2 align-items-start">
                                    {/* Image Upload */}
                                    <div className="col-md-3">
                                        <label className="form-label text-muted small fw-bold mb-1">Step Image (Optional)</label>
                                        <div
                                            className="border border-2 border-dashed rounded-3 d-flex align-items-center justify-content-center bg-white"
                                            style={{ height: 110, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                                            onClick={() => document.getElementById('processStepImageUpload').click()}
                                        >
                                            {processStepForm._preview ? (
                                                <>
                                                    <img
                                                        src={processStepForm._preview}
                                                        alt="step preview"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                                                        style={{ zIndex: 2, padding: '2px 6px', fontSize: 11 }}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            setProcessStepForm(prev => ({ ...prev, _file: null, _preview: '', image: '' }));
                                                        }}
                                                    >×</button>
                                                </>
                                            ) : (
                                                <div className="text-center text-muted small">
                                                    <FaImage size={22} className="mb-1 d-block mx-auto opacity-50" />
                                                    Click to upload
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            id="processStepImageUpload"
                                            className="d-none"
                                            onChange={handleProcessStepImageSelect}
                                        />
                                    </div>

                                    {/* Title + Description */}
                                    <div className="col-md-7">
                                        <label className="form-label text-muted small fw-bold mb-1">Step Title *</label>
                                        <input
                                            type="text"
                                            className="form-control bg-white border-0 mb-2"
                                            placeholder="e.g., Inspection & Assessment"
                                            value={processStepForm.title}
                                            onChange={e => setProcessStepForm(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                        <label className="form-label text-muted small fw-bold mb-1">Step Description</label>
                                        <textarea
                                            rows="3"
                                            className="form-control bg-white border-0"
                                            placeholder="Briefly explain what happens in this step..."
                                            value={processStepForm.description}
                                            onChange={e => setProcessStepForm(prev => ({ ...prev, description: e.target.value }))}
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="col-md-2 d-flex flex-column gap-2 justify-content-end" style={{ paddingTop: 22 }}>
                                        <button
                                            type="button"
                                            onClick={handleAddProcessStep}
                                            className="btn btn-sm btn-dark w-100"
                                        >
                                            {editingStepIndex !== null ? 'Update' : <><FaPlus className="me-1" />Add Step</>}
                                        </button>
                                        {editingStepIndex !== null && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary w-100"
                                                onClick={() => {
                                                    setEditingStepIndex(null);
                                                    setProcessStepForm({ title: '', description: '', image: '', _file: null, _preview: '' });
                                                }}
                                            >Cancel</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Steps List */}
                            {processSteps.length > 0 && (
                                <div className="row g-3">
                                    {processSteps.map((step, i) => {
                                        const previewSrc = processStepImageFiles[i]
                                            ? URL.createObjectURL(processStepImageFiles[i])
                                            : step.image && !step.image.startsWith('blob:')
                                                ? getImageUrl(step.image)
                                                : null;
                                        return (
                                            <div key={i} className="col-md-4">
                                                <div className="card border-0 shadow-sm rounded-3 h-100" style={{ borderTop: '3px solid #1a1a1a' }}>
                                                    {previewSrc && (
                                                        <img
                                                            src={previewSrc}
                                                            alt={step.title}
                                                            className="card-img-top rounded-top-3"
                                                            style={{ height: 120, objectFit: 'cover' }}
                                                        />
                                                    )}
                                                    <div className="card-body p-3">
                                                        <div className="d-flex align-items-start justify-content-between mb-1">
                                                            <span
                                                                className="badge rounded-pill text-white me-2 flex-shrink-0"
                                                                style={{ background: '#1a1a1a', fontSize: 11, padding: '4px 9px' }}
                                                            >
                                                                Step {step.stepNumber}
                                                            </span>
                                                            <div className="d-flex gap-1 ms-auto">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEditProcessStep(i)}
                                                                    className="btn btn-sm btn-light border"
                                                                    title="Edit step"
                                                                ><FaEdit size={11} /></button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveProcessStep(i)}
                                                                    className="btn btn-sm btn-light border text-danger"
                                                                    title="Remove step"
                                                                ><FaTrash size={11} /></button>
                                                            </div>
                                                        </div>
                                                        <p className="fw-bold mb-1 small">{step.title}</p>
                                                        {step.description && (
                                                            <p className="text-muted mb-0" style={{ fontSize: 12, lineHeight: 1.5 }}>
                                                                {step.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {processSteps.length === 0 && (
                                <div className="text-center py-4 text-muted border border-dashed rounded-3">
                                    <FaList size={24} className="mb-2 opacity-25" />
                                    <p className="small mb-0">No process steps added yet. Use the form above to add your first step.</p>
                                </div>
                            )}
                        </div>

                        <div className="d-flex gap-2 justify-content-end">
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline-secondary px-4 py-2">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn btn-dark fw-bold px-4 py-2 shadow-sm">
                                {submitting ? 'Saving...' : 'Save Service'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Services List */}
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">

    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">

        <input
            type="text"
            className="form-control"
            placeholder="Search service, category, sub-category..."
            style={{ maxWidth: "400px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
            className="form-select"
            style={{ width: "220px" }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
        >
            <option value="asc">
                Ascending (A-Z)
            </option>

            <option value="desc">
                Descending (Z-A)
            </option>
        </select>

    </div>
                {loading ? <LoadingSpinner message="Loading services..." /> : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light border-0">
                                <tr>
                                    <th>Category</th>
                                    <th>Sub-Category</th>
                                    <th>Service</th>
                                    <th>Price</th>
                                    <th>Duration</th>
                                    <th>Status</th>
                                    <th>Featured</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredServices.map((svc) => (
                                    <tr key={svc._id}>
                                        <td className="fw-bold text-dark">{svc.category?.name || '—'}</td>
                                        <td>
                                            <span className="badge bg-light text-secondary border text-uppercase" style={{ fontSize: '0.7rem' }}>
                                                {svc.subcategory?.name || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="fw-semibold">
                                                <FaLayerGroup className="text-primary me-2" />
                                                {svc.name}
                                                {svc.hasVariants && (
                                                    <span className="badge bg-info text-white ms-2" style={{ fontSize: '0.6rem' }}>
                                                        {svc.variants?.length || 0} variants
                                                    </span>
                                                )}
                                                {svc.addons?.length > 0 && (
                                                    <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.6rem' }}>
                                                        +{svc.addons.length} add-ons
                                                    </span>
                                                )}
                                            </div>
                                            <div className="small text-muted">
                                                {svc.shortDescription && (() => {
    try {
        const points = typeof svc.shortDescription === 'string' 
            ? JSON.parse(svc.shortDescription) 
            : svc.shortDescription;
        if (Array.isArray(points) && points.length > 0) {
            return (
                <ul className="list-unstyled mb-0">
                    {points.slice(0, 2).map((point, i) => (
                        <li key={i} className="small">• {point}</li>
                    ))}
                </ul>
            );
        }
        return null;
    } catch {
        return null;
    }
})()}
                                            </div>
                                        </td>
                                        <td className="fw-bold text-primary">{getDisplayPrice(svc)}</td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                <FaClock className="me-1" />{getDisplayDuration(svc)}
                                            </span>
                                        </td>
                                        <td>
                                            {svc.status === 'active' ? (
                                                <span className="text-success d-flex align-items-center gap-1 small fw-bold">
                                                    <FaCheckCircle /><span>Active</span>
                                                </span>
                                            ) : svc.status === 'draft' ? (
                                                <span className="text-warning d-flex align-items-center gap-1 small fw-bold">
                                                    <FaTimesCircle /><span>Draft</span>
                                                </span>
                                            ) : (
                                                <span className="text-danger d-flex align-items-center gap-1 small fw-bold">
                                                    <FaTimesCircle /><span>Inactive</span>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {svc.isFeatured && <FaStar className="text-warning" />}
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <button onClick={() => handleOpenEdit(svc)} className="btn btn-sm btn-light border text-primary" title="Edit"><FaEdit /></button>
                                                <button onClick={() => handleDelete(svc._id)} className="btn btn-sm btn-light border text-danger" title="Delete"><FaTrash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredServices.length === 0 && (
                                    <tr><td colSpan="8" className="text-center py-5 text-muted">No services found. Create your first service!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubcategoryManagement;
