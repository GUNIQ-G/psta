import React, { useState, useEffect } from 'react';
import {
  Typography,
  message,
  Modal,
  Button,
  Table,
  Space,
  Tag,
  Progress,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { ActionCreateDrawer } from '../components/ActionCreateDrawer';
import { ItemFormModal } from '../components/ItemFormModal';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;

export const ActionManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<Item[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [actions, setActions] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchClients();
    fetchUsers();
    fetchProjects();
    fetchServices();
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchActions();
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
    try {
      const data = await itemsApi.getItems({
        type: ItemType.PROJECT,
      });
      setProjects(data);
    } catch (error: any) {
      message.error('프로젝트 조회 실패: ' + error.message);
    }
  };

  const fetchServices = async () => {
    try {
      const data = await itemsApi.getItems({
        type: ItemType.SERVICE,
      });
      setServices(data);
    } catch (error: any) {
      message.error('서비스 조회 실패: ' + error.message);
    }
  };

  const fetchTeams = async () => {
    try {
      const data = await itemsApi.getItems({
        type: ItemType.TEAM,
      });
      setTeams(data);
    } catch (error: any) {
      message.error('팀 조회 실패: ' + error.message);
    }
  };

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
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
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

  const handleSubmit = async (values: any) => {
    try {
      // Force ACTION type
      const actionData = {
        ...values,
        type: ItemType.ACTION,
      };

      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, actionData);
        message.success('수정되었습니다');
      } else {
        await itemsApi.createItem(actionData);
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

  const columns = [
    {
      title: '팀',
      key: 'team',
      width: 200,
      render: (_: any, record: Item) => (
        <Space>
          <TeamOutlined style={{ color: '#52c41a' }} />
          <span>{(record as any).Item?.name || '-'}</span>
        </Space>
      ),
    },
    {
      title: '액션명',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <CheckCircleOutlined style={{ color: '#fa8c16' }} />
          <span style={{ fontWeight: 'bold' }}>{text}</span>
        </Space>
      ),
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
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Item) => {
        const canModify = user?.role === 'ADMIN' || record.createdById === user?.id;
        const tooltipText = '생성자 또는 최고관리자만 수정/삭제할 수 있습니다';

        return (
          <Space>
            <Tooltip title={!canModify ? tooltipText : ''}>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                disabled={!canModify}
              >
                수정
              </Button>
            </Tooltip>
            <Tooltip title={!canModify ? tooltipText : ''}>
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
                disabled={!canModify}
              >
                삭제
              </Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>액션 관리</Title>
        <Button
          icon={<CheckCircleOutlined />}
          onClick={handleAdd}
          size="large"
          style={{
            backgroundColor: '#fa8c16',
            borderColor: '#fa8c16',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#d87a16';
            e.currentTarget.style.borderColor = '#d87a16';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fa8c16';
            e.currentTarget.style.borderColor = '#fa8c16';
          }}
        >
          액션 추가
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={actions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1400 }}
      />

      <ActionCreateDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setRefreshKey((prev) => prev + 1);
        }}
        userTeamId={user?.teamId}
      />

      <ItemFormModal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
        item={editingItem}
        parentItem={null}
        clients={clients}
        users={users}
        fixedType={ItemType.ACTION}
        hideTypeField={true}
        hideClientField={true}
        nameLabel="액션명"
        projects={projects}
        services={services}
        teams={teams}
        showParentSelection={false}
        enableActionHierarchyEdit={true}
      />
    </div>
  );
};
