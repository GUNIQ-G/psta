import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Button, Badge, Drawer, List, Tag, Empty, Divider } from 'antd';
import {
  DashboardOutlined,
  CalendarOutlined,
  ProjectOutlined,
  FormOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  FolderOutlined,
  AppstoreOutlined,
  ShopOutlined,
  KeyOutlined,
  BellOutlined,
  MessageOutlined,
  MailOutlined,
  FileSearchOutlined,
  ApiOutlined,
  DeleteOutlined,
  CommentOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissionStore } from '../store/permissionStore';
import { useNotificationStore } from '../store/notificationStore';
import { ActionCreateDrawer } from './ActionCreateDrawer';
import { TrashModal } from './TrashModal';
import { systemSettingsApi } from '../api/system-settings';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

// Map routes to resource names for permission checking
const ROUTE_RESOURCE_MAP: { [key: string]: string } = {
  '/dashboard': 'dashboard',
  '/requests': 'requests',
  '/psta': 'psta',
  '/wbs': 'wbs',
  '/report': 'report',
  '/integrated-files': 'integrated-files',
  '/feedback': 'feedback',
  '/clients': 'clients',
  '/projects': 'projects',
  '/services': 'services',
  '/team-status': 'team-status',
  '/actions': 'actions',
  '/teams': 'teams',
  '/users': 'users',
  '/organization': 'organization',
  '/ldap-auth': 'ldap-auth',
  '/ldap-sync': 'ldap-sync',
  '/permissions': 'permissions',
  '/notification-apps': 'notification-apps',
  '/general-settings': 'general-settings',
};

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [systemLogo, setSystemLogo] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
  } = useNotificationStore();

  // Load system logo on mount
  useEffect(() => {
    const loadSystemLogo = async () => {
      try {
        const settings = await systemSettingsApi.getSettings();
        if (settings.systemLogo) {
          setSystemLogo(settings.systemLogo);
        }
      } catch (error) {
        console.error('Failed to load system logo:', error);
      }
    };
    loadSystemLogo();
  }, []);

  // Start polling for notifications on mount
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Listen for custom event to open notification drawer
  useEffect(() => {
    const handleOpenNotifications = () => {
      setNotificationModalOpen(true);
      fetchNotifications();
    };

    window.addEventListener('openNotificationDrawer', handleOpenNotifications);
    return () => {
      window.removeEventListener('openNotificationDrawer', handleOpenNotifications);
    };
  }, [fetchNotifications]);

  // Fetch notifications when modal opens
  useEffect(() => {
    if (notificationModalOpen) {
      fetchNotifications();
    }
  }, [notificationModalOpen, fetchNotifications]);

  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification.id);
    setNotificationModalOpen(false);

    // 알림 타입에 따라 적절한 페이지로 이동
    const { type, itemId, commentId } = notification;

    // 작업 요청 관련 알림 → 작업요청 페이지
    if (type.startsWith('work_request_')) {
      // itemId가 있으면 해당 작업 요청으로 이동
      if (itemId) {
        navigate(`/requests?workRequestId=${itemId}`);
      } else {
        navigate('/requests');
      }
      return;
    }

    // 댓글 관련 알림 → PSTA 페이지 (commentId 우선)
    if (type === 'comment_mention' || type === 'comment_reply') {
      if (commentId) {
        navigate(`/psta?commentId=${commentId}`);
      } else if (itemId) {
        navigate(`/psta?itemId=${itemId}`);
      } else {
        navigate('/psta');
      }
      return;
    }

    // 업무 관련 알림 → PSTA 페이지
    if (type === 'item_assigned' || type === 'item_status_changed' || type === 'item_completed' || type === 'deadline_approaching') {
      if (itemId) {
        navigate(`/psta?itemId=${itemId}`);
      } else {
        navigate('/psta');
      }
      return;
    }

    // 기본: 대시보드로 이동
    navigate('/dashboard');
  };

  // Determine which submenu should be open based on current path
  const getOpenKeys = () => {
    return [];
  };

  // Filter menu items based on permissions
  const filterMenuItems = (items: MenuProps['items']): MenuProps['items'] => {
    if (!items) return items;

    return items
      .map((item: any) => {
        if (!item) return null;

        // Handle group items
        if (item.type === 'group' && item.children) {
          const filteredChildren = filterMenuItems(item.children);
          // Only include group if it has visible children
          if (filteredChildren && filteredChildren.length > 0) {
            return { ...item, children: filteredChildren };
          }
          return null;
        }

        // Handle items with children (submenus)
        if (item.children) {
          const filteredChildren = filterMenuItems(item.children);
          // Check if parent has permission or if any children are visible
          if (filteredChildren && filteredChildren.length > 0) {
            return { ...item, children: filteredChildren };
          }
          return null;
        }

        // Handle regular menu items
        if (item.key) {
          const resource = ROUTE_RESOURCE_MAP[item.key];
          if (resource && !hasPermission(resource, 'canView')) {
            return null;
          }
        }

        return item;
      })
      .filter(Boolean);
  };

  const menuItems: MenuProps['items'] = [
    {
      type: 'group',
      label: '개인 작업',
      children: [
        {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: '대시보드',
          onClick: () => navigate('/dashboard'),
        },
        {
          key: '/requests',
          icon: <FormOutlined />,
          label: '작업요청',
          onClick: () => navigate('/requests'),
        },
      ],
    },
    {
      type: 'group',
      label: '프로젝트 일정',
      children: [
        {
          key: '/psta',
          icon: <CalendarOutlined />,
          label: '일정관리',
          onClick: () => navigate('/psta'),
        },
        {
          key: '/report',
          icon: <FileTextOutlined />,
          label: '보고서 작성',
          onClick: () => navigate('/report'),
        },
      ],
    },
    {
      type: 'group',
      label: '프로젝트 조직',
      children: [
        {
          key: '/organization',
          icon: <TeamOutlined />,
          label: '조직도',
          onClick: () => navigate('/organization'),
        },
      ],
    },
    {
      type: 'group',
      label: '데이터 관리',
      children: [
        {
          key: '/clients',
          icon: <ShopOutlined />,
          label: '클라이언트 관리',
          onClick: () => navigate('/clients'),
        },
        {
          key: '/projects',
          icon: <FolderOutlined />,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>프로젝트 관리</span>
              <Tag color="#722ed1" style={{ marginLeft: 8, marginRight: 0, fontSize: 10 }}>P</Tag>
            </div>
          ),
          onClick: () => navigate('/projects'),
        },
        {
          key: '/services',
          icon: <AppstoreOutlined />,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>서비스 관리</span>
              <Tag color="#1890ff" style={{ marginLeft: 8, marginRight: 0, fontSize: 10 }}>S</Tag>
            </div>
          ),
          onClick: () => navigate('/services'),
        },
        {
          key: '/team-status',
          icon: <TeamOutlined />,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>팀별 현황</span>
              <Tag color="#52c41a" style={{ marginLeft: 8, marginRight: 0, fontSize: 10 }}>T</Tag>
            </div>
          ),
          onClick: () => navigate('/team-status'),
        },
        {
          key: '/actions',
          icon: <CheckCircleOutlined />,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>액션 관리</span>
              <Tag color="#fa8c16" style={{ marginLeft: 8, marginRight: 0, fontSize: 10 }}>A</Tag>
            </div>
          ),
          onClick: () => navigate('/actions'),
        },
        {
          key: '/integrated-files',
          icon: <FileSearchOutlined />,
          label: '통합 파일 관리',
          onClick: () => navigate('/integrated-files'),
        },
      ],
    },
    {
      type: 'group',
      label: '시스템 지원',
      children: [
        {
          key: '/feedback',
          icon: <CommentOutlined />,
          label: '버그/건의',
          onClick: () => navigate('/feedback'),
        },
      ],
    },
    {
      type: 'group',
      label: '시스템 설정',
      children: [
        {
          key: '/general-settings',
          icon: <SettingOutlined />,
          label: '일반',
          onClick: () => navigate('/general-settings'),
        },
        {
          key: '/members',
          icon: <IdcardOutlined />,
          label: '멤버 관리',
          onClick: () => navigate('/members'),
        },
        {
          key: '/notification-apps',
          icon: <ApiOutlined />,
          label: '알림앱 연동',
          onClick: () => navigate('/notification-apps'),
        },
        {
          key: '/permissions',
          icon: <KeyOutlined />,
          label: '권한 관리',
          onClick: () => navigate('/permissions'),
        },
      ],
    },
  ];

  const profileMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '프로필',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'messages',
      icon: <MailOutlined />,
      label: '메시지',
      onClick: () => navigate('/messages'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: logout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <style>{`
        .ant-menu-dark .ant-menu-item-group-title {
          color: rgba(255, 255, 255, 0.85) !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          padding: 16px 16px 8px 24px !important;
          margin-top: 8px !important;
        }

        .ant-menu-dark .ant-menu-item-group-title:first-child {
          margin-top: 0 !important;
        }

        @media print {
          /* 사이드바 완전 숨김 */
          .ant-layout-sider {
            display: none !important;
            width: 0 !important;
            min-width: 0 !important;
          }

          /* 메인 레이아웃 전체 너비 */
          .ant-layout {
            margin-left: 0 !important;
          }

          /* Content 영역 전체 너비 및 여백 제거 */
          .ant-layout-content {
            margin: 0 !important;
            padding: 0 !important;
          }

          .ant-layout-content > div {
            padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>
      <Sider
        width={200}
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: 'rgb(0, 91, 172)',
        }}
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 로고 */}
          <div
            style={{
              height: 64,
              margin: 16,
              background: systemLogo ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              flexShrink: 0,
              padding: systemLogo ? 8 : 0,
            }}
          >
            {systemLogo ? (
              <img
                src={systemLogo}
                alt="System Logo"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 48,
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />
            ) : (
              'PSTA 시스템'
            )}
          </div>

          {/* 스크롤 가능한 메뉴 영역 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              defaultOpenKeys={getOpenKeys()}
              items={filterMenuItems(menuItems)}
              style={{ borderRight: 0 }}
            />
          </div>

          {/* 하단 고정 영역 */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
            }}
          >
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => setActionDrawerOpen(true)}
              block
              size="large"
              style={{
                backgroundColor: 'rgb(0, 140, 214)',
                borderColor: 'rgb(0, 140, 214)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(0, 91, 172)';
                e.currentTarget.style.borderColor = 'rgb(0, 91, 172)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(0, 140, 214)';
                e.currentTarget.style.borderColor = 'rgb(0, 140, 214)';
              }}
            >
              액션 등록
            </Button>
            <Button
              icon={<DeleteOutlined />}
              onClick={() => setTrashModalOpen(true)}
              block
              size="large"
              style={{
                marginTop: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: 'rgba(255, 255, 255, 0.85)',
                fontWeight: 600,
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
            >
              휴지통
            </Button>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Dropdown menu={{ items: profileMenuItems }} placement="topRight" trigger={['click']}>
                <div
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#fff',
                    flex: 1,
                  }}
                >
                  <Avatar icon={<UserOutlined />} size={24} />
                  <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user?.displayName || user?.username}
                    </div>
                  </div>
                </div>
              </Dropdown>
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <BellOutlined
                  style={{
                    fontSize: 18,
                    color: 'rgba(255, 255, 255, 0.85)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setNotificationModalOpen(true);
                    fetchNotifications(); // 모달 열 때 알림 목록 로드
                  }}
                />
              </Badge>
            </div>
          </div>
        </div>
      </Sider>
      <ActionCreateDrawer
        open={actionDrawerOpen}
        onClose={() => setActionDrawerOpen(false)}
        userTeamId={user?.teamId}
      />
      <TrashModal
        open={trashModalOpen}
        onCancel={() => setTrashModalOpen(false)}
        onRestoreSuccess={() => {
          // Optionally refresh data if needed
        }}
      />
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={12}>
              <BellOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ fontSize: 18, fontWeight: 600 }}>알림</span>
              {unreadCount > 0 && (
                <Badge count={unreadCount} style={{ backgroundColor: '#1890ff' }} />
              )}
            </Space>
            {notifications.length > 0 && (
              <Button size="small" type="link" onClick={markAllAsRead}>
                모두 읽음
              </Button>
            )}
          </div>
        }
        placement="right"
        open={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        width={480}
        closable={true}
        styles={{
          body: { padding: 0 },
        }}
      >
        {notifications.length === 0 ? (
          <div style={{ padding: '80px 24px', textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: '#8c8c8c' }}>알림이 없습니다</span>
              }
            />
          </div>
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notification, index) => (
              <div key={notification.id}>
                <List.Item
                  style={{
                    cursor: 'pointer',
                    backgroundColor: notification.isRead ? 'transparent' : '#f6ffed',
                    padding: '16px 24px',
                    transition: 'all 0.2s',
                    borderLeft: notification.isRead ? 'none' : '3px solid #52c41a',
                  }}
                  onClick={() => handleNotificationClick(notification)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = notification.isRead ? '#fafafa' : '#f0f9ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = notification.isRead ? 'transparent' : '#f6ffed';
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<BellOutlined />}
                        size={40}
                        style={{
                          backgroundColor: notification.isRead ? '#d9d9d9' : '#1890ff',
                        }}
                      />
                    }
                    title={
                      <div style={{ marginBottom: 4 }}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: notification.isRead ? 400 : 600,
                          color: notification.isRead ? '#595959' : '#262626',
                          lineHeight: 1.5,
                        }}>
                          {notification.content}
                        </div>
                      </div>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        <Space size={8} wrap>
                          <Tag
                            color={notification.isRead ? 'default' : 'blue'}
                            style={{ margin: 0, fontSize: 11 }}
                          >
                            {notification.type === 'comment_mention' ? '💬 멘션' :
                             notification.type === 'comment_reply' ? '↩️ 댓글' :
                             notification.type === 'work_request_created' ? '📝 작업요청' :
                             notification.type === 'work_request_approved' ? '✅ 승인' :
                             notification.type === 'work_request_rejected' ? '❌ 반려' :
                             notification.type === 'work_request_negotiation' ? '💬 협의' :
                             notification.type === 'work_request_resubmitted' ? '🔄 재요청' :
                             notification.type === 'work_request_assigned' ? '👤 할당' :
                             '📬 알림'}
                          </Tag>
                          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                            {new Date(notification.createdAt).toLocaleString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {notification.FromUser && (
                            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                              · {notification.FromUser.displayName}
                            </span>
                          )}
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
                {index < notifications.length - 1 && (
                  <Divider style={{ margin: 0 }} />
                )}
              </div>
            )}
          />
        )}
      </Drawer>
      <Layout style={{ marginLeft: 200 }}>
        <Content style={{ margin: '24px 16px', overflow: 'initial' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
