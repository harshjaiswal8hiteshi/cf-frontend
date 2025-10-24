// pages/api/health.js
export default function handler(req, res) {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'frontend',
    version:'5.0'
  });
}