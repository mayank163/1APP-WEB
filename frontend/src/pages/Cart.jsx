import '../styles/Cart.css';
import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { FaTag, FaCheckCircle, FaArrowLeft, FaPercent } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { resolveImageUrl } from '../services/api';
import Checkout from './Checkout';

const groupByCategory = (items) =>
    items.reduce((groups, item) => {
        const cat = item.service.category?.name || item.service.category || 'Services';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
        return groups;
    }, {});

const QtyControl = ({ quantity, onDec, onInc }) => (
    <div className="ui-cart-1" >
        <button className="ui-cart-2" onClick={onDec} >−</button>
        <span className="ui-cart-3" >{quantity}</span>
        <button className="ui-cart-4" onClick={onInc} >+</button>
    </div>
);

const Cart = () => {
    const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useContext(CartContext);
    const { user, isAuthenticated } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleCheckout = () => {
        if (!isAuthenticated) {
            toast.warn('Please login to proceed to checkout.');
            navigate('/login', { state: { from: { pathname: '/cart' } } });
        }
    };

    // ── Empty State ──
    if (cartItems.length === 0) {
        return (
            <div className="ui-cart-5" >
                <svg className="ui-cart-6" width="160" height="155" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" >
                    {/* Cart body */}
                    <rect x="52" y="82" width="96" height="66" rx="7" fill="#d4d4d4" />
                    <rect x="58" y="88" width="84" height="54" rx="5" fill="#e9e9e9" />
                    {/* Vertical stripes */}
                    {[0,1,2,3,4,5].map(i => <rect key={i} x={66 + i * 13} y="91" width="7" height="48" rx="2.5" fill="#c8c8c8" />)}
                    {/* Handle */}
                    <rect x="48" y="73" width="44" height="11" rx="5.5" fill="#8B5E3C" />
                    {/* Wheels */}
                    {[63, 90, 117, 144].map((cx, i) => <circle key={i} cx={cx} cy="160" r="10" fill="none" stroke="#b0b0b0" strokeWidth="4" />)}
                    {/* Bird body */}
                    <ellipse cx="140" cy="79" rx="17" ry="14" fill="#6c47ff" />
                    <circle cx="153" cy="68" r="11" fill="#6c47ff" />
                    <polygon points="164,68 173,65 164,73" fill="#f5a623" />
                    <circle cx="156" cy="66" r="2.5" fill="white" />
                    <circle cx="157" cy="66" r="1.2" fill="#222" />
                    <polygon points="123,84 107,76 123,92" fill="#5535cc" />
                    <line x1="140" y1="93" x2="140" y2="103" stroke="#f5a623" strokeWidth="2.5" />
                    <line x1="140" y1="103" x2="133" y2="109" stroke="#f5a623" strokeWidth="2.5" />
                    <line x1="140" y1="103" x2="147" y2="109" stroke="#f5a623" strokeWidth="2.5" />
                </svg>

                <h2 className="ui-cart-7" >Your Cart is Empty</h2>
                <p className="ui-cart-8" >Lets add some services</p>
                <Link className="ui-cart-9"
                    to="/services"

                >
                    Explore Services
                </Link>
            </div>
        );
    }

    if (isAuthenticated) return <Checkout />;

    const grouped = groupByCategory(cartItems);
    const total = getCartTotal();

    return (
        <div className="ui-cart-10" >
            <div className="ui-cart-11" >

                {/* Back + Title */}
                <div className="ui-cart-12" >
                    <button className="ui-cart-13" onClick={() => navigate(-1)} >
                        <FaArrowLeft size={18} color="#111" />
                    </button>
                    <h2 className="ui-cart-14" >Your Cart</h2>
                </div>

                <div className="ui-cart-15" >

                    {/* ── LEFT ── */}
                    <div className="ui-cart-16" >

                        {/* Saving banner */}
                        <div className="ui-cart-17" >
                            <div className="ui-cart-18" >
                                <FaTag size={13} color="#000000" />
                            </div>
                            <span className="ui-cart-19" >
                                Saving <strong>$0.00</strong> on this order
                            </span>
                        </div>

                        {/* Account card */}
                        <div className="ui-cart-20" >
                            <div className="ui-cart-21" >Account</div>
                            {isAuthenticated ? (
                                <div className="ui-cart-22" >
                                    <FaCheckCircle color="#000000" size={15} />
                                    <span className="ui-cart-23" >
                                        Logged in as <strong>{user?.name || user?.email}</strong>
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <p className="ui-cart-24" >To book the service, please login or sign up</p>
                                    <button className="ui-cart-25"
                                        onClick={() => navigate('/login')}

                                    >
                                        Login
                                    </button>
                                </>
                            )}
                        </div>

                    </div>

                    {/* ── RIGHT ── */}
                    <div className="ui-cart-26" >

                        {/* Services grouped by category */}
                        <div className="ui-cart-27" >
                            {Object.entries(grouped).map(([category, items], catIdx, arr) => (
                                <div key={category}>
                                    {/* <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 14 }}>{category}</div> */}
                                    {items.map((item, idx) => (
                                        <div key={item.service._id}>
                                            <div className="ui-cart-28" >
                                                <div className="ui-cart-29" >
                                                    {item.service.imageUrl && (
                                                        <img className="ui-cart-30"
                                                            src={resolveImageUrl(item.service.imageUrl)}
                                                            alt={item.service.name}

                                                        />
                                                    )}
                                                    <span className="ui-cart-31" >{item.service.name}{item.selectedAddons?.length > 0 && <small className="ui-cart-32" >Add-ons: {item.selectedAddons.map(addon => addon.name).join(', ')}</small>}</span>
                                                </div>
                                                <div className="ui-cart-33" >
                                                    <QtyControl
                                                        quantity={item.quantity}
                                                        onDec={() => {
                                                            if (item.quantity === 1) { removeFromCart(item.service._id); toast.info(`${item.service.name} removed`); }
                                                            else updateQuantity(item.service._id, item.quantity - 1);
                                                        }}
                                                        onInc={() => updateQuantity(item.service._id, item.quantity + 1)}
                                                    />
                                                    <span className="ui-cart-34" >
                                                        ${(item.service.price * item.quantity).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            {idx < items.length - 1 && <hr className="ui-cart-35"  />}
                                        </div>
                                    ))}
                                    {catIdx < arr.length - 1 && <hr className="ui-cart-36"  />}
                                </div>
                            ))}

                            {/* Avoid calling checkbox */}
                            <hr className="ui-cart-37"  />
                            <label className="ui-cart-38" >
                                <input className="ui-cart-39" type="checkbox" defaultChecked  />
                                <span className="ui-cart-40" >Avoid calling before reaching the location</span>
                            </label>
                        </div>

                        {/* Coupons */}
                        <div className="ui-cart-41" >
                            <div className="ui-cart-42" >
                                <FaPercent size={14} color="#000000" />
                            </div>
                            <div>
                                <div className="ui-cart-43" >Coupons and offers</div>
                                <div className="ui-cart-44" >
                                    {isAuthenticated ? 'No coupons available' : 'Login/Sign up to view offers'}
                                </div>
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div className="ui-cart-45" >
                            <div className="ui-cart-46" >Payment summary</div>

                            <div className="ui-cart-47" >
                                <span>Item total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            <div className="ui-cart-48" >
                                <span className="ui-cart-49" >Free service offer</span>
                                <span className="ui-cart-50" >-$0.00</span>
                            </div>
                            <div className="ui-cart-51" >
                                <span>Total amount</span>
                                <span>${total.toFixed(2)}</span>
                            </div>

                            <hr className="ui-cart-52"  />

                            <div className="ui-cart-53" >
                                <span className="ui-cart-54" >Amount to pay</span>
                                <span className="ui-cart-55" >${total.toFixed(2)}</span>
                            </div>
                            <div className="ui-cart-56" >
                                <span className="ui-cart-57" >View breakup</span>
                            </div>

                            <button className="ui-cart-58"
                                onClick={handleCheckout}

                            >
                                Proceed to Pay
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Cart;
