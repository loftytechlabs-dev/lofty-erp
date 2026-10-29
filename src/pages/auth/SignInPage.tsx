import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';
import { ShieldCheck, ArrowRight, CheckCircle2, Lock } from 'lucide-react';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      navigate('/onboarding');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to authenticate with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-md mb-4">
          <span className="font-extrabold text-2xl tracking-tighter">L</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Lofty <span className="text-brand-600">ERP</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
          Simple, connected business operations for small manufacturers and growing enterprises.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-xs text-slate-500 text-center">
              Sign in with your verified Google account to access authorized business workspaces.
            </p>

            {/* Prominent Continue with Google Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Authenticating...' : 'Continue with Google'}</span>
            </button>

            {/* Security note */}
            <div className="flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 pt-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Multi-tenant security. Authorized staff access only.</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-500 text-center">
          <div className="flex items-center justify-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            <span>QR Delivery Scanning</span>
          </div>
          <div className="flex items-center justify-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            <span>Dual Bill & Goods Check</span>
          </div>
        </div>
      </div>
    </div>
  );
};
