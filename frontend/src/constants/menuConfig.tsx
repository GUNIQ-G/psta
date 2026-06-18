/**
 * PSTA 메뉴 단일 설정 파일
 *
 * 새 메뉴 추가 시 이 파일만 수정하면:
 *   - 사이드바 메뉴 자동 반영 (group + icon 있는 항목만)
 *   - ProtectedRoute 권한 체크 자동 반영
 *   - 권한관리 페이지 리소스 목록 자동 반영
 *   - DB에 없는 Permission 행 자동 생성 (시드 API 호출)
 */
import React from 'react';
import {
  DashboardOutlined,
  FormOutlined,
  CalendarOutlined,
  FileTextOutlined,
  TeamOutlined,
  ShopOutlined,
  FolderOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  CommentOutlined,
  SettingOutlined,
  IdcardOutlined,
  ApiOutlined,
  KeyOutlined,
  UserOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  SyncOutlined,
} from '@ant-design/icons';

export interface MenuEntry {
  route: string;       // URL 경로, e.g. '/dashboard'
  resource: string;    // Permission 리소스 키, e.g. 'dashboard'
  label: string;       // 화면 표시 레이블
  group?: string;      // 사이드바 그룹명 (없으면 사이드바에 표시 안 함)
  icon?: React.ReactNode;  // 사이드바 아이콘 (없으면 사이드바에 표시 안 함)
  badge?: { text: string; color: string };  // P/S/T/A 배지
  permGroup?: string;  // 권한관리 UI 그룹 (없으면 group 사용)
}

export const MENU_ENTRIES: MenuEntry[] = [
  // ── 개인 작업 ───────────────────────────────────────────────
  {
    route: '/dashboard', resource: 'dashboard', label: '대시보드',
    group: '개인 작업', icon: <DashboardOutlined />,
  },
  {
    route: '/requests', resource: 'requests', label: '작업 요청',
    group: '개인 작업', icon: <FormOutlined />,
  },

  // ── 프로젝트 일정 ────────────────────────────────────────────
  {
    route: '/psta', resource: 'psta', label: '일정관리',
    group: '프로젝트 일정', icon: <CalendarOutlined />,
  },
  {
    route: '/wbs', resource: 'wbs', label: 'WBS',
    permGroup: '프로젝트 일정',
    // 사이드바 없음: group/icon 미설정 (직접 URL 접근만 가능)
  },
  {
    route: '/report', resource: 'report', label: '보고서 작성',
    group: '프로젝트 일정', icon: <FileTextOutlined />,
  },
  {
    route: '/integrated-files', resource: 'integrated-files', label: '통합 파일 관리',
    group: '프로젝트 일정', icon: <FileSearchOutlined />,
  },

  // ── 프로젝트 조직 ────────────────────────────────────────────
  {
    route: '/organization', resource: 'organization', label: '조직도',
    group: '프로젝트 조직', icon: <ApartmentOutlined />,
  },

  // ── 데이터 관리 ──────────────────────────────────────────────
  {
    route: '/clients', resource: 'clients', label: '클라이언트 관리',
    group: '데이터 관리', icon: <ShopOutlined />,
  },
  {
    route: '/projects', resource: 'projects', label: '프로젝트 관리',
    group: '데이터 관리', icon: <FolderOutlined />,
    badge: { text: 'P', color: '#722ed1' },
  },
  {
    route: '/services', resource: 'services', label: '서비스 관리',
    group: '데이터 관리', icon: <AppstoreOutlined />,
    badge: { text: 'S', color: '#1890ff' },
  },
  {
    route: '/team-status', resource: 'team-status', label: '팀별 현황',
    group: '데이터 관리', icon: <TeamOutlined />,
    badge: { text: 'T', color: '#52c41a' },
  },
  {
    route: '/actions', resource: 'actions', label: '액션 관리',
    group: '데이터 관리', icon: <CheckCircleOutlined />,
    badge: { text: 'A', color: '#fa8c16' },
  },

  // ── 조직 관리 (사이드바 없음, 권한만) ──────────────────────────
  {
    route: '/teams', resource: 'teams', label: '팀 관리',
    permGroup: '조직 관리',
  },
  {
    route: '/users', resource: 'users', label: '회원 관리 (LDAP)',
    permGroup: '조직 관리',
  },

  // ── 시스템 지원 ──────────────────────────────────────────────
  {
    route: '/feedback', resource: 'feedback', label: '버그/건의',
    group: '시스템 지원', icon: <CommentOutlined />,
  },
  {
    route: '/feedback', resource: 'user-approval', label: '사용자 승인',
    permGroup: '시스템 지원',
  },

  // ── 시스템 설정 ──────────────────────────────────────────────
  {
    route: '/general-settings', resource: 'general-settings', label: '일반 설정',
    group: '시스템 설정', icon: <SettingOutlined />,
  },
  {
    route: '/members', resource: 'members', label: '멤버 관리',
    group: '시스템 설정', icon: <IdcardOutlined />,
  },
  {
    route: '/ldap-auth', resource: 'ldap-auth', label: 'LDAP 인증',
    permGroup: '시스템 설정',
  },
  {
    route: '/ldap-sync', resource: 'ldap-sync', label: 'LDAP 동기화',
    permGroup: '시스템 설정',
  },
  {
    route: '/notification-apps', resource: 'notification-apps', label: '알림앱 연동',
    group: '시스템 설정', icon: <ApiOutlined />,
  },
  {
    route: '/permissions', resource: 'permissions', label: '권한 관리',
    group: '시스템 설정', icon: <KeyOutlined />,
  },
];

// ── 파생 데이터 ───────────────────────────────────────────────────────────────

/** 라우트 → 리소스 맵 (App.tsx ProtectedRoute + MainLayout 사이드바 필터 공용) */
export const ROUTE_RESOURCE_MAP: { [route: string]: string } = Object.fromEntries(
  MENU_ENTRIES.map(e => [e.route, e.resource])
);

/** 사이드바 그룹 목록 (group + icon 있는 항목만, MainLayout용) */
export const SIDEBAR_GROUPS: Array<{ title: string; items: MenuEntry[] }> = (() => {
  const groupMap = new Map<string, MenuEntry[]>();
  MENU_ENTRIES.filter(e => e.group && e.icon).forEach(e => {
    const list = groupMap.get(e.group!) ?? [];
    list.push(e);
    groupMap.set(e.group!, list);
  });
  return Array.from(groupMap.entries()).map(([title, items]) => ({ title, items }));
})();

/** 권한관리 UI 그룹 목록 (PermissionManagement용) */
export const PERMISSION_GROUPS: Array<{ title: string; resources: Array<{ key: string; label: string }> }> = (() => {
  const groupMap = new Map<string, Array<{ key: string; label: string }>>();
  MENU_ENTRIES.forEach(e => {
    const title = e.permGroup ?? e.group;
    if (!title) return;
    const list = groupMap.get(title) ?? [];
    list.push({ key: e.resource, label: e.label });
    groupMap.set(title, list);
  });
  return Array.from(groupMap.entries()).map(([title, resources]) => ({ title, resources }));
})();
