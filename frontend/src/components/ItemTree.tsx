import React, { useState, useEffect } from 'react';
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
  TEAM: 40,
  ACTION: 60,
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
  selectedClientIds = [],
  selectedProjectIds = [],
  searchKeyword = '',
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  // 재귀적으로 미정 항목 필터링
  const filterUnassignedItems = (items: Item[]): Item[] => {
    return items
      .filter(item => !hideUnassignedIds.includes(item.id))
      .map(item => ({
        ...item,
        children: item.children ? filterUnassignedItems(item.children) : undefined,
      }));
  };

  // 고객/프로젝트 필터링 (다중 선택)
  const filterByHierarchy = (items: Item[], ancestorProjectId?: string): Item[] => {
    return items
      .map(item => {
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
      .filter((item): item is Item => item !== null);
  };

  // 검색 필터링: 검색어가 있으면 매칭되는 항목과 그 상위/하위 항목 모두 표시
  const filterBySearch = (items: Item[]): Item[] => {
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
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await itemsApi.getItemTree(undefined, userTeamId);
      console.log('ItemTree data:', data);
      console.log('First item _count:', data[0]?._count);

      // 필터링 적용
      let filteredData = data;

      // 1. 미정 항목 필터링
      if (hideUnassignedIds.length > 0) {
        filteredData = filterUnassignedItems(filteredData);
      }

      // 2. 고객/프로젝트 필터링
      if (selectedClientIds.length > 0 || selectedProjectIds.length > 0) {
        filteredData = filterByHierarchy(filteredData);
      }

      // 3. 검색 필터링
      if (searchKeyword && searchKeyword.trim() !== '') {
        filteredData = filterBySearch(filteredData);
      }

      setItems(filteredData);
      // 기본적으로 모든 행 펼치기
      const allKeys = getAllKeys(filteredData);
      setExpandedRowKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [userTeamId, hideUnassignedIds, selectedClientIds, selectedProjectIds, searchKeyword]);

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
      title: '업무 계층',
      key: 'expandToggle',
      width: 100,
      fixed: 'left',
      className: 'interactive-column',
      onHeaderCell: () => ({
        style: {
          backgroundColor: '#f0f5ff',
          fontWeight: 600,
        },
      }),
      onCell: () => ({
        style: {
          backgroundColor: '#fafafa',
        },
      }),
      render: (_, record) => {
        if (record.type !== ItemType.PROJECT) return null;

        // 각 레벨별 상태 확인
        // 서비스를 보려면 PROJECT가 펼쳐져야 함
        // 팀을 보려면 SERVICE가 펼쳐져야 함
        // 액션을 보려면 TEAM이 펼쳐져야 함
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
                  // 프로젝트 접기만 가능 (닫기 전용)
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
    {
      title: '고객',
      dataIndex: ['Client', 'name'],
      key: 'client',
      width: 150,
      render: (_: string, record: Item) => {
        const client = record.Client;
        if (!client) return '-';

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {client.logoUrl ? (
              <img
                src={client.logoUrl}
                alt={client.name}
                style={{
                  width: '24px',
                  height: '24px',
                  objectFit: 'contain',
                  borderRadius: '2px'
                }}
              />
            ) : (
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#999',
                  fontWeight: 'bold'
                }}
              >
                {client.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span>{client.name}</span>
          </div>
        );
      },
    },
    {
      title: 'PSTA 명',
      dataIndex: 'name',
      key: 'name',
      width: 400,
      render: (name: string, record: Item) => {
        const commentCount = record._count?.Comment || 0;
        const indent = typeIndent[record.type];
        const hasTreeLine = indent > 0;

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '0',
              paddingLeft: `${indent}px`,
            }}
            onClick={() => onItemClick?.(record)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hasTreeLine && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: '4px',
                }}>
                  {/* 세로선 */}
                  <div style={{
                    width: '1px',
                    height: '24px',
                    backgroundColor: '#d9d9d9',
                    position: 'relative',
                    marginRight: '8px',
                  }}>
                    {/* 가로선 */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '0',
                      width: '12px',
                      height: '1px',
                      backgroundColor: '#d9d9d9',
                    }} />
                  </div>
                </div>
              )}
              <span style={{ color: typeColors[record.type] }}>
                {typeIcons[record.type]}
              </span>
              <span>{name}</span>
            </div>
            {commentCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8c8c8c', fontSize: '12px' }}>
                <MessageOutlined style={{ fontSize: '12px' }} />
                <span>{commentCount}</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: '진행 일정',
      key: 'schedule',
      width: 200,
      render: (_, record) => {
        if (!record.startDate || !record.endDate) return '-';
        return `${dayjs(record.startDate).format('YYYY.MM.DD')} → ${dayjs(record.endDate).format('YYYY.MM.DD')}`;
      },
    },
    {
      title: '담당자',
      dataIndex: ['User_Item_assigneeIdToUser', 'displayName'],
      key: 'assignee',
      width: 120,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ItemStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '진행률',
      dataIndex: 'progress',
      key: 'progress',
      width: 70,
      align: 'center',
      render: (progress: number) => (
        <Progress
          type="circle"
          percent={progress}
          size={40}
          strokeWidth={6}
          format={(percent) => (
            <span style={{ fontSize: '11px', fontWeight: 600 }}>
              {percent}%
            </span>
          )}
        />
      ),
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
          padding: 4px 8px !important;
          line-height: 1.2 !important;
        }
        .compact-table .ant-table-thead > tr > th {
          padding: 8px 8px !important;
        }
        .compact-table .ant-table-cell {
          vertical-align: middle !important;
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
        scroll={{ x: 1270, y: tableHeight - 60 }}
        size="small"
      />
    </div>
  );
};