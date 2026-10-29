import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Business, BusinessMember, BusinessRole } from '../types';
import { ROLE_PERMISSIONS, RolePermissions } from '../lib/constants';
import { localStore } from '../services/store';
import { getBusinessesForUser, getBusinessMembers } from '../services/businessService';

interface BusinessContextType {
  activeBusiness: Business | null;
  businesses: Business[];
  currentMember: BusinessMember | null;
  role: BusinessRole;
  permissions: RolePermissions;
  loading: boolean;
  switchBusiness: (businessId: string) => void;
  refreshBusinesses: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(null);
  const [currentMember, setCurrentMember] = useState<BusinessMember | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadBusinesses = useCallback(async (showLoader = false) => {
    if (!user) {
      setBusinesses([]);
      setActiveBusiness(null);
      setCurrentMember(null);
      setLoading(false);
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    try {
      const bizList = await getBusinessesForUser(user.uid);
      setBusinesses(bizList);

      if (bizList.length > 0) {
        // Retain currently active business if it still exists in the user's businesses
        const currentSavedId = localStorage.getItem(`active_biz_${user.uid}`);
        let targetBiz = bizList.find(b => b.id === currentSavedId) || bizList[0];

        setActiveBusiness(prev => {
          if (prev && bizList.some(b => b.id === prev.id)) {
            targetBiz = prev;
            return prev;
          }
          return targetBiz;
        });

        localStorage.setItem(`active_biz_${user.uid}`, targetBiz.id);

        // Fetch user's membership in target business
        const members = await getBusinessMembers(targetBiz.id);
        const match = members.find(m => m.uid === user.uid);
        if (match) {
          setCurrentMember(prev => (prev?.uid === match.uid && prev?.role === match.role ? prev : match));
        } else {
          // Check local store first before adding to prevent infinite store mutation loop
          const localMembers = localStore.getMembers(targetBiz.id);
          const localMatch = localMembers.find(m => m.uid === user.uid);
          if (localMatch) {
            setCurrentMember(prev => (prev?.uid === localMatch.uid && prev?.role === localMatch.role ? prev : localMatch));
          } else {
            const assignedRole: BusinessRole = (targetBiz.ownerUid === user.uid || !targetBiz.ownerUid) ? 'Owner' : 'Purchasing';
            const newMember: BusinessMember = {
              uid: user.uid,
              businessId: targetBiz.id,
              email: user.email,
              displayName: user.displayName || 'Owner',
              role: assignedRole,
              joinedAt: targetBiz.createdAt || new Date().toISOString(),
            };
            localStore.addMember(newMember);
            setCurrentMember(newMember);
          }
        }
      } else {
        setActiveBusiness(null);
        setCurrentMember(null);
      }
    } catch (err) {
      console.warn('Failed to load businesses:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBusinesses(true);
  }, [loadBusinesses]);

  const switchBusiness = (businessId: string) => {
    const target = businesses.find(b => b.id === businessId);
    if (target && user) {
      setActiveBusiness(target);
      localStorage.setItem(`active_biz_${user.uid}`, businessId);

      // Immediately resolve member role in target business
      const members = localStore.getMembers(businessId);
      const match = members.find(m => m.uid === user.uid);
      if (match) {
        setCurrentMember(match);
      } else {
        setCurrentMember({
          uid: user.uid,
          businessId: target.id,
          email: user.email,
          displayName: user.displayName,
          role: (target.ownerUid === user.uid || !target.ownerUid) ? 'Owner' : 'Purchasing',
          joinedAt: target.createdAt,
        });
      }
    }
  };

  const activeRole: BusinessRole = currentMember?.role || 'Owner';
  const permissions = ROLE_PERMISSIONS[activeRole];

  return (
    <BusinessContext.Provider
      value={{
        activeBusiness,
        businesses,
        currentMember,
        role: activeRole,
        permissions,
        loading,
        switchBusiness,
        refreshBusinesses: loadBusinesses,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
