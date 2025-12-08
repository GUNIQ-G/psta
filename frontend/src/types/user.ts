export enum UserRole {
  ADMIN = 'ADMIN',
  PO = 'PO',
  PM = 'PM',
  MEMBER = 'MEMBER',
}

// v1.1.20: 직책 enum (직책 기반 역할 매핑)
export enum PositionType {
  NONE = 'NONE',             // 직책 없음 (일반 사원)
  PART_LEADER = 'PART_LEADER', // 파트장 → PM
  TEAM_LEADER = 'TEAM_LEADER', // 팀장 → PM
  DIRECTOR = 'DIRECTOR',     // 실장 → PO
  HEAD = 'HEAD',             // 본부장 → PO
  EXECUTIVE = 'EXECUTIVE',   // 이사 → PO
  SENIOR_EXEC = 'SENIOR_EXEC', // 상무 → PO
  VICE_PRES = 'VICE_PRES',   // 전무 → PO
}

// 직책 표시 이름 (한글)
export const POSITION_DISPLAY_NAMES: Record<PositionType, string> = {
  [PositionType.NONE]: '일반',
  [PositionType.PART_LEADER]: '파트장',
  [PositionType.TEAM_LEADER]: '팀장',
  [PositionType.DIRECTOR]: '실장',
  [PositionType.HEAD]: '본부장',
  [PositionType.EXECUTIVE]: '이사',
  [PositionType.SENIOR_EXEC]: '상무',
  [PositionType.VICE_PRES]: '전무',
};

// 역할 표시 이름 (한글)
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.ADMIN]: '최고관리자',
  [UserRole.PO]: 'PO',
  [UserRole.PM]: 'PM',
  [UserRole.MEMBER]: '일반',
};

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  ldapDn?: string;
  role: UserRole;
  positionType?: PositionType;  // v1.1.20: 직책 enum
  roleOverride?: UserRole;      // v1.1.20: 역할 수동 override
  teamId?: string;
  organizationId?: string;
  title?: string;           // 직위 (대리, 과장, 부장 등)
  position?: string;        // 직책 원본 텍스트 (LDAP employeeType)
  departmentNumber?: string; // 부서 코드
  isVerified: boolean;
  isActive: boolean;
  approvalRequested?: boolean;
  approvalRequestedAt?: string;
  approvalMessage?: string;
  createdAt: string;
  updatedAt: string;
  Team?: Team;
}

export interface Team {
  id: string;
  name: string;
  ldapDn?: string;
  ldapType?: string;        // 'Group' or 'OU'
  level: number;            // 계층 레벨 (1=최상위)
  parentId?: string;        // 부모 팀 ID
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  User?: User[];
  children?: Team[];        // 하위 팀들
}

export interface LDAPSyncResult {
  created: number;
  updated: number;
  errors: string[];
}
