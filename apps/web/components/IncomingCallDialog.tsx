'use client';

import React, { useState } from 'react';
import { Video, PhoneCall, PhoneOff, ShieldCheck, User } from 'lucide-react';
import { LiveKitVideoCall } from './LiveKitVideoCall';

export interface ActiveCallData {
  id: string;
  requestId: string;
  mentorId: string;
  mentorName: string;
  studentId: string;
  roomName: string;
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'expired';
  requestNote?: string;
  createdAt: string;
}

interface IncomingCallDialogProps {
  call: ActiveCallData;
  onDismiss: () => void;
}

export function IncomingCallDialog({ call, onDismiss }: IncomingCallDialogProps) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/mentor-requests/${call.requestId}/call/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not connect to call');
        setAccepting(false);
        return;
      }
      setInCall(true);
    } catch {
      setError('Network error connecting to call');
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    setError(null);
    try {
      await fetch(`/api/mentor-requests/${call.requestId}/call/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Ignore network errors on decline
    } finally {
      setDeclining(false);
      onDismiss();
    }
  }

  if (inCall) {
    return (
      <LiveKitVideoCall
        requestId={call.requestId}
        isOpen={true}
        onClose={() => {
          setInCall(false);
          onDismiss();
        }}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 12, 22, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #DCD2F0',
          boxShadow: '0 24px 48px -12px rgba(23, 21, 27, 0.25)',
          maxWidth: '460px',
          width: '100%',
          padding: '28px',
          textAlign: 'center',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: '#F2EFF7',
            border: '2px solid #735DB5',
            color: '#735DB5',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 0 8px rgba(115, 93, 181, 0.15)',
            animation: 'pulseRing 1.8s infinite',
          }}
        >
          <PhoneCall size={32} />
        </div>

        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#594593', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
          Incoming Video Call
        </div>

        <h2 id="incoming-call-title" style={{ margin: '0 0 8px', fontSize: '1.4rem', color: '#17151B' }}>
          {call.mentorName}
        </h2>

        <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#4A4553', lineHeight: 1.5 }}>
          Your verified mentor is calling for a live 1-on-1 coaching session.
        </p>

        {call.requestNote && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FAF9FB',
              border: '1px solid #E7E3EB',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#4A4553',
              textAlign: 'left',
              marginBottom: '20px',
            }}
          >
            <strong style={{ color: '#17151B' }}>Topic:</strong> {call.requestNote}
          </div>
        )}

        {error && (
          <div className="auth-error" style={{ marginBottom: '16px', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDecline}
            disabled={declining || accepting}
            style={{ flex: 1, padding: '12px', minHeight: '44px' }}
          >
            <PhoneOff size={16} /> Decline
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleAccept}
            disabled={declining || accepting}
            style={{ flex: 1, padding: '12px', minHeight: '44px', fontWeight: 700 }}
          >
            <Video size={16} /> {accepting ? 'Connecting…' : 'Accept Call'}
          </button>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', color: '#4A4553' }}>
          <ShieldCheck size={14} color="#059669" /> End-to-end encrypted LiveKit WebRTC
        </div>
      </div>
    </div>
  );
}
