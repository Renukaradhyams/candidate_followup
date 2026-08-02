import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, Auth } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react';

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
      setErrorMsg(err.message || 'Incorrect username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex flex-col items-center justify-center p-4 sm:p-6">
      <ToastContainer />

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#e2dfd7] animate-fade-in">
        {/* Card Header */}
        <div className="bg-[#1E2D4E] p-6 flex items-center gap-4 border-b border-[#C9952A]/30">
          <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-md border border-white/20" />
          <div>
            <h2 className="text-lg font-black text-white leading-tight tracking-tight">Enterprise ATS Portal</h2>
            <div className="text-[10px] text-[#C9952A] font-bold uppercase tracking-widest mt-0.5">
              BSC The Textile Mall · Since 1938
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handleLogin} className="p-7 space-y-5">
          <div>
            <h3 className="text-xl font-black text-[#1E2D4E] tracking-tight">Welcome Back</h3>
            <p className="text-xs text-[#777777] font-medium mt-1">Sign in with your authorized system credentials</p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[#777777]">
              Username / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] focus:bg-white transition-all shadow-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[#777777]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E] focus:bg-white transition-all shadow-xs"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showToast('Please contact your System Administrator to reset your password', 'info')}
              className="text-xs text-[#C9952A] font-bold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-xs tracking-wide hover:bg-[#162340] active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Authenticating Credentials…</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Card Footer */}
        <div className="bg-[#F9F7F4] px-7 py-3.5 border-t border-[#e2dfd7] flex items-center justify-between text-[10px] text-[#777777] font-semibold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C9952A]" />
            <span>Authorized access only · Encrypted session</span>
          </span>
          <span className="font-black text-[#1E2D4E]">BSC v2.5</span>
        </div>
      </div>
    </div>
  );
}
