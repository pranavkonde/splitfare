import * as React from 'react';

interface WelcomeEmailProps {
  userFirstname?: string;
}

export const WelcomeEmail: React.FC<Readonly<WelcomeEmailProps>> = ({
  userFirstname,
}) => (
  <div style={{
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    backgroundColor: '#ffffff',
    color: '#333',
    padding: '20px',
    borderRadius: '8px',
    maxWidth: '600px',
    margin: '0 auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  }}>
    <h1 style={{ color: '#020617', fontSize: '24px', fontWeight: 'bold' }}>Welcome to SplitFare, {userFirstname}!</h1>
    <p style={{ fontSize: '16px', lineHeight: '24px' }}>
      We&apos;re excited to have you on board. SplitFare makes it easy to split expenses and track balances with your friends.
    </p>
    <div style={{ textAlign: 'center', marginTop: '30px' }}>
      <a href="https://splitfare.io/dashboard" style={{
        backgroundColor: '#020617',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '6px',
        textDecoration: 'none',
        fontWeight: 'bold'
      }}>Go to Dashboard</a>
    </div>
    <p style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
      If you have any questions, feel free to reply to this email.
    </p>
    <p style={{ fontSize: '14px', color: '#666' }}>
      The SplitFare Team
    </p>
  </div>
);
