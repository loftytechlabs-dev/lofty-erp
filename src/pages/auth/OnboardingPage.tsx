import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';
import {
  Briefcase,
  Users2,
  PackageCheck,
  Receipt,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface OnboardingOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultAction: string; // target route
}

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateOnboarding } = useAuth();
  const [selectedId, setSelectedId] = useState<string>('option-1');
  const [loading, setLoading] = useState(false);

  const options: OnboardingOption[] = [
    {
      id: 'option-1',
      title: 'I own or manage a business',
      description: 'Set up my business and manage vendors, purchases, inventory, and daily operations.',
      icon: <Briefcase className="w-6 h-6 text-brand-600" />,
      defaultAction: '/create-business',
    },
    {
      id: 'option-2',
      title: 'I work for a business',
      description: 'Join an existing business and access the tools my team has authorized me to use.',
      icon: <Users2 className="w-6 h-6 text-blue-600" />,
      defaultAction: '/join',
    },
    {
      id: 'option-3',
      title: 'I manage purchasing or inventory',
      description: 'Work with suppliers, purchase orders, incoming deliveries, and stock.',
      icon: <PackageCheck className="w-6 h-6 text-emerald-600" />,
      defaultAction: '/join',
    },
    {
      id: 'option-4',
      title: 'I manage accounts or bills',
      description: 'Review supplier invoices, outstanding bills, and payment records.',
      icon: <Receipt className="w-6 h-6 text-indigo-600" />,
      defaultAction: '/join',
    },
  ];

  const handleContinue = async () => {
    const selected = options.find(o => o.id === selectedId);
    if (!selected) return;

    setLoading(true);
    try {
      await updateOnboarding(selected.title);
      navigate(selected.defaultAction);
    } catch (err) {
      console.error('Failed to save onboarding preference:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 text-brand-600 mb-3">
            <span className="font-bold text-lg">L</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            How will you use Lofty ERP?
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose the option that best describes what you want to do. We'll help you get started.
          </p>
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {options.map(opt => {
            const isSelected = selectedId === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setSelectedId(opt.id)}
                className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 mr-4 shrink-0">
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{opt.title}</h3>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-brand-600 bg-brand-600' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{opt.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Important Role & Permissions Disclaimer as required by Section 7 */}
        <div className="mt-6 p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-800">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <strong>Role Selection Rule:</strong> This screen identifies your intended workflow. It does not grant permissions. Actual access privileges are authorized by the business owner through membership settings.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            Skip for now
          </button>
          <Button
            variant="primary"
            size="md"
            onClick={handleContinue}
            isLoading={loading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
