import React from 'react';
import { usePermissionStore } from '../store/permissionStore';

interface PermissionButtonProps {
  resource: string;
  action: 'canCreate' | 'canUpdate' | 'canDelete';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that renders children only if user has the required permission
 * Used to conditionally show/hide action buttons (Create, Update, Delete)
 */
export const PermissionButton: React.FC<PermissionButtonProps> = ({
  resource,
  action,
  children,
  fallback = null,
}) => {
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  if (!hasPermission(resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Hook to check if user has specific permission
 * Usage: const canCreate = useHasPermission('clients', 'canCreate');
 */
export const useHasPermission = (
  resource: string,
  action: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'
): boolean => {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  return hasPermission(resource, action);
};
