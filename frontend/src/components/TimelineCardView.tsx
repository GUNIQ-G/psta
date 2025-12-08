import React, { useState, useEffect } from 'react';
import { Space, Button, Tooltip, Tag, Progress, Badge } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';

const TYPE_COLORS: Record<ItemType, string> = {
  PROJECT: '#722ed1',
  SERVICE: '#1890ff',
  TEAM: '#52c41a',
  ACTION: '#fa8c16',
};

const TYPE_LABELS: Record<ItemType, string> = {
  PROJECT: 'P',
  SERVICE: 'S',
  TEAM: 'T',
  ACTION: 'A',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  ON_HOLD: 'warning',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '대기',
};

const TYPE_INDENT: Record<ItemType, number> = {
  PROJECT: 0,
  SERVICE: 20,
  TEAM: 40,
  ACTION: 60,
};

interface TimelineCardViewProps {
  userTeamId?: string;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
  onAdd?: (parentId?: string, type?: ItemType) => void;
  onItemClick?: (item: Item) => void;
  expandedTypes?: Set<ItemType>;
  hasDetailPanel?: boolean;
  hideUnassignedIds?: string[];
  selectedClientIds?: string[];
  selectedProjectIds?: string[];
  searchKeyword?: string;
}

interface TimelineMonth {
  year: number;
  month: number;
  label: string;
  startDate: Dayjs;
  endDate: Dayjs;
  days: number;
}

// 타임라인 생성 (월 단위)
const generateTimeline = (startDate: Dayjs, endDate: Dayjs): TimelineMonth[] => {
  const timeline: TimelineMonth[] = [];
  let current = startDate.startOf('month');
  const end = endDate.endOf('month');

  while (current.isBefore(end) || current.isSame(end, 'month')) {
    const year = current.year();
    const month = current.month() + 1;
    const monthStart = current.startOf('month');
    const monthEnd = current.endOf('month');

    timeline.push({
      year,
      month,
      label: `${year}.${String(month).padStart(2, '0')}`,
      startDate: monthStart,
      endDate: monthEnd,
      days: monthEnd.date(),
    });

    current = current.add(1, 'month');
  }

  return timeline;
};

// 타임라인 바의 위치와 너비 계산
const calculateBarPosition = (
  itemStart: string | undefined,
  itemEnd: string | undefined,
  timelineStart: Dayjs,
  timelineEnd: Dayjs
): { left: string; width: string } | null => {
  if (!itemStart || !itemEnd) return null;

  const start = dayjs(itemStart);
  const end = dayjs(itemEnd);

  // 범위 밖이면 null
  if (end.isBefore(timelineStart) || start.isAfter(timelineEnd)) {
    return null;
  }

  // 실제 표시 범위 계산
  const displayStart = start.isBefore(timelineStart) ? timelineStart : start;
  const displayEnd = end.isAfter(timelineEnd) ? timelineEnd : end;

  const totalDays = timelineEnd.diff(timelineStart, 'day');
  const startOffset = displayStart.diff(timelineStart, 'day');
  const duration = displayEnd.diff(displayStart, 'day') + 1;

  const left = (startOffset / totalDays) * 100;
  const width = (duration / totalDays) * 100;

  return {
    left: `${left}%`,
    width: `${width}%`,
  };
};

export const TimelineCardView: React.FC<TimelineCardViewProps> = ({
  userTeamId,
  onEdit,
  onDelete,
  onAdd,
  onItemClick,
  expandedTypes,
  hasDetailPanel = false,
  hideUnassignedIds = [],
  selectedClientIds = [],
  selectedProjectIds = [],
  searchKeyword = '',
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  // 타임라인 범위 (기본: 올해 1월 ~ 내년 12월)
  const [timelineStart] = useState(dayjs().startOf('year'));
  const [timelineEnd] = useState(dayjs().add(1, 'year').endOf('year'));
  const timeline = generateTimeline(timelineStart, timelineEnd);

  // 재귀적으로 미정 항목 필터링
  const filterUnassignedItems = (items: Item[]): Item[] => {
    return items
      .filter(item => {
        const isUnassignedById = hideUnassignedIds.includes(item.id);
        const isUnassignedByName = item.name.includes('미정');
        return !(isUnassignedById || isUnassignedByName);
      })
      .map(item => ({
        ...item,
        children: item.children ? filterUnassignedItems(item.children) : undefined,
      }));
  };

  // 고객/프로젝트 필터링
  const filterByHierarchy = (items: Item[], ancestorProjectId?: string): Item[] => {
    return items
      .map((item): Item | null => {
        const currentProjectId = item.type === ItemType.PROJECT ? item.id : ancestorProjectId;

        if (selectedClientIds.length > 0 && item.type === ItemType.PROJECT) {
          if (!selectedClientIds.includes(item.clientId || '')) {
            return null;
          }
        }

        if (selectedProjectIds.length > 0) {
          if (item.type === ItemType.PROJECT) {
            if (!selectedProjectIds.includes(item.id)) return null;
          } else {
            if (!currentProjectId || !selectedProjectIds.includes(currentProjectId)) return null;
          }
        }

        const filteredChildren = item.children
          ? filterByHierarchy(item.children, currentProjectId)
          : undefined;

        return {
          ...item,
          children: filteredChildren,
        };
      })
      .filter((item): item is Item => item !== null);
  };

  // 검색 필터링
  const filterBySearch = (items: Item[]): Item[] => {
    if (!searchKeyword || searchKeyword.trim() === '') {
      return items;
    }

    const keyword = searchKeyword.toLowerCase();

    const matchesSearch = (item: Item): boolean => {
      return item.name.toLowerCase().includes(keyword);
    };

    const filterRecursive = (items: Item[]): Item[] => {
      return items
        .map(item => {
          const itemMatches = matchesSearch(item);
          const filteredChildren = item.children ? filterRecursive(item.children) : undefined;
          const hasMatchingChildren = filteredChildren && filteredChildren.length > 0;

          if (itemMatches || hasMatchingChildren) {
            return {
              ...item,
              children: filteredChildren,
            } as Item;
          }
          return null;
        })
        .filter(item => item !== null) as Item[];
    };

    return filterRecursive(items);
  };

  // 내 작업 필터링
  const filterMyTasks = (items: Item[]): Item[] => {
    if (!userTeamId) return items;

    const filterRecursive = (items: Item[]): Item[] => {
      return items
        .map(item => {
          const isMyTask = item.assigneeId === userTeamId;
          const filteredChildren = item.children ? filterRecursive(item.children) : undefined;
          const hasMyTaskInChildren = filteredChildren && filteredChildren.length > 0;

          if (isMyTask || hasMyTaskInChildren) {
            return {
              ...item,
              children: filteredChildren,
            } as Item;
          }
          return null;
        })
        .filter(item => item !== null) as Item[];
    };

    return filterRecursive(items);
  };

  // 데이터 로드
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const data = await itemsApi.getItemTree();
        let filtered = data;

        // 필터 적용
        if (hideUnassignedIds.length > 0) {
          filtered = filterUnassignedItems(filtered);
        }
        if (selectedClientIds.length > 0 || selectedProjectIds.length > 0) {
          filtered = filterByHierarchy(filtered);
        }
        if (searchKeyword) {
          filtered = filterBySearch(filtered);
        }
        if (userTeamId) {
          filtered = filterMyTasks(filtered);
        }

        setItems(filtered);
      } catch (error) {
        console.error('Failed to fetch items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [hideUnassignedIds, selectedClientIds, selectedProjectIds, searchKeyword, userTeamId]);

  // PSTA expandedTypes에 따라 확장 상태 설정
  useEffect(() => {
    if (!items.length) return;

    // expandedTypes가 없으면 모두 펼침
    if (!expandedTypes) {
      const allKeys: React.Key[] = [];
      const collectAll = (items: Item[]) => {
        items.forEach(item => {
          allKeys.push(item.id);
          if (item.children) collectAll(item.children);
        });
      };
      collectAll(items);
      setExpandedRowKeys(allKeys);
      return;
    }

    // expandedTypes에서 가장 높은 계층까지만 펼치기
    const hierarchy = [ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION];

    let maxLevel = -1;
    hierarchy.forEach((type, index) => {
      if (expandedTypes.has(type)) {
        maxLevel = Math.max(maxLevel, index);
      }
    });

    if (maxLevel === -1) {
      setExpandedRowKeys([]);
      return;
    }

    // maxLevel보다 낮은 계층의 항목들만 펼치기
    const keysToExpand: React.Key[] = [];
    const collectKeys = (items: Item[]) => {
      items.forEach(item => {
        const itemLevel = hierarchy.indexOf(item.type);

        if (itemLevel < maxLevel) {
          keysToExpand.push(item.id);
        }

        if (item.children && item.children.length > 0) {
          collectKeys(item.children);
        }
      });
    };

    collectKeys(items);
    setExpandedRowKeys(keysToExpand);
  }, [items, expandedTypes]);

  // 개별 아이템 렌더링 (재귀)
  const renderItem = (item: Item, level: number = 0): React.ReactNode => {
    const indent = TYPE_INDENT[item.type];
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedRowKeys.includes(item.id);
    const commentCount = item._count?.Comment || 0;
    const client = item.Client;
    const isUnassigned = item.name.includes('미정');

    const barPosition = calculateBarPosition(
      item.startDate,
      item.endDate,
      timelineStart,
      timelineEnd
    );

    const isSearchMatch = searchKeyword && item.name.toLowerCase().includes(searchKeyword.toLowerCase());

    return (
      <div key={item.id} style={{ marginBottom: item.type === ItemType.PROJECT ? 16 : 0 }}>
        {/* 카드 */}
        <div
          style={{
            marginLeft: indent,
            padding: '12px 16px',
            backgroundColor: isSearchMatch ? '#fff9e6' : isUnassigned ? '#fff9e6' : '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            marginBottom: 8,
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => onItemClick?.(item)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e6f7ff';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSearchMatch || isUnassigned ? '#fff9e6' : '#fff';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* 상단: 이름 + PSTA 버튼 + 상태 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              {/* 고객 로고 (프로젝트만) */}
              {client && item.type === ItemType.PROJECT && (
                <Tooltip title={client.name}>
                  {client.logoUrl ? (
                    <img
                      src={client.logoUrl}
                      alt={client.name}
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: 'contain',
                        borderRadius: 4,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: '#f0f0f0',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        color: '#999',
                        fontWeight: 'bold',
                      }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Tooltip>
              )}

              {/* 타입 뱃지 */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: TYPE_COLORS[item.type],
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 24,
                }}
              >
                {TYPE_LABELS[item.type]}
              </span>

              {/* 이름 */}
              <span style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</span>

              {/* 댓글 */}
              {commentCount > 0 && (
                <Badge count={commentCount} style={{ backgroundColor: '#1890ff' }}>
                  <MessageOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />
                </Badge>
              )}
            </div>

            {/* 우측: 상태 + 진행률 */}
            <Space size={12}>
              <Tag color={STATUS_COLORS[item.status]} style={{ margin: 0, fontSize: 11 }}>
                {STATUS_LABELS[item.status]}
              </Tag>
              <Progress
                type="circle"
                percent={item.progress}
                size={36}
                strokeWidth={6}
                format={(percent) => (
                  <span style={{ fontSize: 10, fontWeight: 600 }}>
                    {percent}%
                  </span>
                )}
              />
            </Space>
          </div>

          {/* 중단: 타임라인 바 */}
          {barPosition && (
            <div
              style={{
                position: 'relative',
                height: 24,
                backgroundColor: '#f5f5f5',
                borderRadius: 4,
                marginBottom: 8,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: barPosition.left,
                  width: barPosition.width,
                  height: '100%',
                  backgroundColor: TYPE_COLORS[item.type],
                  opacity: 0.7,
                  borderRadius: 4,
                }}
              />
            </div>
          )}

          {/* 하단: 기간 + 담당자 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#595959' }}>
            <span>
              📅 {item.startDate && item.endDate
                ? `${dayjs(item.startDate).format('YYYY.MM.DD')} → ${dayjs(item.endDate).format('MM.DD')}`
                : '기간 미정'}
            </span>
            <span>
              👤 {item.User_Item_assigneeIdToUser?.displayName || '-'}
            </span>
          </div>
        </div>

        {/* 자식 렌더링 */}
        {isExpanded && hasChildren && (
          <div>
            {item.children!.map(child => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 타임라인 헤더 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: '#fafafa',
          borderBottom: '2px solid #d9d9d9',
          padding: '8px 16px',
          display: 'flex',
          gap: 0,
        }}
      >
        {timeline.map((month, index) => (
          <div
            key={`${month.year}-${month.month}`}
            style={{
              flex: month.days,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: '#595959',
              borderRight: index < timeline.length - 1 ? '1px solid #e0e0e0' : 'none',
              padding: '4px 2px',
            }}
          >
            {month.label}
          </div>
        ))}
      </div>

      {/* 카드 리스트 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>로딩 중...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            표시할 항목이 없습니다.
          </div>
        ) : (
          items.map(item => renderItem(item, 0))
        )}
      </div>
    </div>
  );
};
