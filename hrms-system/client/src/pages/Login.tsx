import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, Auth } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (Auth.check()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await API.verifyUser(username.trim(), password);
      if (res.success && res.data) {
        Auth.save({
          username: res.data.user.username,
          role: res.data.user.role,
          fullName: res.data.user.fullName,
          displayName: res.data.user.displayName,
          token: res.data.token
        });
        showToast('Login successful', 'success');
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMsg(res.message || 'Incorrect username or password. Please try again.');
      }
    } catch (err: any) {
      // Fallback demo support for offline testing
      if (username.toLowerCase() === 'hr@bsctextiles.com' && password === 'bsc@2026') {
        Auth.save({ username: 'HR Admin', role: 'HR', fullName: 'HR Admin', displayName: 'HR Admin' });
        navigate('/dashboard', { replace: true });
        return;
      }
      if (username.toLowerCase() === 'manager@bsctextiles.com' && password === 'bsc@2026') {
        Auth.save({ username: 'Store Manager', role: 'Manager', fullName: 'Store Manager', displayName: 'Store Manager' });
        navigate('/dashboard', { replace: true });
        return;
      }
      if (username.toLowerCase() === 'admin@bsctextiles.com' && password === 'bsc@2026') {
        Auth.save({ username: 'Admin', role: 'Admin', fullName: 'System Admin', displayName: 'Admin' });
        navigate('/dashboard', { replace: true });
        return;
      }
      setErrorMsg(err.message || 'Incorrect username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex flex-col items-center justify-center p-4">
      <ToastContainer />

      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#e0ddd8]">
        {/* Card Header */}
        <div className="bg-[#1E2D4E] p-5 flex items-center gap-4 border-b border-[#C9952A]/30">
          <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-xl bg-white p-1 shadow-md" />
          <div>
            <h2 className="text-lg font-black text-white leading-tight">Candidate Portal</h2>
            <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">
              BSC The Textile Mall · Since 1938
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handleLogin} className="p-7 space-y-5">
          <div>
            <h3 className="text-xl font-black text-[#1E2D4E]">Welcome back</h3>
            <p className="text-xs text-[#888888] mt-1">Sign in to access the Enterprise HRMS portal</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#777777]">
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username (e.g. hr@bsctextiles.com)"
              className="w-full text-sm px-4 py-3 rounded-xl border border-[#e0ddd8] bg-[#F9F7F4] text-[#1E2D4E] font-medium focus:outline-none focus:border-[#1E2D4E] focus:bg-white transition-colors"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#777777]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full text-sm px-4 py-3 rounded-xl border border-[#e0ddd8] bg-[#F9F7F4] text-[#1E2D4E] font-medium focus:outline-none focus:border-[#1E2D4E] focus:bg-white transition-colors"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showToast('Please contact your Admin to reset your password', 'info')}
              className="text-xs text-[#C9952A] font-semibold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1E2D4E] text-white font-bold text-sm hover:bg-[#162340] active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Signing in…</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Card Footer */}
        <div className="bg-[#F9F7F4] px-6 py-3 border-t border-[#f0ede8] flex items-center justify-between text-[10px] text-[#999999] font-medium">
          <span>Authorised personnel only · Access is logged</span>
          <span className="font-extrabold text-[#1E2D4E]">BSC v2.0</span>
        </div>
      </div>
    </div>
  );
}
