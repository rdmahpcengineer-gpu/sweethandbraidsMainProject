import React from 'react';
import './Gallery.css';

const Gallery: React.FC = () => {
    const images = [
        { src: '/gallery1.png', alt: 'Intricate Braided Hairstyle', span: 'col-span-2 row-span-2' },
        { src: '/gallery2.png', alt: 'Knotless Box Braids', span: 'col-span-1 row-span-1' },
        { src: '/gallery3.png', alt: 'Cornrow Updo Hairstyle', span: 'col-span-1 row-span-2' },
        { src: '/media__1773501866057.jpg', alt: 'Braid Style 4', span: 'col-span-1 row-span-1' }
    ];

    return (
        <section id="gallery" className="section gallery-section">
            <div className="container">
                <div className="text-center">
                    <h2 className="section-title">Signature <span className="gold-text">Styles</span></h2>
                    <p className="gallery-subtitle">Explore our portfolio of exquisite protective styles.</p>
                </div>

                <div className="gallery-grid">
                    {images.map((img, index) => (
                        <div key={index} className={`gallery-item ${img.span}`}>
                            <img src={img.src} alt={img.alt} loading="lazy" />
                            <div className="gallery-overlay">
                                <span className="gallery-text">View Style</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Gallery;
