import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBusiness } from '../../contexts/BusinessContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { acceptBusinessInvitation, getInvitationDetails } from '../../services/businessService';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import { Shield, ArrowLeft, ArrowRight, HelpCircle, CheckCircle, LogIn, UserCheck } from 'lucide-react';
import { BusinessInvitation } from '../../types';

export const JoinBusinessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signInWithGoogle, signOut } = useAuth();
  const { refreshBusinesses, switchBusiness } = useBusiness();
  const { t } = useLanguage();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<{ inv?: BusinessInvitation; businessName?: string } | null>(null);

  useEffect(() => {
    const queryCode = searchParams.get('code');
    if (queryCode) {
      const cleanCode = queryCode.trim().toUpperCase();
      setCode(cleanCode);
      sessionStorage.setItem('pending_invite_code', cleanCode);

      // Fetch invitation details to show rich preview
      getInvitationDetails(cleanCode).then(res => {
        if (res.success && res.invitation) {
          setInvitationInfo({ inv: res.invitation, businessName: res.businessName });
        }
      });
    } else {
      const savedCode = sessionStorage.getItem('pending_invite_code');
      if (savedCode) {
        setCode(savedCode);
        getInvitationDetails(savedCode).then(res => {
          if (res.success && res.invitation) {
            setInvitationInfo({ inv: res.invitation, businessName: res.businessName });
          }
        });
      }
    }
  }, [searchParams]);

  // Whenever code is available, dynamically resolve business name & role
  useEffect(() => {
    if (code && code.trim().length >= 6) {
      getInvitationDetails(code.trim().toUpperCase()).then(res => {
        if (res.success && res.invitation) {
          setInvitationInfo({ inv: res.invitation, businessName: res.businessName });
        }
      });
    }
  }, [code]);

  const executeJoin = async (targetCode: string) => {
    if (!user) {
      setError('Please sign in first to join the business.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await acceptBusinessInvitation(
        user.uid,
        user.email,
        user.displayName,
        targetCode.trim().toUpperCase()
      );

      if (!res.success) {
        setError(res.error || 'Failed to accept invitation.');
        setLoading(false);
        return;
      }

      sessionStorage.removeItem('pending_invite_code');
      await refreshBusinesses();
      switchBusiness(res.businessId);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to accept invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignInAndJoin = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
      // user will update via AuthContext
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setError('Sign-in failed. Please try again.');
      setSigningIn(false);
    }
  };

  // If user just logged in and we have a code, automatically accept!
  useEffect(() => {
    if (user && code && signingIn) {
      setSigningIn(false);
      executeJoin(code);
    }
  }, [user, code, signingIn]);

  const handleJoinFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter your invitation code.');
      return;
    }
    executeJoin(code);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.back', 'Back to Home')}</span>
          </button>
          <LanguageSelector variant="compact" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 text-brand-600 mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">
              {invitationInfo?.businessName ? `Join ${invitationInfo.businessName}` : 'Join Existing Business'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {invitationInfo?.inv?.role
                ? `You have been authorized to join as ${invitationInfo.inv.role}.`
                : 'Enter your 8-character invitation code to join your company workspace.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {error}
            </div>
          )}

          {/* If invitation code is loaded & user is NOT signed in: Sign in with Google first */}
          {!user ? (
            <div className="space-y-4">
              <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-lg text-xs space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center">
                  <UserCheck className="w-4 h-4 mr-1.5 text-brand-600" />
                  Authentication Required
                </div>
                <p className="text-slate-600">
                  Please sign in with your work or personal Google account to link your authorization and activate your access.
                </p>
                {code && (
                  <div className="pt-1 text-[11px] text-slate-500">
                    Invitation Code: <strong className="font-mono text-slate-800 tracking-wider">{code}</strong>
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleSignInAndJoin}
                isLoading={signingIn}
                className="w-full flex items-center justify-center space-x-2 py-2.5"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                <span>Sign In with Google to Join</span>
              </Button>
            </div>
          ) : (
            /* User is signed in */
            <form onSubmit={handleJoinFormSubmit} className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block mb-0.5">Signed in as:</span>
                  <div className="font-semibold text-slate-900">{user.displayName || user.email}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <button
                    type="button"
                    onClick={async () => {
                      sessionStorage.setItem('pending_invite_code', code);
                      await signOut();
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 underline font-semibold"
                  >
                    Choose another account
                  </button>
                  <span className="text-[10px] text-slate-400 mt-0.5">Switch Google account</span>
                </div>
              </div>

              <Input
                label="Invitation Code"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7X9K2M4P"
                required
                className="text-center font-mono tracking-widest text-base uppercase"
              />

              <Button
                variant="primary"
                type="submit"
                isLoading={loading}
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Accept Invitation &amp; Enter Workspace
              </Button>
            </form>
          )}

          {/* Explanation if user has no invitation */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 space-y-2">
            <div className="flex items-start space-x-2">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-700">Don't have an invitation code?</strong>
                <p className="mt-0.5">
                  Ask your business administrator or owner to invite you from the <em>Team Members</em> module inside Lofty ERP.
                </p>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate('/create-business')}
                className="text-xs text-brand-600 hover:underline font-medium"
              >
                Or create your own new business workspace &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
