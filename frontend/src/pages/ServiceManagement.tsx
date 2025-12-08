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
  Checkbox,
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
  AppstoreOutlined,
  FolderOutlined,
  TeamOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { ItemFormModal } from '../components/ItemFormModal';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { teamApi } from '../api/team';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;
const { Search } = Input;

// 미정 서비스 UUID
const UNASSIGNED_SERVICE_ID = 'caeb1542-73bf-4edb-b7c5-073a97771ff1';

export const ServiceManagement: React.FC = () => {
  const { message, modal } = App.useApp();
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
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
    fetchProjects();
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchServices();
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

  const fetchTeams = async () => {
    try {
      const data = await teamApi.getAll();
      setTeams(data.filter((team) => team.isActive));
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const data = await itemsApi.getItems({
        type: ItemType.PROJECT,
        parentId: null,
      });
      setProjects(data);
    } catch (error: any) {
      message.error('프로젝트 조회 실패: ' + error.message);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const data = await itemsApi.getItems({
        type: ItemType.SERVICE,
      });
      setServices(data);
    } catch (error: any) {
      message.error('서비스 조회 실패: ' + error.message);
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
      title: '서비스를 삭제하시겠습니까?',
      content: (
        <div>
          <p>서비스를 삭제하면 하위 팀과 액션은 '<strong>미정 서비스</strong>'로 자동 이동됩니다.</p>
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
                `서비스가 삭제되었습니다. ${movedTeamCount}개 팀(${actionCount || 0}개 액션)이 '미정 서비스'로 이동되었습니다.`
              );
            } else {
              message.success('서비스가 삭제되었습니다.');
            }
          } else {
            message.success('서비스가 삭제되었습니다.');
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
      // Force SERVICE type
      const serviceData = {
        ...values,
        type: ItemType.SERVICE,
      };

      let serviceId: string;

      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, serviceData);
        serviceId = editingItem.id;
        message.success('수정되었습니다');
      } else {
        const createdService = await itemsApi.createItem(serviceData);
        serviceId = createdService.id;
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

  // 필터링 및 정렬된 서비스 목록
  const getFilteredAndSortedServices = () => {
    // 미정 서비스들을 분리
    const undecidedServices = services.filter(service => service.name.includes('미정'));
    const regularServices = services.filter(service => !service.name.includes('미정'));

    let filtered = regularServices;

    // 미정 서비스들을 하나로 통합
    if (undecidedServices.length > 0 && !hideUnassigned) {
      // 3단계 구조: 모든 미정 서비스의 액션 생성자 팀들을 수집 (중복 제거)
      const allTeams: any[] = [];
      const teamMap = new Map(); // 팀 ID로 중복 제거

      undecidedServices.forEach(service => {
        // 하위 액션들에서 생성자 팀 정보 가져오기
        const childActions = (service as any).other_Item || [];

        childActions.forEach((action: any) => {
          const team = action.User_Item_createdByIdToUser?.Team;
          if (team && !teamMap.has(team.id)) {
            // 팀에 원래 프로젝트 정보 추가
            const projectName = (service as any).Item?.name || '미정 프로젝트';
            teamMap.set(team.id, {
              ...team,
              originalProject: projectName,
            });
          }
        });
      });

      allTeams.push(...teamMap.values());

      // 평균 진행률 계산
      const totalProgress = undecidedServices.reduce((sum, s) => sum + s.progress, 0);
      const avgProgress = undecidedServices.length > 0
        ? Math.round(totalProgress / undecidedServices.length)
        : 0;

      // 통합 미정 서비스 객체 생성
      const unifiedUndecidedService: any = {
        id: 'UNIFIED_UNDECIDED_SERVICE',
        name: '미정 서비스 (통합)',
        type: ItemType.SERVICE,
        status: ItemStatus.NOT_STARTED,
        progress: avgProgress,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        isUnified: true, // 특별 플래그
        ServiceTeamsAsService: allTeams.map(team => ({
          Team: team,
          Actions: team.actions || [],
        })),
        Item: {
          name: `전체 프로젝트 (${undecidedServices.length}개)`,
        },
        User_Item_assigneeIdToUser: null,
        startDate: null,
        endDate: null,
      };

      // 통합 서비스를 맨 앞에 추가
      filtered = [unifiedUndecidedService, ...regularServices];
    } else {
      filtered = regularServices;
    }

    // 검색 필터
    if (searchText) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (service as any).Item?.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 상태 필터
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(service => service.status === statusFilter);
    }

    // 정렬
    const sorted = [...filtered].sort((a, b) => {
      // 통합 서비스는 항상 맨 앞에
      if ((a as any).isUnified) return -1;
      if ((b as any).isUnified) return 1;

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
    const filtered = hideUnassigned
      ? services.filter(s => !s.name.includes('미정'))
      : services;

    return {
      total: filtered.length,
      inProgress: filtered.filter(s => s.status === ItemStatus.IN_PROGRESS).length,
      completed: filtered.filter(s => s.status === ItemStatus.COMPLETED).length,
    };
  };

  const stats = getStatistics();
  const filteredServices = getFilteredAndSortedServices();

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
      title: '서비스',
      key: 'service',
      render: (_: any, record: Item) => {
        // 3단계 구조: 하위 액션들의 생성자 팀에서 팀 정보 추출 (중복 제거)
        const childActions = (record as any).other_Item || [];
        const teamMap = new Map();
        childActions.forEach((action: any) => {
          const team = action.User_Item_createdByIdToUser?.Team;
          if (team && !teamMap.has(team.id)) {
            teamMap.set(team.id, team);
          }
        });
        // 팀을 level 기준으로 정렬 (상위 조직이 왼쪽에 표시)
        const assignedTeams = Array.from(teamMap.values())
          .sort((a: any, b: any) => (a.level || 0) - (b.level || 0));

        const project = (record as any).Item?.name || '-';
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
            {/* 상단 영역: 프로젝트, 서비스명, 담당자, 상태, 일정, 진행률 */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
              {/* 왼쪽 영역: 프로젝트, 서비스명, 담당자 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                {/* 프로젝트 */}
                <div style={{ minWidth: 100 }}>
                  <Tag
                    color={(record as any).isUnified ? 'orange' : 'purple'}
                    style={{ fontSize: 11, margin: 0 }}
                  >
                    P: {project}
                  </Tag>
                </div>

                {/* 서비스명 */}
                <div style={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AppstoreOutlined
                    style={{
                      color: (record as any).isUnified ? '#fa8c16' : '#1890ff',
                      fontSize: 14
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: (record as any).isUnified ? '#fa8c16' : '#262626'
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
                    strokeColor="#1890ff"
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

            {/* 하단 영역: 하위 팀 태그 */}
            {assignedTeams.length > 0 && (
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
                  {assignedTeams.map((team: any) => (
                    <Tag
                      key={team.id}
                      icon={<TeamOutlined />}
                      color="green"
                      style={{ fontSize: 11, margin: 0 }}
                    >
                      {team.name}
                      {/* 통합 서비스의 경우 원래 프로젝트 정보 표시 */}
                      {(record as any).isUnified && team.originalProject && (
                        <span style={{ color: '#999', marginLeft: 4 }}>
                          ({team.originalProject})
                        </span>
                      )}
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
              valueStyle={{ fontSize: 18, color: '#1890ff', fontWeight: 600 }}
            />
          </Space>
        </Col>

        {/* 오른쪽: 검색 및 컨트롤 */}
        <Col flex="none">
          <Space>
            <Search
              placeholder="서비스명 또는 프로젝트 검색"
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
              미정 서비스 숨기기
            </Checkbox>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              style={{
                backgroundColor: '#1890ff',
                borderColor: '#1890ff',
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
        dataSource={filteredServices}
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
          onClick: () => {
            // 통합 서비스는 편집 불가
            if (!(record as any).isUnified) {
              handleEdit(record);
            }
          },
          style: { cursor: (record as any).isUnified ? 'default' : 'pointer' },
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
        fixedType={ItemType.SERVICE}
        hideTypeField={true}
        hideClientField={true}
        nameLabel="서비스명"
        projects={projects}
        services={[]}
        teams={[]}
      />
    </div>
  );
};
