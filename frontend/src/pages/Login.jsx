import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// This file is kept for backward compatibility.
// The actual login UI is in LoginPage.jsx
const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        navigate('/login', { replace: true, state: location.state });
    }, [navigate, location.state]);
    return null;
};

export default Login;
