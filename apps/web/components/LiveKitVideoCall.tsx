'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';

interface LiveKitVideoCallProps {
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
  externalFallbackUrl?: string | null;
}

export function LiveKitVideoCall({
  requestId,
  isOpen,
  onClose,
  externalFallbackUrl,
}: LiveKitVideoCallProps) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [participantRole, setParticipantRole] = useState<'student' | 'mentor' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/mentor-requests/${requestId}/call/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'LIVEKIT_NOT_CONFIGURED' || res.status === 503) {
          setIsConfigured(false);
          setError(
            data.error || 'LiveKit video infrastructure is not configured on this server.'
          );
        } else {
          setError(data.error || `Could not join room (HTTP ${res.status})`);
        }
        setLoading(false);
        return;
      }

      setToken(data.token);
      setServerUrl(data.serverUrl);
      setRoomName(data.roomName);
      setParticipantRole(data.role);
      setIsConfigured(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error joining video room');
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (isOpen) {
      void fetchToken();
    } else {
      setToken(null);
      setError(null);
    }
  }, [isOpen, fetchToken]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-call-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          height: '90vh',
          maxHeight: '850px',
          backgroundColor: 'var(--card-bg, #12141a)',
          border: '1px solid var(--line, #2a2f3a)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Call Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--line, #2a2f3a)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
              }}
            >
              <Video size={18} />
            </span>
            <div>
              <h2
                id="video-call-title"
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-bright, #fff)',
                }}
              >
                Dedicated Mentor Video Room
              </h2>
              <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem' }}>
                {roomName ? `Room: ${roomName}` : 'Connecting…'} •{' '}
                {participantRole ? `Role: ${participantRole.toUpperCase()}` : ''}
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              title="Troubleshooting & Audio Help"
              style={{
                background: 'transparent',
                border: '1px solid var(--line, #2a2f3a)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
              }}
            >
              <HelpCircle size={14} /> Help
            </button>
            <button
              onClick={onClose}
              aria-label="Close video call"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Troubleshooting Panel Drawer */}
        {showTroubleshooting && (
          <aside
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              borderBottom: '1px solid var(--line, #2a2f3a)',
              fontSize: '0.85rem',
              color: '#e2e8f0',
            }}
          >
            <b>Media & Audio Troubleshooting Guide:</b>
            <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
              <li>
                <strong>Camera/Microphone Permission:</strong> Look for the lock or camera icon in
                your browser URL bar and set Camera & Microphone to <em>Allow</em>.
              </li>
              <li>
                <strong>Device In Use:</strong> Close other applications (Zoom, Teams, Google Meet)
                that might have an exclusive lock on your webcam.
              </li>
              <li>
                <strong>Strict Firewalls:</strong> If connecting from a corporate network, ensure
                WebRTC UDP traffic is not blocked by VPN or proxy.
              </li>
            </ul>
          </aside>
        )}

        {/* Main Body */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          {loading ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              <div className="spinner" style={{ width: '36px', height: '36px' }} />
              <p>Authenticating and generating secure room token…</p>
            </div>
          ) : error || !isConfigured ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertCircle size={28} />
              </div>

              <div>
                <h3 style={{ margin: '0 0 6px', color: '#fff' }}>
                  {!isConfigured ? 'LiveKit Video Offline' : 'Room Connection Issue'}
                </h3>
                <p
                  style={{
                    margin: 0,
                    maxWidth: '520px',
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </p>
              </div>

              {!isConfigured && (
                <div
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--line, #2a2f3a)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    maxWidth: '480px',
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                  }}
                >
                  <strong style={{ color: '#e2e8f0' }}>Configuration Checklist:</strong>
                  <br />
                  Configure <code>LIVEKIT_URL</code>, <code>LIVEKIT_API_KEY</code>, and{' '}
                  <code>LIVEKIT_API_SECRET</code> in your environment to enable instant, in-browser
                  WebRTC calling.
                </div>
              )}

              {externalFallbackUrl && (
                <div style={{ marginTop: '8px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#94a3b8' }}>
                    An external meeting link was also scheduled for this session:
                  </p>
                  <a
                    href={externalFallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                    }}
                  >
                    Open Scheduled Link <ExternalLink size={14} />
                  </a>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button className="ghost" onClick={() => void fetchToken()}>
                  Try Again
                </button>
                <button className="primary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          ) : token && serverUrl ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {mediaWarning && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    backgroundColor: 'rgba(234, 179, 8, 0.95)',
                    color: '#000',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    maxWidth: '90%',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{mediaWarning}</span>
                  <button
                    onClick={() => setMediaWarning(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#000' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <LiveKitRoom
                video={true}
                audio={true}
                token={token}
                serverUrl={serverUrl}
                connectOptions={{ autoSubscribe: true }}
                data-lk-theme="default"
                style={{ height: '100%' }}
                onDisconnected={() => {
                  onClose();
                }}
                onError={(err) => {
                  const msg = err.message || 'LiveKit media error';
                  const isDeviceError = /permission|notallowed|devicesnotfound|notfound|overconstrained|track/i.test(msg);
                  if (isDeviceError) {
                    setMediaWarning(`Media device notice: ${msg}. You can continue the session in audio or listen-only mode.`);
                  } else {
                    setError(msg);
                  }
                }}
              >
                <VideoConference />
                <RoomAudioRenderer />
              </LiveKitRoom>
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              No active session token.
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <footer
          style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid var(--line, #2a2f3a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted, #64748b)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#10b981" /> End-to-end encrypted WebRTC room
          </span>
          <span>Room scoped to authorized mentor request</span>
        </footer>
      </div>
    </div>
  );
}
