'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      email, password, redirect: false,
    });

    if (res?.ok) {
      router.push('/dashboard');
    } else {
      setError('Invalid credentials. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      {/* Background texture */}
      <div className="fixed inset-0 bg-grid-dark bg-grid opacity-30 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-midgreen rounded-xl mb-4 shadow-lg shadow-brand-green/20">
            <span className="text-3xl">🍉</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-brand-cream">MelonOps</h1>
          <p className="text-brand-sage/60 text-sm mt-1">
            Raymon J Land Internal Operations
          </p>
        </div>

        {/* Login form */}
        <div className="card p-6 shadow-xl shadow-brand-dark/50">
          <h2 className="text-sm font-semibold text-brand-warm/70 mb-5 uppercase tracking-wider">
            Staff Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@raymonjland.com"
                  required
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label className="label block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-sage/40" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input pl-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-sage/40 hover:text-brand-sage"
                >
                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-brand-brightred text-xs bg-brand-red/10 border border-brand-red/20 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Signing in...</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand-sage/30 mt-6">
          Internal use only — Branford, FL
        </p>
      </div>
    </div>
  );
}
