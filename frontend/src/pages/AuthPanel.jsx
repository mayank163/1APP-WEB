import heroImg from '../assets/hero/login_image.png';
import resetImg from '../assets/hero/reset_password.png';

export const AuthPanel = () => (
    <div
        style={{
            background: '#f5ede0',
            backgroundImage: `url(${heroImg})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            height: '100%',
        }}
    />
);

export const ResetAuthPanel = () => (
    <div
        style={{
            background: '#f5ede0',
            backgroundImage: `url(${resetImg})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            height: '100%',
        }}
    />
);

export default AuthPanel;