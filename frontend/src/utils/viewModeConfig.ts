/**
 * WBS Timeline ViewMode Configuration
 *
 * ViewMode별 설정을 통합하여 중복 코드 제거 및 유지보수성 향상
 */

export type ViewMode = 'week' | 'biweek' | 'month' | 'quarter' | 'year' | 'fiveyear';

export interface TimelineCell {
  date: Date;
  type: 'day' | 'month' | 'bimonth';
}

export interface ViewModeConfig {
  /** 셀 최소 너비 (픽셀) */
  cellMinWidth: number;
  /** 네비게이션 스텝 (일/월 단위) */
  navigationStep: {
    type: 'day' | 'month';
    multiplier: number; // 1회 이동 시 multiplier만큼 이동
  };
  /** 타임라인 그리드 생성 함수 */
  gridGenerator: (baseDate: Date) => TimelineCell[];
  /** ViewMode 한글 레이블 */
  label: string;
}

/**
 * ViewMode별 설정 객체
 */
export const VIEW_MODE_CONFIGS: Record<ViewMode, ViewModeConfig> = {
  week: {
    cellMinWidth: 120,
    navigationStep: { type: 'day', multiplier: 1 },
    gridGenerator: (baseDate: Date) => {
      const center = new Date(baseDate);
      center.setHours(0, 0, 0, 0);
      const cells: TimelineCell[] = [];

      // 기준 날짜 앞뒤 3일씩 (총 7일)
      for (let i = -3; i <= 3; i++) {
        const date = new Date(center);
        date.setDate(date.getDate() + i);
        cells.push({ date, type: 'day' });
      }

      return cells;
    },
    label: '주',
  },

  biweek: {
    cellMinWidth: 80,
    navigationStep: { type: 'day', multiplier: 1 },
    gridGenerator: (baseDate: Date) => {
      const center = new Date(baseDate);
      center.setHours(0, 0, 0, 0);
      const cells: TimelineCell[] = [];

      // 기준 날짜 앞뒤 7일씩 (총 14일)
      for (let i = -7; i < 7; i++) {
        const date = new Date(center);
        date.setDate(date.getDate() + i);
        cells.push({ date, type: 'day' });
      }

      return cells;
    },
    label: '2주',
  },

  month: {
    cellMinWidth: 60,
    navigationStep: { type: 'day', multiplier: 1 },
    gridGenerator: (baseDate: Date) => {
      const center = new Date(baseDate);
      center.setHours(0, 0, 0, 0);
      const cells: TimelineCell[] = [];

      // 기준 날짜 앞뒤 15일씩 (총 31일)
      for (let i = -15; i <= 15; i++) {
        const date = new Date(center);
        date.setDate(date.getDate() + i);
        cells.push({ date, type: 'day' });
      }

      return cells;
    },
    label: '월',
  },

  quarter: {
    cellMinWidth: 80,
    navigationStep: { type: 'month', multiplier: 1 },
    gridGenerator: (baseDate: Date) => {
      const center = new Date(baseDate);
      center.setHours(0, 0, 0, 0);
      const cells: TimelineCell[] = [];

      // 기준 날짜 앞뒤 1.5개월씩 (총 3개월)
      for (let i = -1; i <= 1; i++) {
        const date = new Date(center);
        date.setMonth(date.getMonth() + i);
        date.setDate(1); // 월의 첫날로 설정
        cells.push({ date, type: 'month' });
      }

      return cells;
    },
    label: '분기',
  },

  year: {
    cellMinWidth: 80,
    navigationStep: { type: 'month', multiplier: 1 },
    gridGenerator: (baseDate: Date) => {
      const center = new Date(baseDate);
      center.setHours(0, 0, 0, 0);
      const cells: TimelineCell[] = [];

      // 기준 날짜 앞뒤 6개월씩 (총 12개월)
      for (let i = -6; i < 6; i++) {
        const date = new Date(center);
        date.setMonth(date.getMonth() + i);
        date.setDate(1);
        cells.push({ date, type: 'month' });
      }

      return cells;
    },
    label: '년',
  },

  fiveyear: {
    cellMinWidth: 60,
    navigationStep: { type: 'month', multiplier: 2 },
    gridGenerator: (baseDate: Date) => {
      const center = new Date(baseDate);
      center.setHours(0, 0, 0, 0);
      const cells: TimelineCell[] = [];

      // 기준 날짜 앞뒤 30개월씩, 2개월 단위 (총 30개 셀)
      for (let i = -30; i < 30; i += 2) {
        const date = new Date(center);
        date.setMonth(date.getMonth() + i);
        date.setDate(1);
        cells.push({ date, type: 'bimonth' });
      }

      return cells;
    },
    label: '5년',
  },
};

/**
 * ViewMode에 따라 날짜 네비게이션
 * @param baseDate 현재 기준 날짜
 * @param viewMode 현재 ViewMode
 * @param step 이동 스텝 (양수: 다음, 음수: 이전)
 * @returns 새로운 기준 날짜
 */
export const navigateTimelineDate = (
  baseDate: Date,
  viewMode: ViewMode,
  step: number
): Date => {
  const config = VIEW_MODE_CONFIGS[viewMode];
  const newDate = new Date(baseDate);

  if (config.navigationStep.type === 'day') {
    newDate.setDate(newDate.getDate() + step * config.navigationStep.multiplier);
  } else if (config.navigationStep.type === 'month') {
    newDate.setMonth(newDate.getMonth() + step * config.navigationStep.multiplier);
  }

  return newDate;
};
