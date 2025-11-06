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
  Drawer,
  Checkbox,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  FolderOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { ServiceWizardModal } from '../components/ServiceWizardModal';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { teamApi } from '../api/team';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;

// 미정 서비스 UUID
const UNASSIGNED_SERVICE_ID = 'caeb1542-73bf-4edb-b7c5-073a97771ff1';

export const ServiceManagement: React.FC = () => {
  const { message } = App.useApp();
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [teamAssignDrawerOpen, setTeamAssignDrawerOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Item | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [assigningTeams, setAssigningTeams] = useState(false);
  const [teamDrawerExpanded, setTeamDrawerExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hideUnassigned, setHideUnassigned] = useState(true);

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
    Modal.confirm({
      title: '서비스를 삭제하시겠습니까?',
      content: '하위 팀, 액션도 함께 삭제됩니다.',
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

  const handleSubmit = async (values: any) => {
    try {
      // Debug logging
      console.log('=== SERVICE MANAGEMENT handleSubmit ===');
      console.log('Received values from ServiceWizardModal:', values);
      console.log('values.parentId:', values.parentId);
      console.log('values.clientId:', values.clientId);
      console.log('======================================');

      // Force SERVICE type
      const serviceData = {
        ...values,
        type: ItemType.SERVICE,
      };

      console.log('serviceData to be sent:', serviceData);

      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, serviceData);
        message.success('수정되었습니다');
      } else {
        await itemsApi.createItem(serviceData);
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

  const handleOpenTeamAssign = async (service: Item) => {
    setSelectedService(service);
    setSelectedTeamIds([]);

    // Fetch existing teams for this service
    try {
      const existingTeams = await itemsApi.getItems({
        type: ItemType.TEAM,
        parentId: service.id,
      });
      // Pre-select existing teams by matching team names
      const existingTeamNames = existingTeams.map((t: Item) => t.name);
      const matchingTeamIds = teams
        .filter((team) => existingTeamNames.includes(team.name))
        .map((team) => team.id);
      setSelectedTeamIds(matchingTeamIds);
    } catch (error) {
      console.error('Failed to fetch existing teams:', error);
    }

    setTeamAssignDrawerOpen(true);
  };

  const handleAssignTeams = async () => {
    if (!selectedService) return;

    setAssigningTeams(true);
    try {
      // Get existing teams for this service
      const existingTeams = await itemsApi.getItems({
        type: ItemType.TEAM,
        parentId: selectedService.id,
      });

      // Find teams to add (selected but not existing)
      const existingTeamNames = new Set(existingTeams.map((t: Item) => t.name));
      const teamsToAdd = teams.filter(
        (team) => selectedTeamIds.includes(team.id) && !existingTeamNames.has(team.name)
      );

      // Find teams to remove (existing but not selected)
      const selectedTeamNames = new Set(
        teams.filter((team) => selectedTeamIds.includes(team.id)).map((team) => team.name)
      );
      const teamsToRemove = existingTeams.filter(
        (team: Item) => !selectedTeamNames.has(team.name)
      );

      // Add new teams
      for (const team of teamsToAdd) {
        await itemsApi.createItem({
          name: team.name,
          type: ItemType.TEAM,
          parentId: selectedService.id,
          clientId: selectedService.clientId,
          status: ItemStatus.NOT_STARTED,
          progress: 0,
        });
      }

      // Remove unselected teams
      for (const team of teamsToRemove) {
        await itemsApi.deleteItem(team.id);
      }

      message.success('팀 할당이 완료되었습니다');
      setTeamAssignDrawerOpen(false);
      setSelectedService(null);
      setSelectedTeamIds([]);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      message.error('팀 할당 실패: ' + error.message);
    } finally {
      setAssigningTeams(false);
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

  const columns = [
    {
      title: '프로젝트',
      key: 'project',
      width: 200,
      render: (_: any, record: Item) => (
        <Space>
          <FolderOutlined style={{ color: '#722ed1' }} />
          <span>{(record as any).Item?.name || '-'}</span>
        </Space>
      ),
    },
    {
      title: '서비스명',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Item) => {
        const assignedTeams = (record as any).other_Item?.filter(
          (item: Item) => item.type === ItemType.TEAM
        ) || [];

        return (
          <div>
            <Space>
              <AppstoreOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontWeight: 'bold' }}>{text}</span>
            </Space>
            {assignedTeams.length > 0 && (
              <div style={{ marginTop: 4, marginLeft: 24 }}>
                {assignedTeams.map((team: Item, index: number) => (
                  <Tag
                    key={team.id}
                    icon={<TeamOutlined />}
                    color="green"
                    style={{ fontSize: 11, marginBottom: 2 }}
                  >
                    {team.name}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ItemStatus) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '진행률',
      dataIndex: 'progress',
      key: 'progress',
      width: 200,
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      ),
    },
    {
      title: '시작일',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString('ko-KR') : '-',
    },
    {
      title: '종료일',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString('ko-KR') : '-',
    },
    {
      title: '담당자',
      key: 'assignee',
      width: 120,
      render: (_: any, record: Item) => record.User_Item_assigneeIdToUser?.displayName || '-',
    },
    {
      title: '작업',
      key: 'action',
      width: 250,
      fixed: 'right' as const,
      render: (_: any, record: Item) => {
        const canModify = user?.role === 'ADMIN' || record.createdById === user?.id;
        const hasChildren = (record as any).other_Item && (record as any).other_Item.length > 0;
        const canDelete = canModify && !hasChildren;

        const editTooltip = !canModify ? '생성자 또는 최고관리자만 수정할 수 있습니다' : '';
        const deleteTooltip = hasChildren
          ? '하위 항목이 있어 삭제할 수 없습니다'
          : !canModify
          ? '생성자 또는 최고관리자만 삭제할 수 있습니다'
          : '';

        return (
          <Space>
            <Button
              type="link"
              icon={<TeamOutlined />}
              onClick={() => handleOpenTeamAssign(record)}
            >
              팀 할당
            </Button>
            <Tooltip title={editTooltip}>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                disabled={!canModify}
              >
                수정
              </Button>
            </Tooltip>
            <Tooltip title={deleteTooltip}>
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
                disabled={!canDelete}
              >
                삭제
              </Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  // 필터링된 서비스 목록
  const filteredServices = hideUnassigned
    ? services.filter(service => service.id !== UNASSIGNED_SERVICE_ID)
    : services;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>서비스 관리</Title>
        <Button
          icon={<AppstoreOutlined />}
          onClick={handleAdd}
          size="large"
          style={{
            backgroundColor: '#1890ff',
            borderColor: '#1890ff',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#096dd9';
            e.currentTarget.style.borderColor = '#096dd9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1890ff';
            e.currentTarget.style.borderColor = '#1890ff';
          }}
        >
          서비스 등록
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Checkbox
          checked={hideUnassigned}
          onChange={(e) => setHideUnassigned(e.target.checked)}
        >
          미정 서비스 숨기기
        </Checkbox>
      </div>

      <Table
        columns={columns}
        dataSource={filteredServices}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1400 }}
      />

      <Drawer
        title={`팀 할당 - ${selectedService?.name}`}
        placement="right"
        open={teamAssignDrawerOpen}
        onClose={() => {
          setTeamAssignDrawerOpen(false);
          setSelectedService(null);
          setSelectedTeamIds([]);
        }}
        width={teamDrawerExpanded ? 'calc(100vw - 200px)' : '50%'}
        extra={
          <Space>
            <Button
              onClick={() => {
                setTeamAssignDrawerOpen(false);
                setSelectedService(null);
                setSelectedTeamIds([]);
              }}
            >
              취소
            </Button>
            <Button
              type="primary"
              onClick={handleAssignTeams}
              loading={assigningTeams}
            >
              할당
            </Button>
          </Space>
        }
      >
        <Button
          icon={teamDrawerExpanded ? <ArrowRightOutlined /> : <ArrowLeftOutlined />}
          onClick={() => setTeamDrawerExpanded(!teamDrawerExpanded)}
          style={{
            position: 'fixed',
            left: teamDrawerExpanded ? '200px' : '50vw',
            top: '50%',
            transform: 'translate(-100%, -50%)',
            zIndex: 1001,
            width: 40,
            height: 60,
            borderRadius: '8px 0 0 8px',
            border: '1px solid #d9d9d9',
            borderRight: 'none',
            background: '#fff',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            서비스에 할당할 팀을 선택해주세요. 선택한 팀은 서비스의 하위 항목으로 추가됩니다.
          </p>
          <Checkbox.Group
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}
            value={selectedTeamIds}
            onChange={(checkedValues) => setSelectedTeamIds(checkedValues as string[])}
          >
            {teams.map((team) => (
              <Checkbox key={team.id} value={team.id}>
                <Space>
                  <TeamOutlined style={{ color: '#52c41a' }} />
                  <span style={{ fontWeight: 500 }}>{team.name}</span>
                  {team.description && (
                    <span style={{ color: '#999', fontSize: 12 }}>
                      - {team.description}
                    </span>
                  )}
                </Space>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      </Drawer>

      <ServiceWizardModal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
        item={editingItem}
        clients={clients}
        users={users}
        projects={projects}
        currentUserId={user?.id}
        currentUser={user}
      />
    </div>
  );
};
