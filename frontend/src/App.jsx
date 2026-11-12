import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/health');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setHealthStatus(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend');
      setHealthStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <header style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🚀 SprintPilot</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>
          Full-Stack Agile Sprint &amp; Task Planning Assistant
        </p>
      </header>

      <div style={{
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '1.3rem', marginTop: 0, marginBottom: '16px' }}>System Status</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <strong>Frontend:</strong>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: '#dcfce7',
            color: '#166534'
          }}>
            ● Running (Vite React)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <strong>Backend API:</strong>
          {loading ? (
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Checking http://localhost:5000/api/health...</span>
          ) : healthStatus ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: '500',
              backgroundColor: '#dcfce7',
              color: '#166534'
            }}>
              ● Online: {JSON.stringify(healthStatus)}
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: '500',
              backgroundColor: '#fee2e2',
              color: '#991b1b'
            }}>
              ● Offline ({error})
            </span>
          )}
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          style={{
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: 'white',
            fontWeight: '500',
            fontSize: '0.95rem'
          }}
        >
          {loading ? 'Testing...' : 'Test Backend Health Endpoint'}
        </button>
      </div>

      <footer style={{ marginTop: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
        SprintPilot • Step 1: Initial Setup
      </footer>
    </div>
  );
}

export default App;
