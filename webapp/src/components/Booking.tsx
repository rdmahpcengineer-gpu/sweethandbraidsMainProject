import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Booking.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const SERVICES = [
    { value: 'knotless_box_braids', label: 'Knotless Box Braids', price: '$150-350' },
    { value: 'goddess_locs', label: 'Goddess Locs', price: '$180-350' },
    { value: 'passion_twists', label: 'Passion Twists', price: '$140-280' },
    { value: 'butterfly_locs', label: 'Butterfly Locs', price: '$180-320' },
    { value: 'cornrows', label: 'Feed-In Cornrows', price: '$80-200' },
    { value: 'fulani_braids', label: 'Fulani Braids', price: '$120-250' },
    { value: 'tribal_braids', label: 'Tribal Braids', price: '$150-300' },
    { value: 'crochet_braids', label: 'Crochet Braids', price: '$80-180' },
];

const Booking: React.FC = () => {
    const [date, setDate] = useState<Date>(new Date());
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [service, setService] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDateChange = (value: any) => {
        setDate(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service,
                    customerName: name,
                    customerEmail: email,
                    customerPhone: phone,
                    date: date.toDateString(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            // Redirect to Stripe Checkout
            window.location.href = data.url;
        } catch (err: any) {
            setError(err.message || 'Failed to start checkout. Please try again.');
            setLoading(false);
        }
    };

    return (
        <section id="booking" className="section booking-section">
            <div className="container">
                <div className="booking-wrapper glass-panel">
                    <div className="booking-content">
                        <h2 className="section-title">Book Your <span className="gold-text">Appointment</span></h2>
                        <p className="booking-desc">
                            Select your preferred date for a consultation or styling session. A $50 booking deposit is required to secure your appointment.
                        </p>

                        <form className="booking-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    required
                                    className="form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    required
                                    className="form-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
                                    required
                                    className="form-input"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <select
                                    className="form-input"
                                    required
                                    value={service}
                                    onChange={(e) => setService(e.target.value)}
                                >
                                    <option value="" disabled>Select Service</option>
                                    {SERVICES.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label} ({s.price})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {error && <p className="booking-error">{error}</p>}

                            <button type="submit" className="btn-primary w-full" disabled={loading}>
                                {loading ? (
                                    <span className="booking-spinner">Processing...</span>
                                ) : (
                                    'Pay $50 Deposit & Book'
                                )}
                            </button>

                            <p className="deposit-note">
                                A $50 booking deposit is required to secure your appointment. The remaining balance is due at your session.
                            </p>
                        </form>
                    </div>

                    <div className="booking-calendar-container">
                        <h3 className="calendar-title">Select Date</h3>
                        <div className="calendar-wrapper">
                            <Calendar
                                onChange={handleDateChange}
                                value={date}
                                minDate={new Date()}
                                className="custom-calendar"
                            />
                        </div>
                        <p className="selected-date">
                            Selected: <span className="gold-text">{date.toDateString()}</span>
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Booking;
