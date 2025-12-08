import React from 'react';
import { Tag, Progress } from 'antd';
import { Item, ItemType } from '../types';
import { getTypeColorHex, getTypeColorHexLight, getStatusColor, getStatusLabel, formatDateRange } from './wbsHelpers';

/**
 * Timeline Bar Calculator
 * 타임라인 바의 위치, 너비, 렌더링을 계산하는 유틸리티
 */

interface TimelineCell {
  date: Date;
  type: 'day' | 'month' | 'bimonth';
}

interface TimelineBarResult {
  timelineBar: JSX.Element | null;
}

/**
 * 타임라인 바 계산 및 렌더링
 * @param item - 항목 데이터
 * @param timelineGrid - 타임라인 그리드 (날짜 셀 배열)
 * @param onItemClick - 항목 클릭 핸들러
 * @returns 타임라인 바 JSX 또는 null
 */
export const calculateTimelineBar = (
  item: Item,
  timelineGrid: TimelineCell[],
  onItemClick: (item: Item) => void
): TimelineBarResult => {
  let timelineBar: JSX.Element | null = null;

  if (!item.startDate || !item.endDate) {
    return { timelineBar };
  }

  const start = new Date(item.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(item.endDate);
  end.setHours(0, 0, 0, 0);

  const firstCellDate = timelineGrid[0].date;
  const lastCellDate = timelineGrid[timelineGrid.length - 1].date;

  // 항목이 현재 타임라인 범위와 겹치는지 확인
  if (start > lastCellDate || end < firstCellDate) {
    return { timelineBar };
  }

  // 시작 셀 찾기 (항목 시작 날짜가 속한 셀)
  let startCellIndex = -1;
  let startOffsetInCell = 0;

  for (let i = 0; i < timelineGrid.length; i++) {
    const cellDate = new Date(timelineGrid[i].date);
    cellDate.setHours(0, 0, 0, 0);

    // 다음 셀 날짜
    const nextCellDate = i < timelineGrid.length - 1
      ? new Date(timelineGrid[i + 1].date)
      : new Date(cellDate.getFullYear(), cellDate.getMonth() + 2, 1); // 임의로 다음 기간
    nextCellDate.setHours(0, 0, 0, 0);

    // 항목 시작 날짜가 이 셀과 다음 셀 사이에 있는가?
    if (start >= cellDate && start < nextCellDate) {
      startCellIndex = i;
      // 셀 내에서의 비율 계산
      const cellDuration = (nextCellDate.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24);
      const offsetDays = (start.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24);
      startOffsetInCell = cellDuration > 0 ? offsetDays / cellDuration : 0;
      break;
    }
  }

  // 종료 셀 찾기 (항목 종료 날짜가 속한 셀)
  let endCellIndex = -1;
  let endOffsetInCell = 1; // 기본값 1 (셀 끝)

  for (let i = 0; i < timelineGrid.length; i++) {
    const cellDate = new Date(timelineGrid[i].date);
    cellDate.setHours(0, 0, 0, 0);

    const nextCellDate = i < timelineGrid.length - 1
      ? new Date(timelineGrid[i + 1].date)
      : new Date(cellDate.getFullYear(), cellDate.getMonth() + 2, 1);
    nextCellDate.setHours(0, 0, 0, 0);

    if (end >= cellDate && end < nextCellDate) {
      endCellIndex = i;
      const cellDuration = (nextCellDate.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24);
      const offsetDays = (end.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24);
      endOffsetInCell = cellDuration > 0 ? offsetDays / cellDuration : 1;
      break;
    }
  }

  // 인덱스 보정
  if (startCellIndex === -1) startCellIndex = 0;
  if (endCellIndex === -1) endCellIndex = timelineGrid.length - 1;

  // 시작 위치 계산 (셀 인덱스 + 셀 내 오프셋)
  const leftPercent = ((startCellIndex + startOffsetInCell) / timelineGrid.length) * 100;

  // 너비 계산 (종료 - 시작)
  const endPosition = (endCellIndex + endOffsetInCell) / timelineGrid.length;
  const startPosition = (startCellIndex + startOffsetInCell) / timelineGrid.length;
  const widthPercent = (endPosition - startPosition) * 100;

  timelineBar = (
    <div
      onClick={() => onItemClick(item)}
      style={{
        position: 'absolute',
        left: `${leftPercent}%`,
        top: '50%',
        transform: 'translateY(-50%)',
        height: 28,
        width: `${widthPercent}%`,
        backgroundColor: '#ffffff',
        borderLeft: `4px solid ${getTypeColorHex(item.type)}`,
        borderRight: `4px solid ${getTypeColorHexLight(item.type)}`,
        borderRadius: 4,
        padding: '4px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: 'rgba(0, 0, 0, 0.85)',
        whiteSpace: 'nowrap',
        zIndex: 1,
        boxShadow: '0 0 4px rgba(0, 0, 0, 0.15)',
      }}
      title={`${item.name} (${item.progress || 0}%)`}
    >
      {/* 항목명 */}
      <span style={{ fontWeight: 500 }}>{item.name}</span>

      {/* 담당자 */}
      {item.User_Item_assigneeIdToUser && (
        <Tag style={{ margin: 0, fontSize: 11 }}>
          @{item.User_Item_assigneeIdToUser.displayName}
        </Tag>
      )}

      {/* 상태 */}
      {item.status && (
        <Tag color={getStatusColor(item.status)} style={{ margin: 0, fontSize: 11 }}>
          {getStatusLabel(item.status)}
        </Tag>
      )}

      {/* 진행률 */}
      {item.progress !== undefined && item.progress !== null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Progress
            type="circle"
            percent={item.progress}
            size={20}
            strokeWidth={8}
            format={(percent) => `${percent}%`}
            style={{ fontSize: 10 }}
          />
        </span>
      )}

      {/* 기간 */}
      <span style={{
        fontSize: 11,
        color: 'rgba(0, 0, 0, 0.45)',
        marginLeft: 'auto'
      }}>
        {formatDateRange(item.startDate, item.endDate)}
      </span>
    </div>
  );

  return { timelineBar };
};
