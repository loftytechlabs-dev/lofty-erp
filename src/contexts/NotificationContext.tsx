import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useBusiness } from './BusinessContext';
import { AppNotification } from '../types';
import { localStore } from '../services/store';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeBusiness } = useBusiness();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadNotifications = useCallback(() => {
    if (!activeBusiness) {
      setNotifications([]);
      return;
    }
    const list = localStore.getNotifications(activeBusiness.id);
    setNotifications(list);
  }, [activeBusiness]);

  useEffect(() => {
    loadNotifications();
    const unsub = localStore.subscribe(() => {
      loadNotifications();
    });
    return () => unsub();
  }, [loadNotifications]);

  const markAsRead = (id: string) => {
    if (!activeBusiness) return;
    localStore.markNotificationAsRead(activeBusiness.id, id);
    loadNotifications();
  };

  const markAllAsRead = () => {
    if (!activeBusiness) return;
    notifications.forEach(n => {
      if (!n.isRead) {
        localStore.markNotificationAsRead(activeBusiness.id, n.id);
      }
    });
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
