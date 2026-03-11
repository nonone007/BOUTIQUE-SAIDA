import React, { useState, useEffect } from 'react';

const API_URL = "https://boutique-saida-api.bilelahmed2000.workers.dev";

function App() {
    const [stats, setStats] = useState({ products: 0, visitors: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const [catRes, statsRes] = await Promise.all([
                    fetch(`${API_URL}/api/catalog`),
                    fetch(`${API_URL}/api/stats`)
                ]);

                const catData = await catRes.json();
                const statsData = await statsRes.json();

                setStats({
                    products: catData.catalog?.length || 0,
                    visitors: statsData.total || 0
                });
            } catch (err) {
                console.error("Failed to fetch dashboard stats:", err);
            } finally {
                setTimeout(() => setLoading(false), 600); // Smooth entrance
            }
        }

        fetchStats();
    }, []);

    if (loading) return (
        <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#ff4b81',
            fontSize: '1.1rem',
            fontWeight: '600',
            fontFamily: '"Outfit", sans-serif'
        }}>
            <div className="loader">جاري تحميل لوحة التحكم...</div>
        </div>
    );

    return (
        <div className="react-dashboard" style={{
            padding: '30px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f9fbfd 100%)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
            margin: '40px auto',
            border: '1px solid rgba(0,0,0,0.03)',
            maxWidth: '800px',
            fontFamily: '"Outfit", "Playfair Display", serif',
            animation: 'fadeIn 0.8s ease-out'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ margin: '0', fontSize: '1.6rem', color: '#1e293b', fontWeight: '700' }}>Admin Overview</h2>
                    <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Live metrics from Cloudflare Workers</p>
                </div>
                <div style={{ padding: '8px 16px', background: '#00c85315', color: '#00c853', borderRadius: '100px', fontSize: '0.85rem', fontWeight: '600' }}>
                    ● Connected to Worker
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                <StatCard
                    label="Total Products"
                    value={stats.products}
                    icon="🛍️"
                    color="#ff4b81"
                    gradient="linear-gradient(135deg, #ff4b81 0%, #ff709b 100%)"
                />
                <StatCard
                    label="Total Visitors"
                    value={stats.visitors}
                    icon="👁️"
                    color="#0061ff"
                    gradient="linear-gradient(135deg, #0061ff 0%, #60efff 100%)"
                />
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .react-dashboard { direction: ltr; }
      `}</style>
        </div>
    );
}

function StatCard({ label, value, icon, color, gradient }) {
    return (
        <div style={{
            padding: '24px',
            background: '#fff',
            borderRadius: '20px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.02)',
            border: '1px solid rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            transition: 'transform 0.3s ease',
            cursor: 'default'
        }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{icon}</div>
            <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '500' }}>{label}</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b' }}>{value}</div>
            <div style={{ height: '4px', width: '40px', background: gradient, borderRadius: '2px', marginTop: '4px' }}></div>
        </div>
    );
}

export default App;
