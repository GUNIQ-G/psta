/**
 * WBS Timeline Header Component
 *
 * 타임라인의 날짜 헤더를 렌더링하는 분리된 컴포넌트
 */

import React from 'react';
import { TimelineCell } from '../utils/viewModeConfig';

interface WbsTimelineHeaderProps {
  timelineGrid: TimelineCell[];
  cellMinWidth: number;
}

export const WbsTimelineHeader: React.FC<WbsTimelineHeaderProps> = ({
  timelineGrid,
  cellMinWidth,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: 48,
        backgroundColor: '#fafafa',
        borderBottom: '2px solid #d9d9d9',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {timelineGrid.map((cell, idx) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = cell.date.toDateString() === today.toDateString();
        const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
        const showWeekendShade = cell.type === 'day' && isWeekend;

        let label = '';
        let sublabel = '';

        if (cell.type === 'day') {
          // 일 단위: 날짜 + 요일
          label = cell.date.getDate().toString();
          sublabel = ['일', '월', '화', '수', '목', '금', '토'][cell.date.getDay()];
        } else if (cell.type === 'month') {
          // 월 단위: 년/월
          label = `${cell.date.getMonth() + 1}월`;
          sublabel = cell.date.getFullYear().toString();
        } else if (cell.type === 'bimonth') {
          // 2개월 단위: 년/월
          label = `${cell.date.getMonth() + 1}월`;
          sublabel = cell.date.getFullYear().toString();
        }

        return (
          <div
            key={idx}
            style={{
              flex: 1,
              minWidth: cellMinWidth,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 8px',
              borderRight: '1px solid #f0f0f0',
              fontSize: 11,
              fontWeight: isToday ? 600 : 400,
              color: showWeekendShade ? '#ff4d4f' : isToday ? '#1890ff' : '#595959',
              backgroundColor: isToday ? '#e6f7ff' : 'transparent',
            }}
          >
            <div>{label}</div>
            <div style={{ fontSize: 9 }}>{sublabel}</div>
          </div>
        );
      })}
    </div>
  );
};
