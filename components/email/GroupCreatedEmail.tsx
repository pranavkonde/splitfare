import * as React from 'react';

interface GroupCreatedEmailProps {
  groupName: string;
  inviteCode: string;
}

export const GroupCreatedEmail: React.FC<Readonly<GroupCreatedEmailProps>> = ({
  groupName,
  inviteCode,
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
    <h1 style={{ color: '#020617', fontSize: '24px', fontWeight: 'bold' }}>Group Created: {groupName}</h1>
    <p style={{ fontSize: '16px', lineHeight: '24px' }}>
      You&apos;ve successfully created a new group. Share the invite code below with your friends to start splitting expenses.
    </p>
    <div style={{ 
      backgroundColor: '#f1f5f9', 
      padding: '20px', 
      borderRadius: '8px', 
      textAlign: 'center', 
      margin: '20px 0' 
    }}>
      <span style={{ fontSize: '32px', fontWeight: 'black', letterSpacing: '4px', color: '#020617' }}>
        {inviteCode}
      </span>
    </div>
    <div style={{ textAlign: 'center', marginTop: '30px' }}>
      <a href={`https://splitfare.io/join/${inviteCode}`} style={{
        backgroundColor: '#020617',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '6px',
        textDecoration: 'none',
        fontWeight: 'bold'
      }}>Join Group</a>
    </div>
    <p style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
      The SplitFare Team
    </p>
  </div>
);
