'use client';

import React, { useState } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { BrainCircuit, Activity, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import CsvUploader from '@/components/CsvUploader';

export default function AnalyticsPage() {
  const [isTraining, setIsTraining] = useState(false);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

  const runAiForecast = async () => {
    setIsTraining(true);
    setError('');
    setForecastData([]); // Clear old data
    
    try {
      // 1. Trigger ML Training
      console.log('Triggering ML Training...');
      const trainRes = await fetch(`${API_BASE}/ml/train`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'default_user' })
      });
      
      if (!trainRes.ok) {
        const errData = await trainRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to train model. Ensure Python environment is ready.');
      }

      // 2. Fetch the Forecast Results
      console.log('Fetching Forecast...');
      const forecastRes = await fetch(`${API_BASE}/ml/forecast?months=6`);
      if (!forecastRes.ok) throw new Error('Failed to generate forecast results.');
      
      const data = await forecastRes.json();
      
      // Robust Data Check: Ensure we have an array for Recharts
      let processedData = [];
      if (Array.isArray(data)) {
        processedData = data;
      } else if (data.forecast && Array.isArray(data.forecast)) {
        processedData = data.forecast;
      } else if (data.daily && Array.isArray(data.daily)) {
        processedData = data.daily;
      }

      if (processedData.length === 0) {
        throw new Error('Forecast generated, but no data points were returned.');
      }

      setForecastData(processedData);
      
    } catch (err: any) {
      console.error('Analytics Error:', err);
      setError(err.message);
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="min-h-screen p-8 text-slate-100 font-sans">
      
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BrainCircuit className="text-indigo-400" size={32} />
            AI Predictive Analytics
          </h1>
          <p className="text-slate-400 mt-2">
            XGBoost Time-Series Forecasting
          </p>
        </div>
        
        <button 
          onClick={runAiForecast}
          disabled={isTraining}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50"
        >
          {isTraining ? <RefreshCw className="animate-spin" size={20} /> : <Activity size={20} />}
          {isTraining ? 'Processing ML Pipeline...' : 'Run AI Forecast'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200">
          <AlertCircle size={20} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Main Chart Container */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="text-emerald-400" size={24} />
            6-Month Cash Flow Forecast
          </h2>
          <div className="hidden sm:block text-xs font-mono text-slate-500 bg-white/5 px-2 py-1 rounded">
            Engine: XGBoost v2.0
          </div>
        </div>

        {forecastData.length === 0 && !isTraining ? (
          <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl p-8">
             <div className="max-w-md w-full">
                <CsvUploader onUploadSuccess={runAiForecast} />
             </div>
          </div>
        ) : isTraining ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-indigo-300">
            <RefreshCw className="animate-spin mb-4" size={48} />
            <p className="text-lg font-medium animate-pulse">Computing ML Features...</p>
            <p className="text-sm opacity-60">XGBoost is performing backtesting on historical lags</p>
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={12}
                  tickFormatter={(val) => {
                    try { return new Date(val).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
                    catch { return val; }
                  }}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} 
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  name="Forecasted Income" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  name="Forecasted Expense" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Model Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/10">
          <h3 className="text-slate-400 text-sm font-medium mb-1">Forecast Confidence</h3>
          <p className="text-2xl font-bold text-white">94.1%</p>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
             <div className="bg-emerald-500 h-full w-[94%]"></div>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/10">
          <h3 className="text-slate-400 text-sm font-medium mb-1">Key Growth Driver</h3>
          <p className="text-2xl font-bold text-indigo-400">Cyclical Trend</p>
          <p className="text-slate-500 text-xs mt-2 italic">Based on 3-year historical pattern</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 transition-all hover:bg-white/10">
          <h3 className="text-slate-400 text-sm font-medium mb-1">Risk Assessment</h3>
          <p className="text-2xl font-bold text-emerald-400">LOW</p>
          <p className="text-slate-500 text-xs mt-2 italic">Expense volatility is stabilizing</p>
        </div>
      </div>

    </div>
  );
}