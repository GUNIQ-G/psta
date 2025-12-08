/**
 * WBS Timeline Style Constants
 *
 * 반복되는 스타일 객체를 상수로 정의하여 중복 제거 및 일관성 향상
 */

import { CSSProperties } from 'react';

/**
 * 행 기본 스타일
 */
export const ROW_BASE_STYLE: CSSProperties = {
  minHeight: 32,
  padding: '2px 6px',
  lineHeight: '1.3',
  transition: 'background-color 0.2s ease',
};

/**
 * 트리 행 스타일 (왼쪽 계층 구조)
 */
export const getTreeRowStyle = (
  level: number,
  isHovered: boolean
): CSSProperties => ({
  ...ROW_BASE_STYLE,
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 8,
  backgroundColor: isHovered ? '#e6f7ff' : 'transparent',
});

/**
 * 빈 행 스타일 (계층 숨김 시)
 */
export const getEmptyRowStyle = (isHovered: boolean): CSSProperties => ({
  ...ROW_BASE_STYLE,
  backgroundColor: isHovered ? '#e6f7ff' : '#fafafa',
});

/**
 * 타임라인 행 스타일
 */
export const getTimelineRowStyle = (isHovered: boolean): CSSProperties => ({
  ...ROW_BASE_STYLE,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  backgroundColor: isHovered ? '#e6f7ff' : 'transparent',
});

/**
 * PSTA 타입 태그 스타일
 */
export const TYPE_TAG_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 11,
};

/**
 * 항목명 스타일
 */
export const ITEM_NAME_STYLE: CSSProperties = {
  marginLeft: 8,
  fontSize: 13,
  fontWeight: 500,
};

/**
 * 컨테이너 스타일
 */
export const CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

/**
 * 스크롤 영역 스타일
 */
export const SCROLL_AREA_STYLE: CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

/**
 * 플렉스 컨테이너 스타일
 */
export const FLEX_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  minWidth: 'max-content',
};

/**
 * 헤더 영역 스타일
 */
export const HEADER_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid #d9d9d9',
  backgroundColor: '#fff',
  position: 'sticky',
  top: 0,
  zIndex: 20,
};

/**
 * 리사이즈 핸들 스타일
 */
export const RESIZE_HANDLE_STYLE: CSSProperties = {
  width: 6,
  cursor: 'col-resize',
  backgroundColor: 'transparent',
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 1,
  transition: 'background-color 0.2s ease',
};

/**
 * 리사이즈 핸들 호버 스타일
 */
export const RESIZE_HANDLE_HOVER_STYLE: CSSProperties = {
  ...RESIZE_HANDLE_STYLE,
  backgroundColor: '#1890ff',
};

/**
 * 로딩/빈 상태 중앙 정렬 스타일
 */
export const CENTER_CONTENT_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
};
