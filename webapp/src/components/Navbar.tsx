import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import './Navbar.css';

const Navbar: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
            <div className="container nav-content">
                <a href="#" className="logo">
                    Sweet Hand Braids
                </a>

                <div className="nav-links">
                    <a href="#about">About</a>
                    <a href="#gallery">Gallery</a>
                    <a href="#contact">Contact</a>
                    <a href="#booking" className="btn-primary" style={{ padding: '0.5rem 1.5rem', marginLeft: '1rem' }}>
                        Book Now
                    </a>
                </div>

                <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="mobile-menu glass-panel">
                    <a href="#about" onClick={() => setIsMobileMenuOpen(false)}>About</a>
                    <a href="#gallery" onClick={() => setIsMobileMenuOpen(false)}>Gallery</a>
                    <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>Contact</a>
                    <a href="#booking" className="btn-primary" onClick={() => setIsMobileMenuOpen(false)}>
                        Book Now
                    </a>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
