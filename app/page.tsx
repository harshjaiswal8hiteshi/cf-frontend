"use client";
import { useEffect, useState } from "react";
import { Activity, Database, Zap, Server, AlertCircle, Loader2 } from "lucide-react";
import config from "../config"; 

// Define proper types for the API responses
interface BackendStatus {
  app: string;
  db_connected: boolean;
  redis_connected: boolean;
  ai_to_backend_connection: boolean;
}

interface AIStatus {
  app: string;
  status: string;
  backend_to_ai_connection: boolean;
  db_connected: boolean;
  redis_connected: boolean;
}

interface DashboardStatus {
  backend: BackendStatus | null;
  ai: AIStatus | null;
}

export default function Home() {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const aiBackendUrl = config.aiBackendUrl;
  const appBackendUrl = config.appBackendUrl;

  useEffect(() => {
    async function fetchStatus() {
      try {
        if (!appBackendUrl || !aiBackendUrl) {
          throw new Error("Backend URLs are not defined");
        }

        const [backendResponse, aiResponse] = await Promise.all([
          fetch(appBackendUrl),
          fetch(aiBackendUrl)
        ]);

        const backend = await backendResponse.json();
        const ai = await aiResponse.json();

        setStatus({ backend, ai });
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        setError("Failed to fetch status");
        console.error("Error fetching status:", err);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [appBackendUrl, aiBackendUrl]);

  const StatusBadge = ({ connected }: { connected: boolean }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '500',
      backgroundColor: connected ? '#d1fae5' : '#fee2e2',
      color: connected ? '#065f46' : '#991b1b'
    }}>
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        marginRight: '8px',
        backgroundColor: connected ? '#10b981' : '#ef4444'
      }}></span>
      {connected ? "Connected" : "Disconnected"}
    </span>
  );

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #f9fafb, #e5e7eb)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          padding: '32px',
          maxWidth: '448px',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#dc2626', marginBottom: '16px' }}>
            <AlertCircle size={32} />
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Connection Error</h2>
          </div>
          <p style={{ color: '#4b5563', margin: 0 }}>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '24px',
              width: '100%',
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #f9fafb, #e5e7eb)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={48} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={{ color: '#4b5563', fontSize: '18px' }}>Loading status...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #f9fafb, #e5e7eb)',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Activity size={32} color="#2563eb" />
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              System Status Dashboard
            </h1>
          </div>
          {lastUpdated && (
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px' 
        }}>
          {/* Backend Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(to right, #3b82f6, #2563eb)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white' }}>
                <Server size={24} />
                <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Application Backend Metric </h2>
              </div>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <Database size={20} />
                  <span style={{ fontWeight: '500' }}>Database</span>
                </div>
                <StatusBadge connected={status.backend?.db_connected ?? false} />
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <Zap size={20} />
                  <span style={{ fontWeight: '500' }}>Redis Cache</span>
                </div>
                <StatusBadge connected={status.backend?.redis_connected ?? false} />
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '12px 0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <Activity size={20} />
                  <span style={{ fontWeight: '500' }}>Backend-to-AI Connection</span>
                </div>
                <StatusBadge connected={status.backend?.ai_to_backend_connection ?? false} />
              </div>
            </div>
          </div>

          {/* AI Backend Card */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div
              style={{
                background: 'linear-gradient(to right, #a855f7, #9333ea)',
                padding: '24px'
              }}
            >
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white' }}>
                <Activity size={24} />
                <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>AI Backend </h2>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Service Status */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid #f3f4f6'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <Server size={20} />
                  <span style={{ fontWeight: '500' }}>Service Status</span>
                </div>
                <StatusBadge connected={status.ai?.status === 'running'} />
              </div>

              {/* Backend-to-AI Connection */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid #f3f4f6'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <Activity size={20} />
                  <span style={{ fontWeight: '500' }}>AI-to-Backend Connection</span>
                </div>
                <StatusBadge connected={status.ai?.backend_to_ai_connection ?? false} />
              </div>

              {/* Database */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid #f3f4f6'
                }}
                
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <Database size={20} />
                  <span style={{ fontWeight: '500' }}>Database</span>
                </div>
                <StatusBadge connected={status.ai?.db_connected ?? false} />
              </div>

              {/* Redis Cache */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
                  <Zap size={20} />
                  <span style={{ fontWeight: '500' }}>Redis Cache</span>
                </div>
                <StatusBadge connected={status.ai?.redis_connected ?? false} />
              </div>
            </div>
          </div>

        </div>

        {/* Footer Note */}
        <div style={{ 
          marginTop: '24px', 
          textAlign: 'center', 
          fontSize: '14px', 
          color: '#6b7280' 
        }}>
          Auto-refreshes every 30 seconds
        </div>
      </div>
    </div>
  );
}
