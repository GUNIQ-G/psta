/**
 * 직책 기반 역할 매핑 유틸리티 (v1.1.20)
 *
 * 직책 → 역할 자동 매핑:
 * - 파트장, 팀장 → PM
 * - 실장, 본부장, 이사, 상무, 전무 → PO
 * - 그 외 → MEMBER
 * - roleOverride가 설정된 경우 override 값 사용
 */

import { UserRole, PositionType } from '@prisma/client';

// 직책 → 역할 매핑 테이블
export const POSITION_TO_ROLE: Record<PositionType, UserRole> = {
  NONE: UserRole.MEMBER,
  PART_LEADER: UserRole.PM,    // 파트장 → PM
  TEAM_LEADER: UserRole.PM,    // 팀장 → PM
  DIRECTOR: UserRole.PO,       // 실장 → PO
  HEAD: UserRole.PO,           // 본부장 → PO
  EXECUTIVE: UserRole.PO,      // 이사 → PO
  SENIOR_EXEC: UserRole.PO,    // 상무 → PO
  VICE_PRES: UserRole.PO,      // 전무 → PO
};

// LDAP 직책 문자열 → PositionType 매핑
export const LDAP_POSITION_MAP: Record<string, PositionType> = {
  '파트장': PositionType.PART_LEADER,
  '팀장': PositionType.TEAM_LEADER,
  '실장': PositionType.DIRECTOR,
  '본부장': PositionType.HEAD,
  '이사': PositionType.EXECUTIVE,
  '상무': PositionType.SENIOR_EXEC,
  '전무': PositionType.VICE_PRES,
};

// 직책 표시 이름 (한글)
export const POSITION_DISPLAY_NAMES: Record<PositionType, string> = {
  NONE: '일반',
  PART_LEADER: '파트장',
  TEAM_LEADER: '팀장',
  DIRECTOR: '실장',
  HEAD: '본부장',
  EXECUTIVE: '이사',
  SENIOR_EXEC: '상무',
  VICE_PRES: '전무',
};

// 직책 레벨 (높을수록 상위)
export const POSITION_LEVELS: Record<PositionType, number> = {
  NONE: 0,
  PART_LEADER: 1,
  TEAM_LEADER: 2,
  DIRECTOR: 3,
  HEAD: 4,
  EXECUTIVE: 5,
  SENIOR_EXEC: 6,
  VICE_PRES: 7,
};

/**
 * LDAP 직책 문자열을 PositionType으로 변환
 */
export function parsePositionFromLdap(ldapPosition: string | null | undefined): PositionType {
  if (!ldapPosition) return PositionType.NONE;

  const trimmed = ldapPosition.trim();
  return LDAP_POSITION_MAP[trimmed] || PositionType.NONE;
}

/**
 * 사용자의 실제 적용 역할을 계산
 * roleOverride가 있으면 override 값 사용, 없으면 직책 기반 자동 계산
 */
export function getEffectiveRole(
  positionType: PositionType,
  roleOverride: UserRole | null | undefined
): UserRole {
  // roleOverride가 설정된 경우 해당 값 사용
  if (roleOverride) {
    return roleOverride;
  }

  // 직책 기반 자동 매핑
  return POSITION_TO_ROLE[positionType] || UserRole.MEMBER;
}

/**
 * 사용자 객체에서 실제 적용 역할 계산
 */
export function getUserEffectiveRole(user: {
  positionType?: PositionType | null;
  roleOverride?: UserRole | null;
}): UserRole {
  return getEffectiveRole(
    user.positionType || PositionType.NONE,
    user.roleOverride
  );
}

/**
 * LDAP 동기화 시 사용자 역할 계산
 * - LDAP employeeType → PositionType → UserRole
 */
export function calculateRoleFromLdap(
  ldapEmployeeType: string | null | undefined,
  existingRoleOverride: UserRole | null | undefined
): {
  positionType: PositionType;
  role: UserRole;
} {
  const positionType = parsePositionFromLdap(ldapEmployeeType);
  const role = getEffectiveRole(positionType, existingRoleOverride);

  return { positionType, role };
}

/**
 * 직책이 PM 역할인지 확인
 */
export function isPMPosition(positionType: PositionType): boolean {
  return positionType === PositionType.PART_LEADER ||
         positionType === PositionType.TEAM_LEADER;
}

/**
 * 직책이 PO 역할인지 확인
 */
export function isPOPosition(positionType: PositionType): boolean {
  return positionType === PositionType.DIRECTOR ||
         positionType === PositionType.HEAD ||
         positionType === PositionType.EXECUTIVE ||
         positionType === PositionType.SENIOR_EXEC ||
         positionType === PositionType.VICE_PRES;
}

/**
 * 두 직책의 레벨 비교 (상위 직책 확인용)
 * 반환: 양수면 a가 상위, 음수면 b가 상위, 0이면 동급
 */
export function comparePositionLevels(a: PositionType, b: PositionType): number {
  return POSITION_LEVELS[a] - POSITION_LEVELS[b];
}
