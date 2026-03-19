import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Gallery from './components/Gallery';
import Booking from './components/Booking';
import Footer from './components/Footer';
import SweetHandBraidsChat from './components/chat/SweetHandBraidsChat';
import PaymentStatus from './components/PaymentStatus';

function App() {
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success' || payment === 'cancelled') {
      setPaymentStatus(payment);
      setSessionId(params.get('session_id'));
    }
  }, []);

  const handleDismiss = () => {
    setPaymentStatus(null);
    setSessionId(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <>
      <Navbar />
      <Hero />
      <section id="about" className="section" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container text-center">
          <h2 className="section-title">The <span className="gold-text">Sweet Hand</span> Experience</h2>
          <p style={{ maxWidth: '800px', margin: '0 auto', fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            At Sweet Hand Braids, we believe your hair is your crown. Our master stylists blend ancestral techniques with modern aesthetics to deliver flawless, pain-free braiding that protects your natural hair while turning heads.
          </p>
        </div>
      </section>
      <Gallery />
      <Booking />
      <Footer />
      <SweetHandBraidsChat />
      {paymentStatus && (
        <PaymentStatus
          status={paymentStatus}
          sessionId={sessionId}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}

export default App;
