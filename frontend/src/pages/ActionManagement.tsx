import React, { useState, useEffect } from 'react';
import {
  Typography,
  App,
  Modal,
  Button,
  Table,
  Space,
  Tag,
  Progress,
  Tooltip,
  Card,
  Row,
  Col,
  Statistic,
  Input,
  Select,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  SearchOutlined,
  FolderOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { ActionCreateDrawer } from '../components/ActionCreateDrawer';
import { ItemFormModal } from '../components/ItemFormModal';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import { useAuthStore } from '../store/authStore';
import { useActionItemModal } from '../hooks/useActionItemModal';

const { Title } = Typography;
const { Search } = Input;

export const ActionManagement: React.FC = () => {
  const { message, modal } = App.useApp();
  const { user } = useAuthStore();
  const [actions, setActions] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'progress-high' | 'progress-low' | 'name'>('latest');

  // Custom hook for action item modal
  const { modalProps, openModal } = useActionItemModal({
    onSuccess: () => setRefreshKey((prev) => prev + 1),
    enableHierarchyEdit: true,
  });

  useEffect(() => {
    fetchActions();
  }, [refreshKey]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const data = await itemsApi.getItems({
        type: ItemType.ACTION,
      });
      setActions(data);
    } catch (error: any) {
      message.error('액션 조회 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setDrawerOpen(true);
  };

  const handleEdit = (item: Item) => {
    openModal(item);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: '액션을 삭제하시겠습니까?',
      content: '이 작업은 되돌릴 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await itemsApi.deleteItem(id);
          message.success('삭제되었습니다');
          setRefreshKey((prev) => prev + 1);
        } catch (error: any) {
          if (error.response?.status === 403) {
            message.error('권한이 없습니다. 생성자 또는 최고관리자만 삭제할 수 있습니다.');
          } else {
            message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
          }
        }
      },
    });
  };

  const getStatusColor = (status: ItemStatus) => {
    switch (status) {
      case ItemStatus.IN_PROGRESS:
        return 'processing';
      case ItemStatus.COMPLETED:
        return 'success';
      case ItemStatus.ON_HOLD:
        return 'warning';
      case ItemStatus.NOT_STARTED:
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: ItemStatus) => {
    switch (status) {
      case ItemStatus.IN_PROGRESS:
        return '진행중';
      case ItemStatus.COMPLETED:
        return '완료';
      case ItemStatus.ON_HOLD:
        return '보류';
      case ItemStatus.NOT_STARTED:
        return '시작 전';
      default:
        return status;
    }
  };

  const getStatusBarColor = (status: ItemStatus) => {
    switch (status) {
      case ItemStatus.IN_PROGRESS:
        return '#1890ff';
      case ItemStatus.COMPLETED:
        return '#52c41a';
      case ItemStatus.ON_HOLD:
        return '#faad14';
      case ItemStatus.NOT_STARTED:
        return '#d9d9d9';
      default:
        return '#d9d9d9';
    }
  };

  // 필터링 및 정렬된 액션 목록
  const getFilteredAndSortedActions = () => {
    let filtered = [...actions];

    if (searchText) {
      filtered = filtered.filter(action =>
        action.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (action as any).Item?.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(action => action.status === statusFilter);
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'progress-high':
          return b.progress - a.progress;
        case 'progress-low':
          return a.progress - b.progress;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return sorted;
  };

  const getStatistics = () => {
    return {
      total: actions.length,
      inProgress: actions.filter(a => a.status === ItemStatus.IN_PROGRESS).length,
      completed: actions.filter(a => a.status === ItemStatus.COMPLETED).length,
    };
  };

  const stats = getStatistics();
  const filteredActions = getFilteredAndSortedActions();

  const columns = [
    {
      title: '',
      key: 'statusBar',
      width: 4,
      render: (_: any, record: Item) => (
        <div
          style={{
            width: 4,
            height: '100%',
            backgroundColor: getStatusBarColor(record.status),
            borderRadius: '2px 0 0 2px',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
          }}
        />
      ),
    },
    {
      title: '액션',
      key: 'action',
      render: (_: any, record: Item) => {
        // 3단계 구조: parentId → 서비스 → 프로젝트
        const recordAny = record as any;
        const service = recordAny.Item; // parentId가 가리키는 서비스
        const project = service?.Item; // 서비스의 부모(프로젝트)
        const creatorTeam = recordAny.User_Item_createdByIdToUser?.Team;
        const projectName = project?.name || '-';
        const serviceName = service?.name || '-';
        const teamName = creatorTeam?.name || '-';

        const assignee = record.User_Item_assigneeIdToUser?.displayName || '-';
        const status = getStatusText(record.status);
        const start = record.startDate
          ? new Date(record.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '. ')
          : '-';
        const end = record.endDate
          ? new Date(record.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '. ')
          : '-';

        return (
          <div style={{ padding: '12px 0', position: 'relative', paddingLeft: 4 }}>
            {/* 상단 영역: 계층 정보 (프로젝트, 서비스, 팀) */}
            <div style={{
              paddingTop: 6,
              paddingBottom: 8,
              backgroundColor: '#fafafa',
              marginLeft: -4,
              marginRight: -4,
              paddingLeft: 4,
              paddingRight: 4,
              borderRadius: '4px 4px 0 0',
              display: 'flex',
              alignItems: 'center',
              marginBottom: 12
            }}>
              <Space size={4} wrap style={{ width: '100%' }}>
                {/* 프로젝트 */}
                <Tag
                  icon={<FolderOutlined />}
                  color="purple"
                  style={{ fontSize: 11, margin: 0 }}
                >
                  P: {projectName}
                </Tag>

                {/* 서비스 */}
                <Tag
                  icon={<AppstoreOutlined />}
                  color="blue"
                  style={{ fontSize: 11, margin: 0 }}
                >
                  S: {serviceName}
                </Tag>

                {/* 팀 */}
                <Tag
                  icon={<TeamOutlined />}
                  color="green"
                  style={{ fontSize: 11, margin: 0 }}
                >
                  T: {teamName}
                </Tag>
              </Space>
            </div>

            {/* 하단 영역: 액션명, 담당자, 상태, 일정, 진행률 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* 왼쪽 영역: 액션명, 담당자 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                {/* 액션명 */}
                <div style={{ minWidth: 250, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircleOutlined style={{ color: '#fa8c16', fontSize: 14 }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>
                    {record.name}
                  </span>
                </div>

                {/* 담당자 */}
                <div style={{ minWidth: 100 }}>
                  <span style={{ fontSize: 12, color: '#595959' }}>{assignee}</span>
                </div>
              </div>

              {/* 오른쪽 영역: 진행률, 일정, 상태 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* 진행률 */}
                <div style={{ width: 100 }}>
                  <Progress
                    percent={record.progress}
                    size="small"
                    showInfo={true}
                    strokeColor="#fa8c16"
                    trailColor="#f0f0f0"
                  />
                </div>

                {/* 일정 */}
                <div style={{ width: 220, textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: '#262626', fontWeight: 600 }}>
                    {start !== '-' && end !== '-' ? `${start} ~ ${end}` : '-'}
                  </span>
                </div>

                {/* 상태 */}
                <div style={{ width: 60, textAlign: 'center' }}>
                  <Tag color={getStatusColor(record.status)} style={{ fontSize: 11, margin: 0 }}>
                    {status}
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* 헤더: 통계 + 검색/필터 통합 */}
      <Row gutter={16} align="middle" style={{ marginBottom: 24 }}>
        {/* 왼쪽: 컴팩트 통계 */}
        <Col flex="auto">
          <Space size={24}>
            <Statistic
              title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>📊 진행중</span>}
              value={stats.inProgress}
              valueStyle={{ fontSize: 18, color: '#1890ff', fontWeight: 600 }}
            />
            <Statistic
              title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>✅ 완료</span>}
              value={stats.completed}
              valueStyle={{ fontSize: 18, color: '#52c41a', fontWeight: 600 }}
            />
            <Statistic
              title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>📁 전체</span>}
              value={stats.total}
              valueStyle={{ fontSize: 18, color: '#fa8c16', fontWeight: 600 }}
            />
          </Space>
        </Col>

        {/* 오른쪽: 검색 및 컨트롤 */}
        <Col flex="none">
          <Space>
            <Search
              placeholder="액션명 또는 팀 검색"
              allowClear
              style={{ width: 200 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 100 }}
              options={[
                { value: 'ALL', label: '전체' },
                { value: ItemStatus.IN_PROGRESS, label: '진행중' },
                { value: ItemStatus.COMPLETED, label: '완료' },
                { value: ItemStatus.ON_HOLD, label: '보류' },
                { value: ItemStatus.NOT_STARTED, label: '시작 전' },
              ]}
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 120 }}
              options={[
                { value: 'latest', label: '최신순' },
                { value: 'oldest', label: '오래된순' },
                { value: 'progress-high', label: '진행률 높은순' },
                { value: 'progress-low', label: '진행률 낮은순' },
                { value: 'name', label: '이름순' },
              ]}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              style={{
                backgroundColor: '#fa8c16',
                borderColor: '#fa8c16',
                fontWeight: 600,
              }}
            >
              등록
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 테이블 */}
      <style>
        {`
          .compact-list-row td {
            padding: 16px 8px !important;
            border-bottom: 1px solid #f5f5f5 !important;
          }
          .compact-list-row:hover td {
            background-color: #fafafa !important;
          }
        `}
      </style>
      <Table
        columns={columns}
        dataSource={filteredActions}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `총 ${total}개`,
        }}
        showHeader={true}
        size="middle"
        rowClassName={() => 'compact-list-row'}
        onRow={(record) => ({
          onClick: () => handleEdit(record),
          style: { cursor: 'pointer' },
        })}
        style={{
          background: '#fff',
        }}
      />

      <ActionCreateDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setRefreshKey((prev) => prev + 1);
        }}
        userTeamId={user?.teamId}
      />

      <ItemFormModal {...modalProps} />
    </div>
  );
};
