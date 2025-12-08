/**
 * useColumnResize Hook
 *
 * 컬럼 리사이즈 로직을 재사용 가능한 훅으로 분리
 */

import { useState, useEffect } from 'react';

export interface UseColumnResizeOptions {
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface UseColumnResizeReturn {
  width: number;
  isResizing: boolean;
  startResize: () => void;
}

/**
 * 컬럼 리사이즈를 관리하는 커스텀 훅
 *
 * @param initialWidth - 초기 너비 (픽셀)
 * @param minWidth - 최소 너비 (기본값: 200px)
 * @param maxWidth - 최대 너비 (기본값: 800px)
 * @returns width, isResizing, startResize
 *
 * @example
 * ```tsx
 * const { width, isResizing, startResize } = useColumnResize({
 *   initialWidth: 350,
 *   minWidth: 200,
 *   maxWidth: 800,
 * });
 *
 * <div style={{ width }}>
 *   <div onMouseDown={startResize} />
 * </div>
 * ```
 */
export const useColumnResize = ({
  initialWidth,
  minWidth = 200,
  maxWidth = 800,
}: UseColumnResizeOptions): UseColumnResizeReturn => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    // 이벤트 리스너 등록
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // 커서 및 선택 스타일 설정
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    // 클린업
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth]);

  const startResize = () => {
    setIsResizing(true);
  };

  return {
    width,
    isResizing,
    startResize,
  };
};
