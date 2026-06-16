// 공통 Prisma select 상수 — 반복되는 select 블록을 한 곳에서 관리
export const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
} as const;

export const USER_WITH_TEAM_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  Team: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export const CREATOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
} as const;
