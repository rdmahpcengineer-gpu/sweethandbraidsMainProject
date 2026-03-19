import React from 'react';
import { Instagram, MapPin, Phone, Mail } from 'lucide-react';
import './Footer.css';

const Footer: React.FC = () => {
    return (
        <footer id="contact" className="footer">
            <div className="container">
                <div className="footer-grid">
                    <div className="footer-brand">
                        <h2 className="logo">Sweet Hand <span>Braids</span></h2>
                        <p className="footer-desc">
                            Elevating the art of braiding. Experience premium, painless, and protective styles in our luxury salon.
                        </p>
                        <div className="social-links">
                            <a href="#" aria-label="Instagram"><Instagram size={24} /></a>
                        </div>
                    </div>

                    <div className="footer-contact">
                        <h3 className="footer-title">Contact Us</h3>
                        <ul className="contact-info">
                            <li>
                                <MapPin size={20} className="gold-text" />
                                <span>123 Elegance Blvd, Suite 2B<br />Atlanta, GA 30303</span>
                            </li>
                            <li>
                                <Phone size={20} className="gold-text" />
                                <span>(555) 123-4567</span>
                            </li>
                            <li>
                                <Mail size={20} className="gold-text" />
                                <span>hello@sweethandbraids.com</span>
                            </li>
                        </ul>
                    </div>

                    <div className="footer-hours">
                        <h3 className="footer-title">Salon Hours</h3>
                        <ul className="hours-list">
                            <li><span>Monday</span> <span>Closed</span></li>
                            <li><span>Tue - Fri</span> <span>9:00 AM - 7:00 PM</span></li>
                            <li><span>Saturday</span> <span>8:00 AM - 6:00 PM</span></li>
                            <li><span>Sunday</span> <span>10:00 AM - 4:00 PM</span></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {new Date().getFullYear()} Sweet Hand Braids. All Rights Reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
