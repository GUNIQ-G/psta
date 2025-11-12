import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { PstaSchedule } from './pages/PstaSchedule';
import { WbsView } from './pages/WbsView';
import { ProjectManagement } from './pages/ProjectManagement';
import { ServiceManagement } from './pages/ServiceManagement';
import { ActionManagement } from './pages/ActionManagement';
import { ClientManagement } from './pages/ClientManagement';
import { WorkRequests } from './pages/WorkRequests';
import { Report } from './pages/Report';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Messages } from './pages/Messages';
import { TeamManagement } from './pages/TeamManagement';
import { UserManagement } from './pages/UserManagement';
import { LDAPAuth } from './pages/LDAPAuth';
import { LDAPSettings } from './pages/LDAPSettings';
import { NotificationAppIntegration } from './pages/NotificationAppIntegration';
import { ApprovalRequest } from './pages/ApprovalRequest';
import { UserApproval } from './pages/UserApproval';
import PermissionManagement from './pages/PermissionManagement';
import { IntegratedFileList } from './pages/IntegratedFileList';
import { GeneralSettings } from './pages/GeneralSettings';
import LdapSyncManagement from './pages/LdapSyncManagement';
import OrganizationManagement from './pages/OrganizationManagement';
import { MainLayout } from './components/MainLayout';
import { useAuthStore } from './store/authStore';
import { usePermissionStore } from './store/permissionStore';
import { Result, Button } from 'antd';

// Map routes to resource names for permission checking
const ROUTE_RESOURCE_MAP: { [key: string]: string } = {
  '/dashboard': 'dashboard',
  '/requests': 'requests',
  '/psta': 'psta',
  '/wbs': 'wbs',
  '/report': 'report',
  '/integrated-files': 'integrated-files',
  '/clients': 'clients',
  '/projects': 'projects',
  '/services': 'services',
  '/actions': 'actions',
  '/teams': 'teams',
  '/users': 'users',
  '/organization': 'organization',
  '/ldap-auth': 'ldap-auth',
  '/notification-apps': 'notification-apps',
  '/permissions': 'permissions',
  '/general-settings': 'general-settings',
  '/ldap-sync': 'ldap-sync',
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; resource?: string }> = ({
  children,
  resource
}) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const permissionLoading = usePermissionStore((state) => state.loading);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Wait for user to load before checking permissions
  if (isLoading || !user) {
    return <MainLayout><div>Loading user info...</div></MainLayout>;
  }

  // Check if user needs approval (skip for ADMIN only)
  if (!user.isVerified && user.role !== 'ADMIN') {
    return <Navigate to="/approval-request" replace />;
  }

  // Wait for permissions to load
  if (permissionLoading) {
    return <MainLayout><div>Loading permissions...</div></MainLayout>;
  }

  // Check permission if resource is specified
  if (resource && !hasPermission(resource, 'canView')) {
    return (
      <MainLayout>
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
      </MainLayout>
    );
  }

  return <MainLayout>{children}</MainLayout>;
};

function App() {
  const fetchUser = useAuthStore((state) => state.fetchUser);

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <ConfigProvider
      locale={koKR}
      theme={{
        token: {
          colorPrimary: 'rgb(0, 140, 214)', // 더존테크윌 메인 블루
          colorLink: 'rgb(0, 140, 214)',
          colorLinkHover: 'rgb(0, 91, 172)', // 더존테크윌 다크 블루
          borderRadius: 4,
        },
        components: {
          Button: {
            primaryColor: '#fff',
          },
          Menu: {
            itemSelectedBg: 'rgba(0, 140, 214, 0.1)',
            itemSelectedColor: 'rgb(0, 140, 214)',
          },
        },
      }}
    >
      <AntdApp>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/approval-request" element={<ApprovalRequest />} />
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute resource="dashboard">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psta"
            element={
              <ProtectedRoute resource="psta">
                <PstaSchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wbs"
            element={
              <ProtectedRoute resource="wbs">
                <WbsView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute resource="projects">
                <ProjectManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/services"
            element={
              <ProtectedRoute resource="services">
                <ServiceManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/actions"
            element={
              <ProtectedRoute resource="actions">
                <ActionManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute resource="clients">
                <ClientManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/requests"
            element={
              <ProtectedRoute resource="requests">
                <WorkRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report"
            element={
              <ProtectedRoute resource="report">
                <Report />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrated-files"
            element={
              <ProtectedRoute resource="integrated-files">
                <IntegratedFileList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute resource="teams">
                <TeamManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute resource="users">
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ldap-auth"
            element={
              <ProtectedRoute resource="ldap-auth">
                <LDAPAuth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ldap-settings/:id"
            element={
              <ProtectedRoute resource="ldap-auth">
                <LDAPSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notification-apps"
            element={
              <ProtectedRoute resource="notification-apps">
                <NotificationAppIntegration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/general-settings"
            element={
              <ProtectedRoute resource="general-settings">
                <GeneralSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/permissions"
            element={
              <ProtectedRoute resource="permissions">
                <PermissionManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ldap-sync"
            element={
              <ProtectedRoute resource="ldap-sync">
                <LdapSyncManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organization"
            element={
              <ProtectedRoute resource="organization">
                <OrganizationManagement />
              </ProtectedRoute>
            }
          />
        </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;