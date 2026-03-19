import React from 'react';
import './Hero.css';

const Hero: React.FC = () => {
    return (
        <div className="hero">
            <div className="video-container">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="hero-video"
                >
                    <source src="/hero.mp4" type="video/mp4" />
                </video>
                <div className="hero-overlay"></div>
            </div>

            <div className="hero-content">
                <h1 className="hero-title">
                    Elevate Your <span className="gold-text">Crown</span>
                </h1>
                <p className="hero-subtitle">
                    Exquisite braiding and protective styling tailored for the modern queen.
                </p>
                <div className="hero-actions">
                    <a href="#booking" className="btn-primary">Book Appointment</a>
                    <a href="#gallery" className="btn-outline">View Gallery</a>
                </div>
            </div>
        </div>
    );
};

export default Hero;
