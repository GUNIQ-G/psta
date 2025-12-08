import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Select,
  Typography,
  Empty,
  Input,
  Alert,
  Checkbox,
  Tooltip,
  Statistic,
  Row,
  Col,
} from 'antd';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';
import {
  RestOutlined,
  DeleteOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { trashApi } from '../api/trash';
import { ItemType, UserRole } from '../types';
import { useAuthStore } from '../store/authStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';

dayjs.extend(relativeTime);
dayjs.locale('ko');

const { Text } = Typography;
const { Search } = Input;

interface TrashModalProps {
  open: boolean;
  onCancel: () => void;
  onRestoreSuccess?: () => void;
}

interface TrashItem {
  id: string;
  type: ItemType;
  name: string;
  deletedAt: string;
  createdById: string;
  assigneeId?: string;
  User_Item_deletedByIdToUser?: {
    id: string;
    username: string;
    displayName: string;
  };
  User_Item_assigneeIdToUser?: {
    id: string;
    username: string;
    displayName: string;
  };
  User_Item_createdByIdToUser?: {
    id: string;
    username: string;
    displayName: string;
  };
  Client?: {
    id: string;
    name: string;
  };
  _count?: any;
}

const typeColors: Record<ItemType, string> = {
  PROJECT: '#722ed1',
  SERVICE: '#1890ff',
  TEAM: '#52c41a',
  ACTION: '#fa8c16',
};

const typeLabels: Record<ItemType, string> = {
  PROJECT: 'P',
  SERVICE: 'S',
  TEAM: 'T',
  ACTION: 'A',
};

const typeNames: Record<ItemType, string> = {
  PROJECT: '프로젝트',
  SERVICE: '서비스',
  TEAM: '팀',
  ACTION: '액션',
};

const typeIcons: Record<ItemType, React.ReactNode> = {
  PROJECT: <ProjectOutlined />,
  SERVICE: <AppstoreOutlined />,
  TEAM: <TeamOutlined />,
  ACTION: <CheckCircleOutlined />,
};

export const TrashModal: React.FC<TrashModalProps> = ({ open, onCancel, onRestoreSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<TrashItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (open) {
      fetchTrashItems();
    } else {
      // Reset state when modal closes
      setSearchKeyword('');
      setTypeFilter('ALL');
      setSelectedRowKeys([]);
    }
  }, [open]);

  useEffect(() => {
    applyFilters();
  }, [trashItems, typeFilter, searchKeyword]);

  const fetchTrashItems = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 1000 };
      if (typeFilter !== 'ALL') {
        params.type = typeFilter;
      }

      const data = await trashApi.getTrashItems(params);
      setTrashItems(data);
    } catch (error: any) {
      message.error('휴지통 조회 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...trashItems];

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    // Search filter
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase().trim();
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(keyword));
    }

    setFilteredItems(filtered);
  };

  const handleRestore = async (id: string, name: string) => {
    try {
      await trashApi.restoreItem(id);
      message.success(`"${name}" 항목이 복원되었습니다`);
      fetchTrashItems();
      onRestoreSuccess?.();
      setSelectedRowKeys([]); // Clear selection
    } catch (error: any) {
      message.error('복원 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    try {
      await trashApi.permanentlyDeleteItem(id);
      message.success(`"${name}" 항목이 영구 삭제되었습니다`);
      fetchTrashItems();
      setSelectedRowKeys([]); // Clear selection
    } catch (error: any) {
      message.error('영구 삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleBatchRestore = async () => {
    const successCount = [];
    const failCount = [];

    for (const id of selectedRowKeys) {
      try {
        await trashApi.restoreItem(id as string);
        successCount.push(id);
      } catch (error: any) {
        failCount.push(id);
        console.error('Restore failed for', id, error);
      }
    }

    if (successCount.length > 0) {
      message.success(`${successCount.length}개 항목이 복원되었습니다`);
      fetchTrashItems();
      onRestoreSuccess?.();
    }

    if (failCount.length > 0) {
      message.error(`${failCount.length}개 항목 복원 실패`);
    }

    setSelectedRowKeys([]);
  };

  const handleBatchDelete = async () => {
    const successCount = [];
    const failCount = [];

    for (const id of selectedRowKeys) {
      try {
        await trashApi.permanentlyDeleteItem(id as string);
        successCount.push(id);
      } catch (error: any) {
        failCount.push(id);
        console.error('Delete failed for', id, error);
      }
    }

    if (successCount.length > 0) {
      message.success(`${successCount.length}개 항목이 영구 삭제되었습니다`);
      fetchTrashItems();
    }

    if (failCount.length > 0) {
      message.error(`${failCount.length}개 항목 삭제 실패`);
    }

    setSelectedRowKeys([]);
  };

  // Check if user can restore/delete item
  const canRestore = (item: TrashItem): boolean => {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.PO && item.type === ItemType.PROJECT) return true;
    if (user.role === UserRole.PM && (item.type === ItemType.SERVICE || item.type === ItemType.TEAM)) return true;
    if (item.type === ItemType.ACTION && item.createdById === user.id) return true;
    return false;
  };

  const canDelete = (item: TrashItem): boolean => {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.PO && item.type === ItemType.PROJECT) return true;
    if (user.role === UserRole.PM && (item.type === ItemType.SERVICE || item.type === ItemType.TEAM)) return true;
    if (item.createdById === user.id) return true;
    return false;
  };

  // Calculate statistics
  const stats = {
    total: filteredItems.length,
    totalAll: trashItems.length,
    recent: filteredItems.filter((item) => dayjs().diff(dayjs(item.deletedAt), 'day') <= 7).length,
    critical: filteredItems.filter((item) => dayjs().diff(dayjs(item.deletedAt), 'day') >= 25).length,
  };

  const rowSelection: TableRowSelection<TrashItem> = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: TrashItem) => ({
      disabled: !canRestore(record) && !canDelete(record),
    }),
  };

  const columns: ColumnsType<TrashItem> = [
    {
      title: '타입',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: ItemType) => {
        return (
          <Tooltip title={typeNames[type]}>
            <Tag
              color={typeColors[type]}
              style={{
                margin: 0,
                fontSize: '11px',
                padding: '2px 6px',
                fontWeight: 600,
                minWidth: '28px',
                textAlign: 'center',
              }}
            >
              {typeLabels[type]}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '항목명',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record: TrashItem) => {
        const daysAgo = dayjs().diff(dayjs(record.deletedAt), 'day');
        const isCritical = daysAgo >= 25;

        return (
          <Space>
            <span style={{ fontWeight: 500 }}>{name}</span>
            {isCritical && (
              <Tooltip title={`${30 - daysAgo}일 후 자동 삭제`}>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '담당자',
      dataIndex: 'User_Item_assigneeIdToUser',
      key: 'assignee',
      width: 100,
      render: (assignee: any) => {
        return assignee?.displayName || '-';
      },
    },
    {
      title: '삭제일',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 120,
      render: (deletedAt: string) => {
        return (
          <Tooltip title={dayjs(deletedAt).format('YYYY-MM-DD HH:mm:ss')}>
            {dayjs(deletedAt).fromNow()}
          </Tooltip>
        );
      },
    },
    {
      title: '삭제자',
      dataIndex: 'User_Item_deletedByIdToUser',
      key: 'deletedBy',
      width: 100,
      render: (deletedBy: any) => {
        return deletedBy?.displayName || '-';
      },
    },
    {
      title: '복원 대상',
      key: 'childrenCount',
      width: 100,
      render: (_: any, record: TrashItem) => {
        const childCount = record._count?.other_Item || 0;
        if (childCount === 0) {
          return '-';
        }
        return (
          <Tooltip title={`${childCount}개 하위 항목 포함`}>
            <Tag color="blue">+{childCount}개</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '액션',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: TrashItem) => {
        const canRestoreItem = canRestore(record);
        const canDeleteItem = canDelete(record);

        return (
          <Space size="small">
            {canRestoreItem && (
              <Tooltip title="복원">
                <Popconfirm
                  title="복원하시겠습니까?"
                  description={
                    record._count?.other_Item
                      ? `"${record.name}" 및 ${record._count.other_Item}개 하위 항목을 복원합니다.`
                      : `"${record.name}" 항목을 복원합니다.`
                  }
                  onConfirm={() => handleRestore(record.id, record.name)}
                  okText="복원"
                  cancelText="취소"
                >
                  <Button type="link" size="small" icon={<RestOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
            {canDeleteItem && (
              <Tooltip title="영구 삭제">
                <Popconfirm
                  title="영구 삭제하시겠습니까?"
                  description={`"${record.name}" 항목을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
                  onConfirm={() => handlePermanentDelete(record.id, record.name)}
                  okText="영구 삭제"
                  okType="danger"
                  cancelText="취소"
                >
                  <Button type="link" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <DeleteOutlined style={{ fontSize: 20 }} />
          <span>휴지통</span>
          <Tag color="default">
            {user?.role === UserRole.ADMIN ? `전체 ${stats.totalAll}개` : `내 항목 ${stats.total}개`}
          </Tag>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={1200}
      footer={null}
      style={{ top: 20 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Statistics */}
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="전체 항목"
              value={stats.total}
              prefix={<InfoCircleOutlined />}
              valueStyle={{ fontSize: 18 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="7일 이내"
              value={stats.recent}
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="⚠️ 5일 이내 삭제"
              value={stats.critical}
              valueStyle={{ fontSize: 18, color: '#ff4d4f' }}
            />
          </Col>
        </Row>

        {/* Info Alert */}
        <Alert
          message="휴지통 정보"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>30일 후 자동으로 영구 삭제됩니다</li>
              <li>프로젝트/서비스 복원 시 하위 항목도 함께 복원됩니다</li>
              {user?.role === UserRole.ADMIN ? (
                <li>관리자는 모든 항목을 볼 수 있습니다</li>
              ) : (
                <li>본인이 생성하거나 담당자로 지정된 항목만 볼 수 있습니다</li>
              )}
            </ul>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
        />

        {/* Filters */}
        <Space wrap>
          <Text type="secondary">필터:</Text>
          <Space.Compact>
            {[ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION].map((type, index) => {
              const isActive = typeFilter === type;
              return (
                <Button
                  key={type}
                  size="small"
                  type={isActive ? 'primary' : 'default'}
                  onClick={() => setTypeFilter(isActive ? 'ALL' : type)}
                  style={{
                    backgroundColor: isActive ? typeColors[type] : undefined,
                    borderColor: typeColors[type],
                    color: isActive ? '#fff' : typeColors[type],
                    fontWeight: 600,
                    fontSize: '11px',
                    height: '24px',
                    minWidth: '24px',
                    padding: '0 8px',
                  }}
                >
                  {typeLabels[type]}
                </Button>
              );
            })}
            {typeFilter !== 'ALL' && (
              <Button size="small" onClick={() => setTypeFilter('ALL')}>
                전체
              </Button>
            )}
          </Space.Compact>

          <Search
            placeholder="항목명 검색"
            allowClear
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: 200 }}
            size="small"
          />
        </Space>

        {/* Batch Actions */}
        {selectedRowKeys.length > 0 && (
          <Space>
            <Text strong>선택한 {selectedRowKeys.length}개 항목:</Text>
            <Popconfirm
              title={`${selectedRowKeys.length}개 항목을 복원하시겠습니까?`}
              onConfirm={handleBatchRestore}
              okText="복원"
              cancelText="취소"
            >
              <Button type="primary" icon={<RestOutlined />} size="small">
                복원
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`${selectedRowKeys.length}개 항목을 영구 삭제하시겠습니까?`}
              description="이 작업은 되돌릴 수 없습니다."
              onConfirm={handleBatchDelete}
              okText="영구 삭제"
              okType="danger"
              cancelText="취소"
            >
              <Button danger icon={<DeleteOutlined />} size="small">
                영구 삭제
              </Button>
            </Popconfirm>
          </Space>
        )}

        {/* Table */}
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredItems}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `총 ${total}개`,
          }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="삭제된 항목이 없습니다" />
            ),
          }}
          scroll={{ x: 1000, y: 400 }}
          size="small"
        />
      </Space>
    </Modal>
  );
};
