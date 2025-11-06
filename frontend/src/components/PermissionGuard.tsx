import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissionStore } from '../store/permissionStore';
import { Result, Button } from 'antd';

interface PermissionGuardProps {
  resource: string;
  action?: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  resource,
  action = 'canView',
  children,
  fallback,
}) => {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const loading = usePermissionStore((state) => state.loading);

  // Wait for permissions to load
  if (loading) {
    return null;
  }

  // Check if user has permission
  if (!hasPermission(resource, action)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default fallback: redirect to dashboard with error message
    return (
      <Result
        status="403"
        title="접근 권한이 없습니다"
        subTitle="이 페이지에 접근할 권한이 없습니다."
        extra={
          <Button type="primary" onClick={() => window.location.href = '/dashboard'}>
            대시보드로 이동
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};
