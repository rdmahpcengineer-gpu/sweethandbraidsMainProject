import React from 'react';
import './PaymentStatus.css';

interface PaymentStatusProps {
  status: 'success' | 'cancelled';
  sessionId?: string | null;
  onDismiss: () => void;
}

const PaymentStatus: React.FC<PaymentStatusProps> = ({ status, sessionId, onDismiss }) => {
  const isSuccess = status === 'success';

  return (
    <div className="payment-overlay" onClick={onDismiss}>
      <div className="payment-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className={`payment-icon ${status}`}>
          {isSuccess ? '✓' : '✕'}
        </div>
        <h2>{isSuccess ? 'Booking Confirmed!' : 'Booking Cancelled'}</h2>
        <p>
          {isSuccess
            ? 'Your $50 deposit has been received. We\'ll reach out shortly to confirm your appointment details.'
            : 'No worries — you have not been charged. Feel free to rebook whenever you\'re ready.'}
        </p>
        {isSuccess && sessionId && (
          <p className="payment-session-id">Reference: {sessionId}</p>
        )}
        <button className="payment-dismiss" onClick={onDismiss}>
          {isSuccess ? 'Got It' : 'Back to Site'}
        </button>
      </div>
    </div>
  );
};

export default PaymentStatus;
