import { ItemType } from '../types';

/**
 * WBS Timeline Helper Functions
 * 타임라인 컴포넌트에서 사용하는 색상, 레이블, 포맷팅 유틸리티
 */

// ItemTree와 동일한 타입 색상 (Tag color용)
export const getTypeColor = (type: ItemType): string => {
  switch (type) {
    case ItemType.PROJECT: return 'purple';
    case ItemType.SERVICE: return 'blue';
    case ItemType.TEAM: return 'green';
    case ItemType.ACTION: return 'orange';
    default: return 'default';
  }
};

// 타임라인 바 왼쪽 border용 hex 색상
export const getTypeColorHex = (type: ItemType): string => {
  switch (type) {
    case ItemType.PROJECT: return '#722ed1'; // purple
    case ItemType.SERVICE: return '#1890ff'; // blue
    case ItemType.TEAM: return '#52c41a';   // green
    case ItemType.ACTION: return '#fa8c16';  // orange
    default: return '#d9d9d9';
  }
};

// 타임라인 바 오른쪽 border용 옅은 색상 (rgba로 투명도 적용)
export const getTypeColorHexLight = (type: ItemType): string => {
  switch (type) {
    case ItemType.PROJECT: return 'rgba(114, 46, 209, 0.3)'; // purple 30%
    case ItemType.SERVICE: return 'rgba(24, 144, 255, 0.3)'; // blue 30%
    case ItemType.TEAM: return 'rgba(82, 196, 26, 0.3)';    // green 30%
    case ItemType.ACTION: return 'rgba(250, 140, 22, 0.3)';  // orange 30%
    default: return 'rgba(217, 217, 217, 0.3)';
  }
};

export const getTypeLabel = (type: ItemType): string => {
  switch (type) {
    case ItemType.PROJECT: return 'P';
    case ItemType.SERVICE: return 'S';
    case ItemType.TEAM: return 'T';
    case ItemType.ACTION: return 'A';
    default: return '';
  }
};

export const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'TODO': return 'default';
    case 'IN_PROGRESS': return 'blue';
    case 'DONE': return 'green';
    case 'PENDING': return 'orange';
    default: return 'default';
  }
};

export const getStatusLabel = (status?: string): string => {
  switch (status) {
    case 'TODO': return '할일';
    case 'IN_PROGRESS': return '진행중';
    case 'DONE': return '완료';
    case 'PENDING': return '대기';
    default: return '-';
  }
};

export const formatDateRange = (startDate?: string, endDate?: string): string => {
  if (!startDate || !endDate) return '';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };
  return `${formatDate(start)}~${formatDate(end)}`;
};
