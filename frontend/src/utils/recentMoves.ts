/**
 * 최근 이동 위치 관리 유틸리티
 * localStorage를 사용하여 사용자의 최근 이동 기록을 저장/조회
 */

export interface RecentMoveLocation {
  projectId: string;
  projectName: string;
  serviceId: string;
  serviceName: string;
  serviceTeamId: string;
  teamName: string;
  timestamp: number;
}

const STORAGE_KEY = 'psta_recent_moves';
const MAX_RECENT_MOVES = 3;

/**
 * 최근 이동 위치 저장
 * @param location 이동한 위치 정보
 */
export const saveRecentMove = (location: Omit<RecentMoveLocation, 'timestamp'>): void => {
  try {
    const recent = getRecentMoves();

    // 중복 제거 (같은 serviceTeamId가 있으면 제거)
    const filtered = recent.filter(r => r.serviceTeamId !== location.serviceTeamId);

    // 새 항목을 맨 앞에 추가
    const updated = [
      {
        ...location,
        timestamp: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_MOVES); // 최대 3개만 유지

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent move:', error);
  }
};

/**
 * 최근 이동 위치 조회
 * @returns 최근 이동 위치 목록 (최대 3개, 최신순)
 */
export const getRecentMoves = (): RecentMoveLocation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    // 유효성 검증
    if (!Array.isArray(parsed)) {
      return [];
    }

    // 7일 이상 된 기록은 제거
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const filtered = parsed.filter((item: RecentMoveLocation) => {
      return item.timestamp > sevenDaysAgo;
    });

    return filtered.slice(0, MAX_RECENT_MOVES);
  } catch (error) {
    console.error('Failed to get recent moves:', error);
    return [];
  }
};

/**
 * 최근 이동 위치 초기화
 */
export const clearRecentMoves = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear recent moves:', error);
  }
};
