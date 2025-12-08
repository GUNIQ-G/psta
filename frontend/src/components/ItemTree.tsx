import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Tag, Progress, Button, Dropdown, Tooltip, Space, Badge } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  FolderOutlined,
  AppstoreOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import dayjs from 'dayjs';

const typeColors: Record<ItemType, string> = {
  PROJECT: 'purple',
  SERVICE: 'blue',
  TEAM: 'green',
  ACTION: 'orange',
};

const typeLabels: Record<ItemType, string> = {
  PROJECT: 'Project',
  SERVICE: 'Service',
  TEAM: 'Team',
  ACTION: 'Action',
};

const typeIcons: Record<ItemType, React.ReactNode> = {
  PROJECT: <span style={{ fontSize: '11px', fontWeight: 600, marginRight: '6px', backgroundColor: '#722ed1', color: '#fff', padding: '4px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>P</span>,
  SERVICE: <span style={{ fontSize: '11px', fontWeight: 600, marginRight: '6px', backgroundColor: '#1890ff', color: '#fff', padding: '4px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>S</span>,
  TEAM: <span style={{ fontSize: '11px', fontWeight: 600, marginRight: '6px', backgroundColor: '#52c41a', color: '#fff', padding: '4px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>T</span>,
  ACTION: <span style={{ fontSize: '11px', fontWeight: 600, marginRight: '6px', backgroundColor: '#fa8c16', color: '#fff', padding: '4px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>A</span>,
};

const typeIndent: Record<ItemType, number> = {
  PROJECT: 0,
  SERVICE: 20,
  TEAM: 20,
  ACTION: 20,
};

const statusColors: Record<ItemStatus, string> = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  ON_HOLD: 'warning',
};

const statusLabels: Record<ItemStatus, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '대기',
};

interface ItemTreeProps {
  userTeamId?: string;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
  onAdd?: (parentId?: string, type?: ItemType) => void;
  onItemClick?: (item: Item) => void;
  expandedTypes?: Set<ItemType>;
  hasDetailPanel?: boolean;
  hideUnassignedIds?: string[];
  hideEmptyTeams?: boolean;
  selectedClientIds?: string[];
  selectedProjectIds?: string[];
  searchKeyword?: string;
}

export const ItemTree: React.FC<ItemTreeProps> = ({
  userTeamId,
  onEdit,
  onDelete,
  onAdd,
  onItemClick,
  expandedTypes,
  hasDetailPanel = false,
  hideUnassignedIds = [],
  hideEmptyTeams = false,
  selectedClientIds = [],
  selectedProjectIds = [],
  searchKeyword = '',
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const fetchInProgressRef = useRef(false);

  // 재귀적으로 미정 항목 필터링
  const filterUnassignedItems = useCallback((items: Item[]): Item[] => {
    return items
      .filter(item => {
        // ID 배열 체크 또는 이름에 "미정" 포함 여부 체크
        const isUnassignedById = hideUnassignedIds.includes(item.id);
        const isUnassignedByName = item.name.includes('미정');
        return !(isUnassignedById || isUnassignedByName);
      })
      .map(item => ({
        ...item,
        children: item.children ? filterUnassignedItems(item.children) : undefined,
      }));
  }, [hideUnassignedIds]);

  // 고객/프로젝트 필터링 (다중 선택)
  const filterByHierarchy = useCallback((items: Item[], ancestorProjectId?: string): Item[] => {
    return items
      .map((item): (Item & { children?: Item[] }) | null => {
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

        // 자식을 재귀적으로 필터링 (현재 컨텍스트 전달)
        const filteredChildren = item.children
          ? filterByHierarchy(item.children, currentProjectId)
          : undefined;

        return {
          ...item,
          children: filteredChildren,
        };
      })
      .filter((item): item is Item & { children?: Item[] } => item !== null);
  }, [selectedClientIds, selectedProjectIds]);

  // 검색 필터링: 검색어가 있으면 매칭되는 항목과 그 상위/하위 항목 모두 표시
  const filterBySearch = useCallback((items: Item[]): Item[] => {
    if (!searchKeyword || searchKeyword.trim() === '') {
      return items;
    }

    const keyword = searchKeyword.toLowerCase().trim();

    // 재귀적으로 자식 항목들이 검색어를 포함하는지 확인
    const hasMatchingChild = (item: Item): boolean => {
      if (item.name.toLowerCase().includes(keyword)) {
        return true;
      }
      if (item.children && item.children.length > 0) {
        return item.children.some(child => hasMatchingChild(child));
      }
      return false;
    };

    // 모든 자식 항목 포함 (재귀)
    const includeAllChildren = (item: Item): Item => {
      return {
        ...item,
        children: item.children ? item.children.map(child => includeAllChildren(child)) : undefined,
      };
    };

    // 필터링 로직
    const filterItems = (items: Item[]): Item[] => {
      return items
        .map(item => {
          const nameMatches = item.name.toLowerCase().includes(keyword);
          const childMatches = hasMatchingChild(item);

          // 현재 항목 또는 하위 항목이 매칭되면 포함
          if (nameMatches || childMatches) {
            // 현재 항목이 매칭되면 모든 자식 포함
            if (nameMatches) {
              return includeAllChildren(item);
            }
            // 하위 항목이 매칭되면 필터링된 자식만 포함
            return {
              ...item,
              children: item.children ? filterItems(item.children) : undefined,
            };
          }

          return null;
        })
        .filter((item): item is Item => item !== null);
    };

    return filterItems(items);
  }, [searchKeyword]);

  // 삭제된 항목 필터링 (방어적 필터링)
  const filterDeletedItems = useCallback((items: Item[]): Item[] => {
    return items
      .filter(item => {
        // deletedAt이나 isDeleted가 있으면 제외
        const itemAny = item as any;
        return !itemAny.deletedAt && !itemAny.isDeleted;
      })
      .map(item => {
        // 자식이 있으면 재귀적으로 필터링
        const filteredChildren = item.children ? filterDeletedItems(item.children) : undefined;

        return {
          ...item,
          children: filteredChildren,
        };
      });
  }, []);

  // 빈 팀 필터링: 액션이 없는 팀 숨기기
  const filterEmptyTeams = useCallback((items: Item[]): Item[] => {
    return items
      .map(item => {
        // 자식이 있으면 재귀적으로 필터링
        const filteredChildren = item.children ? filterEmptyTeams(item.children) : undefined;

        return {
          ...item,
          children: filteredChildren,
        };
      })
      .filter(item => {
        // TEAM 타입이 아니면 항상 유지
        if (item.type !== ItemType.TEAM) {
          return true;
        }

        // TEAM 타입인 경우, ACTION 자식이 있는지 확인
        const hasActionChildren = (team: Item): boolean => {
          if (!team.children || team.children.length === 0) {
            return false;
          }

          return team.children.some(child => child.type === ItemType.ACTION);
        };

        return hasActionChildren(item);
      });
  }, []);

  const fetchItems = useCallback(async () => {
    // 중복 호출 방지
    if (fetchInProgressRef.current) {
      return;
    }

    fetchInProgressRef.current = true;
    setLoading(true);

    try {
      const data = await itemsApi.getItemTree(undefined, userTeamId);

      // 중복 ID 찾기
      const findDuplicateIds = (items: Item[], path: string = ''): void => {
        const idMap = new Map<string, string[]>();

        const traverse = (items: Item[], currentPath: string) => {
          items.forEach((item, index) => {
            const itemPath = `${currentPath}/${item.type}[${index}]:${item.name}`;

            if (idMap.has(item.id)) {
              idMap.get(item.id)!.push(itemPath);
            } else {
              idMap.set(item.id, [itemPath]);
            }

            if (item.children && item.children.length > 0) {
              traverse(item.children, itemPath);
            }
          });
        };

        traverse(items, path);

        // 중복된 ID만 출력
        idMap.forEach((paths, id) => {
          if (paths.length > 1) {
            console.error('🔴 Duplicate ID found:', id);
            console.error('   Appears in:', paths);
          }
        });
      };

      findDuplicateIds(data, 'ROOT');

      // 필터링 적용
      let filteredData = data;

      // 0. 삭제된 항목 필터링 (방어적 필터링)
      filteredData = filterDeletedItems(filteredData);

      // 1. 미정 항목 필터링
      if (hideUnassignedIds.length > 0) {
        filteredData = filterUnassignedItems(filteredData);
      }

      // 2. 고객/프로젝트 필터링
      if (selectedClientIds.length > 0 || selectedProjectIds.length > 0) {
        filteredData = filterByHierarchy(filteredData);
      }

      // 3. 빈 팀 필터링
      if (hideEmptyTeams) {
        filteredData = filterEmptyTeams(filteredData);
      }

      // 4. 검색 필터링
      if (searchKeyword && searchKeyword.trim() !== '') {
        filteredData = filterBySearch(filteredData);
      }

      // 5. 미정 항목을 상단에 고정하는 재귀 함수 (미정 항목 숨기기가 해제되어 있을 때만)
      const sortUnassignedToTop = (items: Item[]): Item[] => {
        return items.map(item => {
          // 자식이 있으면 재귀적으로 정렬
          const sortedChildren = item.children ? sortUnassignedToTop(item.children) : undefined;

          // 자식들을 미정 서비스 우선으로 정렬
          const finalChildren = sortedChildren?.sort((a, b) => {
            const aIsUnassigned = a.name.includes('미정') && a.type === ItemType.SERVICE;
            const bIsUnassigned = b.name.includes('미정') && b.type === ItemType.SERVICE;

            if (aIsUnassigned && !bIsUnassigned) return -1;
            if (!aIsUnassigned && bIsUnassigned) return 1;
            return 0;
          });

          return {
            ...item,
            children: finalChildren,
          };
        }).sort((a, b) => {
          // 프로젝트 레벨에서 미정 프로젝트를 상단으로
          const aIsUnassigned = a.name.includes('미정') && a.type === ItemType.PROJECT;
          const bIsUnassigned = b.name.includes('미정') && b.type === ItemType.PROJECT;

          if (aIsUnassigned && !bIsUnassigned) return -1;
          if (!aIsUnassigned && bIsUnassigned) return 1;
          return 0;
        });
      };

      if (hideUnassignedIds.length === 0) {
        filteredData = sortUnassignedToTop(filteredData);
      }

      setItems(filteredData);
      // 기본적으로 모든 행 펼치기
      const allKeys = getAllKeys(filteredData);
      setExpandedRowKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [userTeamId, hideUnassignedIds, hideEmptyTeams, selectedClientIds, selectedProjectIds, searchKeyword, filterDeletedItems, filterUnassignedItems, filterByHierarchy, filterEmptyTeams, filterBySearch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // 계층별 펼치기/접기 처리 (위에서 아래로 내려보기)
  useEffect(() => {
    if (!expandedTypes || expandedTypes.size === 0) {
      // 아무것도 선택 안 함 → 모두 펼치기
      const allKeys = getAllKeys(items);
      setExpandedRowKeys(allKeys);
      return;
    }

    // expandedTypes에서 가장 높은 계층까지만 펼치기
    // 예: {PROJECT} → 아무것도 안 펼침 (PROJECT만 보임)
    // 예: {SERVICE} → PROJECT만 펼침 (PROJECT + SERVICE까지 보임)
    // 예: {TEAM} → PROJECT + SERVICE 펼침 (PROJECT + SERVICE + TEAM까지 보임)
    const hierarchy = [ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION];

    // expandedTypes에서 가장 높은(마지막) 계층 찾기
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
      items.forEach((item) => {
        const itemLevel = hierarchy.indexOf(item.type);

        // 현재 항목의 레벨이 maxLevel보다 낮으면 펼침
        if (itemLevel < maxLevel) {
          keysToExpand.push(item.id);
        }

        // 자식이 있으면 재귀
        if (item.children && item.children.length > 0) {
          collectKeys(item.children);
        }
      });
    };

    collectKeys(items);
    setExpandedRowKeys(keysToExpand);
  }, [expandedTypes, items]);

  // 모든 키를 재귀적으로 수집
  const getAllKeys = (items: Item[]): React.Key[] => {
    const keys: React.Key[] = [];
    const collectKeys = (items: Item[]) => {
      items.forEach((item) => {
        keys.push(item.id);
        if (item.children && item.children.length > 0) {
          collectKeys(item.children);
        }
      });
    };
    collectKeys(items);
    return keys;
  };

  // 특정 타입의 모든 항목 키를 수집
  const getKeysOfType = (item: Item, targetType: ItemType): React.Key[] => {
    const keys: React.Key[] = [];

    const collectKeys = (item: Item) => {
      if (item.type === targetType) {
        keys.push(item.id);
      }

      if (item.children && item.children.length > 0) {
        item.children.forEach((child) => {
          collectKeys(child);
        });
      }
    };

    collectKeys(item);
    return keys;
  };

  // 서비스 토글: PROJECT만 제어
  const toggleService = (item: Item) => {
    const projectKeys = getKeysOfType(item, ItemType.PROJECT);
    if (projectKeys.length === 0) return;

    const allExpanded = projectKeys.every(key => expandedRowKeys.includes(key));

    setExpandedRowKeys(prev => {
      if (allExpanded) {
        // 접기: PROJECT 제거
        return prev.filter(key => !projectKeys.includes(key));
      } else {
        // 펼치기: PROJECT 추가
        return [...new Set([...prev, ...projectKeys])];
      }
    });
  };

  // 팀 토글
  const toggleTeam = (item: Item) => {
    const projectKeys = getKeysOfType(item, ItemType.PROJECT);
    const serviceKeys = getKeysOfType(item, ItemType.SERVICE);

    if (serviceKeys.length === 0) return;

    const teamVisible = serviceKeys.every(key => expandedRowKeys.includes(key));

    setExpandedRowKeys(prev => {
      if (teamVisible) {
        // 접기: SERVICE만 제거 (PROJECT는 유지)
        return prev.filter(key => !serviceKeys.includes(key));
      } else {
        // 펼치기: PROJECT + SERVICE 추가
        return [...new Set([...prev, ...projectKeys, ...serviceKeys])];
      }
    });
  };

  // 액션 토글
  const toggleAction = (item: Item) => {
    const projectKeys = getKeysOfType(item, ItemType.PROJECT);
    const serviceKeys = getKeysOfType(item, ItemType.SERVICE);
    const teamKeys = getKeysOfType(item, ItemType.TEAM);

    if (teamKeys.length === 0) return;

    const actionVisible = teamKeys.every(key => expandedRowKeys.includes(key));

    setExpandedRowKeys(prev => {
      if (actionVisible) {
        // 접기: TEAM만 제거 (PROJECT + SERVICE는 유지)
        return prev.filter(key => !teamKeys.includes(key));
      } else {
        // 펼치기: PROJECT + SERVICE + TEAM 추가
        return [...new Set([...prev, ...projectKeys, ...serviceKeys, ...teamKeys])];
      }
    });
  };

  const getActionMenu = (record: Item) => ({
    items: [
      {
        key: 'add',
        icon: <PlusOutlined />,
        label: '하위 항목 추가',
        onClick: () => onAdd?.(record.id, getNextType(record.type)),
      },
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '수정',
        onClick: () => onEdit?.(record),
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '삭제',
        danger: true,
        onClick: () => onDelete?.(record.id),
      },
    ],
  });

  const getNextType = (currentType: ItemType): ItemType => {
    const types = [ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION];
    const currentIndex = types.indexOf(currentType);
    return types[Math.min(currentIndex + 1, types.length - 1)];
  };

  const columns: ColumnsType<Item> = [
    {
      title: '고객',
      key: 'client',
      width: 120,
      fixed: 'left',
      render: (_, record) => {
        if (record.type !== ItemType.PROJECT) return null;
        const client = record.Client;
        if (!client) return null;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 고객 썸네일 */}
            {client.logoUrl ? (
              <img
                src={client.logoUrl}
                alt={client.name}
                style={{
                  width: '28px',
                  height: '28px',
                  objectFit: 'cover',
                  borderRadius: '50%',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer'
                }}
              />
            ) : (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#999',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: '1px solid #e0e0e0',
                  flexShrink: 0,
                }}
              >
                {client.name.charAt(0).toUpperCase()}
              </div>
            )}
            {/* 고객명 */}
            <span style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#595959',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {client.name}
            </span>
          </div>
        );
      },
    },
    {
      title: '업무명',
      key: 'name',
      render: (_, record: Item) => {
        const commentCount = record._count?.Comment || 0;
        const fileCount = (record._count?.File || 0) + (record._count?.Link || 0);
        const indent = typeIndent[record.type];
        const isUnassigned = record.name.includes('미정') && (record.type === ItemType.PROJECT || record.type === ItemType.SERVICE);

        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: indent,
            backgroundColor: isUnassigned ? '#fff9e6' : 'transparent',
            cursor: 'pointer',
          }}
          onClick={() => onItemClick?.(record)}
          >
            {/* 액션 팀 태그 (3단계 구조: 생성자의 팀 표시) - A 태그 앞에 배치 */}
            {record.type === ItemType.ACTION && (
              <Tag
                color="green"
                style={{
                  fontSize: '10px',
                  padding: '0 4px',
                  margin: 0,
                  lineHeight: '18px',
                  width: '60px',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {(record as any).User_Item_createdByIdToUser?.Team?.name || '-'}
              </Tag>
            )}

            {/* 타입 아이콘 */}
            <span style={{ color: typeColors[record.type] }}>
              {typeIcons[record.type]}
            </span>

            {/* PSTA명 + 댓글 수 그룹 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}>
              {/* PSTA명 */}
              <span style={{
                fontWeight: 500,
                fontSize: '14px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1,
              }}>
                {record.name}
              </span>

              {/* 댓글 수 */}
              {commentCount > 0 && (
                <span style={{
                  fontSize: '12px',
                  color: '#8c8c8c',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}>
                  💬{commentCount}
                </span>
              )}

              {/* 관련문서 수 */}
              {fileCount > 0 && (
                <span style={{
                  fontSize: '12px',
                  color: '#8c8c8c',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}>
                  📎{fileCount}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: '담당자',
      key: 'assignee',
      width: 120,
      render: (_, record: Item) => {
        return (
          <span style={{
            fontSize: '13px',
            color: '#595959',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px'
          }}>
            <span>👤</span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {record.User_Item_assigneeIdToUser?.displayName || '-'}
            </span>
          </span>
        );
      },
    },
    {
      title: '상태',
      key: 'status',
      width: 80,
      render: (_, record: Item) => {
        return (
          <Tag color={statusColors[record.status]} style={{
            margin: 0,
            fontSize: '11px',
            padding: '1px 8px',
            minWidth: '50px',
            textAlign: 'center'
          }}>
            {statusLabels[record.status]}
          </Tag>
        );
      },
    },
    {
      title: '진행률',
      key: 'progress',
      width: 120,
      render: (_, record: Item) => {
        const progressDisplay = record.progress === 100 ? '✓' : `${record.progress}%`;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Progress
              percent={record.progress}
              size="small"
              strokeColor={record.progress === 100 ? '#52c41a' : '#1890ff'}
              showInfo={false}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: record.progress === 100 ? '#52c41a' : '#1890ff',
              minWidth: '30px',
              textAlign: 'right'
            }}>
              {progressDisplay}
            </span>
          </div>
        );
      },
    },
    {
      title: '기간',
      key: 'date',
      width: 220,
      render: (_, record: Item) => {
        const dateRange = record.startDate && record.endDate
          ? `${dayjs(record.startDate).format('YYYY.MM.DD')} - ${dayjs(record.endDate).format('YYYY.MM.DD')}`
          : '미정';

        return (
          <span style={{
            fontSize: '12px',
            color: '#595959',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px'
          }}>
            <span>📅</span>
            <span>{dateRange}</span>
          </span>
        );
      },
    },
    {
      title: 'PSTA',
      key: 'expandToggle',
      width: 130,
      className: 'interactive-column',
      render: (_, record) => {
        if (record.type !== ItemType.PROJECT) return null;

        const projectKeys = getKeysOfType(record, ItemType.PROJECT);
        const serviceKeys = getKeysOfType(record, ItemType.SERVICE);
        const teamKeys = getKeysOfType(record, ItemType.TEAM);

        const isProjectExpanded = expandedRowKeys.includes(record.id);
        const isServiceVisible = projectKeys.length > 0 && projectKeys.every(key => expandedRowKeys.includes(key));
        const isTeamVisible = serviceKeys.length > 0 && serviceKeys.every(key => expandedRowKeys.includes(key));
        const isActionVisible = teamKeys.length > 0 && teamKeys.every(key => expandedRowKeys.includes(key));

        return (
          <Space size={0}>
            <Tooltip title="프로젝트 접기">
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isProjectExpanded) {
                    setExpandedRowKeys(prev => prev.filter(key => key !== record.id));
                  }
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '0 6px',
                  height: '24px',
                  minWidth: '24px',
                  backgroundColor: '#722ed1',
                  color: '#fff',
                  borderColor: '#722ed1',
                  cursor: isProjectExpanded ? 'pointer' : 'not-allowed',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }}
              >
                P
              </Button>
            </Tooltip>

            <Tooltip title={isServiceVisible ? '서비스 접기' : '서비스 펼치기'}>
              <Button
                type={isServiceVisible ? 'primary' : 'default'}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleService(record);
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '0 6px',
                  height: '24px',
                  minWidth: '24px',
                  backgroundColor: isServiceVisible ? '#1890ff' : undefined,
                  color: isServiceVisible ? '#fff' : undefined,
                  borderColor: '#1890ff',
                  borderRadius: 0,
                  marginLeft: '-1px',
                }}
              >
                S
              </Button>
            </Tooltip>

            <Tooltip title={isTeamVisible ? '팀 접기' : '팀 펼치기'}>
              <Button
                type={isTeamVisible ? 'primary' : 'default'}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTeam(record);
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '0 6px',
                  height: '24px',
                  minWidth: '24px',
                  backgroundColor: isTeamVisible ? '#52c41a' : undefined,
                  color: isTeamVisible ? '#fff' : undefined,
                  borderColor: '#52c41a',
                  borderRadius: 0,
                  marginLeft: '-1px',
                }}
              >
                T
              </Button>
            </Tooltip>

            <Tooltip title={isActionVisible ? '액션 접기' : '액션 펼치기'}>
              <Button
                type={isActionVisible ? 'primary' : 'default'}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAction(record);
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '0 6px',
                  height: '24px',
                  minWidth: '24px',
                  backgroundColor: isActionVisible ? '#fa8c16' : undefined,
                  color: isActionVisible ? '#fff' : undefined,
                  borderColor: '#fa8c16',
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  marginLeft: '-1px',
                }}
              >
                A
              </Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const [tableHeight, setTableHeight] = useState(500);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setTableHeight(height);
      }
    };

    updateHeight();
    // 약간의 딜레이를 두고 한 번 더 업데이트 (transition 완료 후)
    const timer = setTimeout(updateHeight, 350);

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      clearTimeout(timer);
    };
  }, [hasDetailPanel]);

  return (
    <div ref={containerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .compact-table .ant-table-tbody > tr > td {
          padding: 2px 6px !important;
          line-height: 1.3 !important;
          border-bottom: none !important;
        }
        .compact-table .ant-table-thead > tr > th {
          padding: 6px 8px !important;
          font-size: 12px !important;
        }
        .compact-table .ant-table-cell {
          vertical-align: middle !important;
        }
        .compact-table .ant-table-tbody > tr:hover > td {
          background-color: #e6f7ff !important;
        }
        .compact-table .ant-table-row {
          transition: all 0.2s ease;
        }
      `}</style>
      <Table
        className="compact-table"
        columns={columns}
        dataSource={items}
        loading={loading}
        rowKey="id"
        pagination={false}
        expandable={{
          childrenColumnName: 'children',
          expandedRowKeys: expandedRowKeys,
          onExpand: (expanded, record) => {
            if (expanded) {
              setExpandedRowKeys(prev => [...prev, record.id]);
            } else {
              setExpandedRowKeys(prev => prev.filter(key => key !== record.id));
            }
          },
          showExpandColumn: false,
        }}
        scroll={{ x: 1000, y: tableHeight - 60 }}
        size="small"
      />
    </div>
  );
};