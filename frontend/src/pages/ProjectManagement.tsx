import React, { useState, useEffect } from 'react';
import {
  Typography,
  Select,
  App,
  Modal,
  Button,
  Table,
  Space,
  Tag,
  Progress,
  Checkbox,
  Tooltip,
  Card,
  Row,
  Col,
  Statistic,
  Input,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  AppstoreOutlined,
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { ItemFormModal } from '../components/ItemFormModal';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;
const { Search } = Input;

// 미정 프로젝트 UUID
const UNASSIGNED_PROJECT_ID = 'f9c9f2d2-6e0c-4e63-838d-e0a4c5ad4de7';

export const ProjectManagement: React.FC = () => {
  const { message, modal } = App.useApp();
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hideUnassigned, setHideUnassigned] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'progress-high' | 'progress-low' | 'name'>('latest');

  useEffect(() => {
    fetchClients();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [refreshKey]);

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await userApi.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await itemsApi.getItems({
        type: ItemType.PROJECT,
        parentId: null,
      });
      setProjects(data);
    } catch (error: any) {
      message.error('프로젝트 조회 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: '프로젝트를 삭제하시겠습니까?',
      content: (
        <div>
          <p>프로젝트를 삭제하면 하위 팀과 액션은 '<strong>미정 프로젝트</strong>'로 자동 이동됩니다.</p>
          <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            ※ 휴지통에서 복원 시 원래 구조로 복원됩니다.
          </p>
        </div>
      ),
      okText: '삭제 및 이동',
      okType: 'danger',
      cancelText: '취소',
      width: 480,
      onOk: async () => {
        try {
          const response = await itemsApi.deleteItem(id);

          // 응답이 있고 팀 이동 정보가 있는 경우
          if (response && response.movedTeamCount !== undefined) {
            const { movedTeamCount, actionCount } = response;

            if (movedTeamCount > 0) {
              message.success(
                `프로젝트가 삭제되었습니다. ${movedTeamCount}개 팀(${actionCount || 0}개 액션)이 '미정 프로젝트'로 이동되었습니다.`
              );
            } else {
              message.success('프로젝트가 삭제되었습니다.');
            }
          } else {
            message.success('프로젝트가 삭제되었습니다.');
          }

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

  const handleSubmit = async (values: any) => {
    try {
      // Force PROJECT type and no parent
      const projectData = {
        ...values,
        type: ItemType.PROJECT,
        parentId: null,
      };

      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, projectData);
        message.success('수정되었습니다');
      } else {
        await itemsApi.createItem(projectData);
        message.success('생성되었습니다');
      }
      setModalOpen(false);
      setEditingItem(null);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      if (error.response?.status === 403) {
        message.error('권한이 없습니다. 생성자 또는 최고관리자만 수정할 수 있습니다.');
      } else {
        message.error(error.response?.data?.error || '작업 실패');
      }
    }
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

  // 필터링 및 정렬된 프로젝트 목록
  const getFilteredAndSortedProjects = () => {
    let filtered = hideUnassigned
      ? projects.filter(project => !project.name.includes('미정'))
      : projects;

    // 검색 필터
    if (searchText) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchText.toLowerCase()) ||
        project.Client?.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 상태 필터
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    // 정렬
    const sorted = [...filtered].sort((a, b) => {
      // 미정 프로젝트는 항상 맨 앞에
      const aIsUndecided = a.name.includes('미정');
      const bIsUndecided = b.name.includes('미정');
      if (aIsUndecided && !bIsUndecided) return -1;
      if (!aIsUndecided && bIsUndecided) return 1;

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

  // 통계 계산
  const getStatistics = () => {
    const filtered = hideUnassigned
      ? projects.filter(p => !p.name.includes('미정'))
      : projects;

    return {
      total: filtered.length,
      inProgress: filtered.filter(p => p.status === ItemStatus.IN_PROGRESS).length,
      completed: filtered.filter(p => p.status === ItemStatus.COMPLETED).length,
    };
  };

  const stats = getStatistics();
  const filteredProjects = getFilteredAndSortedProjects();

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
      title: '프로젝트',
      key: 'project',
      render: (_: any, record: Item) => {
        const services = (record as any).other_Item?.filter(
          (item: Item) => item.type === ItemType.SERVICE
        ) || [];

        const client = record.Client?.name || '-';
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
            {/* 상단 영역: 고객사, 프로젝트명, 담당자, 상태, 일정, 진행률 */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
              {/* 왼쪽 영역: 고객사, 프로젝트명, 담당자 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                {/* 고객사 */}
                <div style={{ minWidth: 100 }}>
                  <Tag
                    color={record.name.includes('미정') ? 'orange' : 'default'}
                    style={{ fontSize: 11, margin: 0 }}
                  >
                    {client}
                  </Tag>
                </div>

                {/* 프로젝트명 */}
                <div style={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FolderOutlined
                    style={{
                      color: record.name.includes('미정') ? '#fa8c16' : '#722ed1',
                      fontSize: 14
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: record.name.includes('미정') ? '#fa8c16' : '#262626'
                    }}
                  >
                    {record.name}
                  </span>
                </div>

                {/* 담당자 */}
                <div style={{ minWidth: 80 }}>
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
                    strokeColor={record.name.includes('미정') ? '#fa8c16' : '#722ed1'}
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

            {/* 하단 영역: 하위 서비스 태그 */}
            {services.length > 0 && (
              <div style={{
                paddingTop: 6,
                paddingBottom: 8,
                backgroundColor: '#fafafa',
                marginLeft: -4,
                marginRight: -4,
                paddingLeft: 4,
                paddingRight: 4,
                borderRadius: '0 0 4px 4px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Space size={4} wrap style={{ width: '100%' }}>
                  {services.map((service: Item) => (
                    <Tag
                      key={service.id}
                      icon={<AppstoreOutlined />}
                      color="blue"
                      style={{ fontSize: 11, margin: 0 }}
                    >
                      {service.name}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
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
              valueStyle={{ fontSize: 18, color: '#722ed1', fontWeight: 600 }}
            />
          </Space>
        </Col>

        {/* 오른쪽: 검색 및 컨트롤 */}
        <Col flex="none">
          <Space>
            <Search
              placeholder="프로젝트명 또는 고객사 검색"
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
            <Checkbox
              checked={hideUnassigned}
              onChange={(e) => setHideUnassigned(e.target.checked)}
            >
              미정 프로젝트 숨기기
            </Checkbox>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              style={{
                backgroundColor: '#722ed1',
                borderColor: '#722ed1',
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
        dataSource={filteredProjects}
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

      <ItemFormModal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        item={editingItem}
        parentItem={null}
        clients={clients}
        users={users}
        fixedType={ItemType.PROJECT}
        hideTypeField={true}
        nameLabel="프로젝트명"
        showParentSelection={false}
        projects={[]}
        services={[]}
        teams={[]}
      />
    </div>
  );
};
