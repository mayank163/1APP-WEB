import { cssValue } from '../utils/cssValue';
import '../styles/AuthPanel.css';
import heroImg from '../assets/hero/login_image.png';
import resetImg from '../assets/hero/reset_password.png';

export const AuthPanel = () => (
    <div className="ui-authpanel-1"
        style={{ "--ui-authpanel-1-background-image": cssValue(`url(${heroImg})`, "backgroundImage") }}
    />
);

export const ResetAuthPanel = () => (
    <div className="ui-authpanel-2"
        style={{ "--ui-authpanel-2-background-image": cssValue(`url(${resetImg})`, "backgroundImage") }}
    />
);

export default AuthPanel;