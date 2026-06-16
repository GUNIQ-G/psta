import React, { useState, useEffect, useMemo } from 'react';
import { Button, Spin, Empty, Space, Tag, Progress, Tooltip } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Item, ItemType } from '../types';
import { itemsApi } from '../api/items';
import { getTypeColor, getTypeLabel } from '../utils/wbsHelpers';
import { calculateTimelineBar } from '../utils/timelineCalculator';
import { ViewMode, VIEW_MODE_CONFIGS, navigateTimelineDate } from '../utils/viewModeConfig';
import { WbsTimelineHeader } from './WbsTimelineHeader';
import { useColumnResize } from '../hooks/useColumnResize';
import {
  getTreeRowStyle,
  getEmptyRowStyle,
  getTimelineRowStyle,
  TYPE_TAG_STYLE,
  ITEM_NAME_STYLE,
  CONTAINER_STYLE,
  SCROLL_AREA_STYLE,
  FLEX_CONTAINER_STYLE,
  HEADER_CONTAINER_STYLE,
  RESIZE_HANDLE_STYLE,
  RESIZE_HANDLE_HOVER_STYLE,
  CENTER_CONTENT_STYLE,
} from '../constants/wbsStyles';

interface WbsTimelineProps {
  userTeamId?: string;
  expandedTypes: Set<ItemType>;
  hideUnassignedIds: string[];
  hideEmptyTeams: boolean;
  selectedClientIds: string[];
  selectedProjectIds: string[];
  searchKeyword: string;
  onItemClick: (item: Item) => void;
}

export const WbsTimeline: React.FC<WbsTimelineProps> = ({
  userTeamId,
  expandedTypes,
  hideUnassignedIds,
  hideEmptyTeams,
  selectedClientIds,
  selectedProjectIds,
  searchKeyword,
  onItemClick,
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [baseDate, setBaseDate] = useState(new Date()); // 타임라인의 기준 날짜
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null); // 마우스 호버된 항목 ID

  // 컬럼 리사이즈 훅 사용
  const { width: hierarchyWidth, isResizing, startResize } = useColumnResize({
    initialWidth: 350,
    minWidth: 200,
    maxWidth: 800,
  });

  // 데이터 로드
  useEffect(() => {
    fetchItems();
  }, [userTeamId, selectedClientIds, selectedProjectIds, hideUnassignedIds, hideEmptyTeams, searchKeyword]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await itemsApi.getItemTree(undefined, userTeamId);

      // 필터링 적용
      let filteredData = data;

      // 1. 고객/프로젝트 필터링
      if (selectedClientIds.length > 0 || selectedProjectIds.length > 0) {
        filteredData = filterByHierarchy(filteredData);
      }

      setItems(filteredData);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  // 고객/프로젝트 필터링 (ItemTree와 동일한 로직)
  const filterByHierarchy = (items: Item[], ancestorProjectId?: string): Item[] => {
    return items
      .map((item): Item | null => {
        // 현재 항목의 프로젝트 컨텍스트 결정
        const currentProjectId = item.type === ItemType.PROJECT ? item.id : ancestorProjectId;

        // 고객 필터 (다중)
        if (selectedClientIds.length > 0 && item.type === ItemType.PROJECT) {
          if (!selectedClientIds.includes(item.clientId || '')) {
            return null;
          }
        }

        // 프로젝트 필터 (다중)
        if (selectedProjectIds.length > 0) {
          if (item.type === ItemType.PROJECT) {
            // 선택된 프로젝트 중 하나인지 확인
            if (!selectedProjectIds.includes(item.id)) return null;
          } else {
            // SERVICE, TEAM, ACTION은 조상 프로젝트가 선택된 프로젝트 중 하나인지 확인
            if (!currentProjectId || !selectedProjectIds.includes(currentProjectId)) return null;
          }
        }

        // 자식 필터링 (재귀)
        if (item.children && item.children.length > 0) {
          return {
            ...item,
            children: filterByHierarchy(item.children, currentProjectId),
          };
        }

        return item;
      })
      .filter((item): item is Item => item !== null);
  };

  // 헬퍼 함수들 먼저 정의
  const hasActionChildren = (children: Item[]): boolean => {
    for (const child of children) {
      if (child.type === ItemType.ACTION) {
        return true;
      }
      if (child.children && hasActionChildren(child.children)) {
        return true;
      }
    }
    return false;
  };

  // 자신 또는 하위 항목 중 검색어에 매칭되는 항목이 있는지 확인
  const hasMatchingDescendant = (item: Item): boolean => {
    if (item.name.toLowerCase().includes(searchKeyword.toLowerCase())) return true;
    if (item.children) return item.children.some(child => hasMatchingDescendant(child));
    return false;
  };

  const filterItems = (itemList: Item[]): Item[] => {
    return itemList
      .filter(item => {
        // 미정 프로젝트/서비스 숨김 (ID 또는 이름에 "미정" 포함)
        const isUnassignedById = hideUnassignedIds.includes(item.id);
        const isUnassignedByName = item.name.includes('미정');
        if (isUnassignedById || isUnassignedByName) {
          return false;
        }

        // 검색어 필터: 자신 또는 하위 항목이 매칭되면 포함
        if (searchKeyword && !hasMatchingDescendant(item)) {
          return false;
        }

        return true;
      })
      .map(item => {
        if (item.children) {
          const filteredChildren = filterItems(item.children);

          // 빈 팀 숨김 (Team 타입이고 하위에 Action이 없으면)
          if (hideEmptyTeams && item.type === ItemType.TEAM) {
            const hasActions = hasActionChildren(filteredChildren);
            if (!hasActions) {
              return null;
            }
          }

          return { ...item, children: filteredChildren };
        }
        return item;
      })
      .filter(item => item !== null) as Item[];
  };

  // 필터링된 아이템 (검색어, 미정 숨김, 빈 팀 숨김)
  const filteredItems = useMemo(() => {
    return filterItems(items);
  }, [items, searchKeyword, hideUnassignedIds, hideEmptyTeams]);


  // 날짜 네비게이션 함수
  const navigateTimeline = (step: number) => {
    const newDate = navigateTimelineDate(baseDate, viewMode, step);
    setBaseDate(newDate);
  };

  const handlePrevDouble = () => navigateTimeline(-2);
  const handlePrevSingle = () => navigateTimeline(-1);
  const handleNextSingle = () => navigateTimeline(1);
  const handleNextDouble = () => navigateTimeline(2);
  const handleToday = () => setBaseDate(new Date());

  // 타임라인 그리드 생성 (baseDate 기준, viewMode에 따라 변경)
  const timelineGrid = useMemo(() => {
    const config = VIEW_MODE_CONFIGS[viewMode];
    return config.gridGenerator(baseDate);
  }, [viewMode, baseDate]);

  // ViewMode별 셀 최소 너비 설정
  const cellMinWidth = useMemo(() => {
    return VIEW_MODE_CONFIGS[viewMode].cellMinWidth;
  }, [viewMode]);

  // 모든 액션 수집
  const allActions = useMemo(() => {
    const actions: Item[] = [];

    const collectActions = (itemList: Item[]) => {
      itemList.forEach(item => {
        if (item.type === ItemType.ACTION) {
          actions.push(item);
        }
        if (item.children) {
          collectActions(item.children);
        }
      });
    };

    collectActions(filteredItems);
    return actions;
  }, [filteredItems]);

  // 계층 순서
  const hierarchy = [ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION];

  // expandedTypes에서 최대 레벨 찾기
  const getMaxExpandedLevel = (): number => {
    let maxLevel = -1;
    hierarchy.forEach((type, index) => {
      if (expandedTypes.has(type)) {
        maxLevel = Math.max(maxLevel, index);
      }
    });
    return maxLevel;
  };

  // 계층 트리 렌더링 (Project → Service → Team → Action)
  const renderTreeRow = (item: Item, level: number = 0): React.ReactNode => {
    const hasChildren = item.children && item.children.length > 0;
    const itemLevel = hierarchy.indexOf(item.type);
    const maxLevel = getMaxExpandedLevel();

    // 현재 항목의 레벨이 maxLevel보다 낮으면 자식을 표시
    const shouldExpand = itemLevel < maxLevel;

    return (
      <React.Fragment key={item.id}>
        <div
          style={getTreeRowStyle(level, hoveredItemId === item.id)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
        >
          {/* 액션 팀 태그 (3단계 구조: 생성자의 팀 표시) - 타입 태그 앞에 배치 */}
          {item.type === ItemType.ACTION && (
            <Tag
              color="green"
              style={{
                fontSize: '10px',
                padding: '0 4px',
                margin: 0,
                marginRight: '4px',
                lineHeight: '18px',
                width: '60px',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {(item as any).User_Item_createdByIdToUser?.Team?.name || '-'}
            </Tag>
          )}
          <Tag color={getTypeColor(item.type)} style={TYPE_TAG_STYLE}>
            {getTypeLabel(item.type)}
          </Tag>
          <Tooltip title={item.name} placement="topLeft" mouseEnterDelay={0.5}>
            <span
              style={{
                ...ITEM_NAME_STYLE,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.name}
            </span>
          </Tooltip>
        </div>

        {shouldExpand && hasChildren && item.children!.map(child => renderTreeRow(child, level + 1))}
      </React.Fragment>
    );
  };

  // 빈 공간 렌더링 (계층 구조 숨김 시)
  const renderEmptyRow = (item: Item): React.ReactNode => {
    const hasChildren = item.children && item.children.length > 0;
    const itemLevel = hierarchy.indexOf(item.type);
    const maxLevel = getMaxExpandedLevel();

    // 현재 항목의 레벨이 maxLevel보다 낮으면 자식을 표시
    const shouldExpand = itemLevel < maxLevel;

    return (
      <React.Fragment key={`empty-${item.id}`}>
        <div
          style={getEmptyRowStyle(hoveredItemId === item.id)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
        />
        {shouldExpand && hasChildren && item.children!.map(child => renderEmptyRow(child))}
      </React.Fragment>
    );
  };

  // 타임라인 그리드 행 렌더링
  const renderTimelineRow = (item: Item, level: number = 0): React.ReactNode => {
    const hasChildren = item.children && item.children.length > 0;
    const itemLevel = hierarchy.indexOf(item.type);
    const maxLevel = getMaxExpandedLevel();

    // 현재 항목의 레벨이 maxLevel보다 낮으면 자식을 표시
    const shouldExpand = itemLevel < maxLevel;

    // 타임라인 바 계산 (유틸리티 함수 사용)
    const { timelineBar } = calculateTimelineBar(item, timelineGrid, onItemClick);

    return (
      <React.Fragment key={item.id}>
        <div
          style={getTimelineRowStyle(hoveredItemId === item.id)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
        >
          {/* 타임라인 바 (행 레벨에서 렌더링) */}
          {timelineBar}

          {/* 날짜별 셀 */}
          {timelineGrid.map((cell, idx) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isToday = cell.date.toDateString() === today.toDateString();
            const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
            const showWeekendShade = cell.type === 'day' && isWeekend;

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  minWidth: cellMinWidth,
                  borderRight: '1px solid #f0f0f0',
                  backgroundColor: isToday ? '#e6f7ff' : 'transparent',
                }}
              />
            );
          })}
        </div>

        {shouldExpand && hasChildren && item.children!.map(child => renderTimelineRow(child, level + 1))}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div style={CENTER_CONTENT_STYLE}>
        <Spin size="large" />
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div style={CENTER_CONTENT_STYLE}>
        <Empty description="표시할 데이터가 없습니다" />
      </div>
    );
  }

  return (
    <div style={CONTAINER_STYLE}>
      {/* 날짜 필터 */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #d9d9d9',
        backgroundColor: '#fafafa',
      }}>
        <Space>
          {/* 왼쪽 네비게이션 */}
          <Button size="small" onClick={handlePrevDouble}>«</Button>
          <Button size="small" onClick={handlePrevSingle}>‹</Button>

          {/* 필터 */}
          <Button
            size="small"
            type={viewMode === 'week' ? 'primary' : 'default'}
            onClick={() => setViewMode('week')}
          >
            주
          </Button>
          <Button
            size="small"
            type={viewMode === 'biweek' ? 'primary' : 'default'}
            onClick={() => setViewMode('biweek')}
          >
            2주
          </Button>
          <Button
            size="small"
            type={viewMode === 'month' ? 'primary' : 'default'}
            onClick={() => setViewMode('month')}
          >
            월
          </Button>
          <Button
            size="small"
            type={viewMode === 'quarter' ? 'primary' : 'default'}
            onClick={() => setViewMode('quarter')}
          >
            분기
          </Button>
          <Button
            size="small"
            type={viewMode === 'year' ? 'primary' : 'default'}
            onClick={() => setViewMode('year')}
          >
            년
          </Button>
          <Button
            size="small"
            type={viewMode === 'fiveyear' ? 'primary' : 'default'}
            onClick={() => setViewMode('fiveyear')}
          >
            5년
          </Button>
          <Button size="small" onClick={handleToday}>
            오늘
          </Button>

          {/* 오른쪽 네비게이션 */}
          <Button size="small" onClick={handleNextSingle}>›</Button>
          <Button size="small" onClick={handleNextDouble}>»</Button>
        </Space>
      </div>

      {/* 타임라인 그리드 (스크롤 가능) */}
      <div style={SCROLL_AREA_STYLE}>
        <div style={FLEX_CONTAINER_STYLE}>
          {/* 왼쪽: 계층 트리 또는 빈 공간 */}
          <div style={{
            width: showHierarchy ? hierarchyWidth : 40,
            flexShrink: 0,
            position: 'relative',
            borderRight: '2px solid #d9d9d9',
          }}>
            {showHierarchy ? (
              <>
                {/* 헤더 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 48,
                  padding: '6px 8px',
                  backgroundColor: '#fafafa',
                  fontWeight: 600,
                  borderBottom: '2px solid #d9d9d9',
                  position: 'sticky',
                  top: 0,
                  zIndex: 11,
                }}>
                  <span>계층 구조</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<MenuFoldOutlined />}
                    onClick={() => setShowHierarchy(false)}
                    title="계층 구조 숨기기"
                  />
                </div>

                {/* 트리 데이터 */}
                {filteredItems.map(item => renderTreeRow(item))}
              </>
            ) : (
              <>
                {/* 헤더 (펼치기 버튼) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                  padding: '6px 8px',
                  backgroundColor: '#fafafa',
                  borderBottom: '2px solid #d9d9d9',
                  position: 'sticky',
                  top: 0,
                  zIndex: 11,
                }}>
                  <Button
                    type="text"
                    size="small"
                    icon={<MenuUnfoldOutlined />}
                    onClick={() => setShowHierarchy(true)}
                    title="계층 구조 표시"
                  />
                </div>

                {/* 본문 빈 공간 */}
                {filteredItems.map(item => renderEmptyRow(item))}
              </>
            )}

            {/* 리사이저 핸들 */}
            {showHierarchy && (
              <div
                onMouseDown={startResize}
                style={RESIZE_HANDLE_STYLE}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, RESIZE_HANDLE_HOVER_STYLE)}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, RESIZE_HANDLE_STYLE)}
              />
            )}
          </div>

          {/* 오른쪽: 타임라인 */}
          <div style={{ flex: 1, minWidth: showHierarchy ? 700 : undefined }}>
            {/* 날짜 헤더 */}
            <WbsTimelineHeader timelineGrid={timelineGrid} cellMinWidth={cellMinWidth} />

            {/* 타임라인 데이터 */}
            {filteredItems.map(item => renderTimelineRow(item))}
          </div>
        </div>
      </div>
    </div>
  );
};
