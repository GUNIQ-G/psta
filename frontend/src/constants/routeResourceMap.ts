/**
 * 라우트 경로 → Permission 리소스명 매핑
 *
 * App.tsx (ProtectedRoute) 와 MainLayout.tsx (사이드바 필터) 두 곳에서 공유.
 * 새 메뉴를 추가할 때 이 파일만 수정하면 두 곳 모두 반영됨.
 *
 * - 맵에 없는 라우트: 로그인만 필요, 별도 권한 체크 없음 (/profile, /messages 등)
 * - 맵에 있는 라우트: DB Permission.canView 가 true 인 role 만 접근 가능
 */
export const ROUTE_RESOURCE_MAP: { [key: string]: string } = {
  '/dashboard':        'dashboard',
  '/requests':         'requests',
  '/psta':             'psta',
  '/wbs':              'wbs',
  '/report':           'report',
  '/integrated-files': 'integrated-files',
  '/feedback':         'feedback',
  '/clients':          'clients',
  '/projects':         'projects',
  '/services':         'services',
  '/team-status':      'team-status',
  '/actions':          'actions',
  '/teams':            'teams',
  '/users':            'users',
  '/organization':     'organization',
  '/ldap-auth':        'ldap-auth',
  '/ldap-sync':        'ldap-sync',
  '/permissions':      'permissions',
  '/members':          'members',
  '/notification-apps': 'notification-apps',
  '/general-settings': 'general-settings',
};
