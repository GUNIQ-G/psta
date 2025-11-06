import React, { useState, useEffect } from 'react';
import {
  Typography,
  Select,
  message,
  Modal,
  Button,
  Table,
  Space,
  Tag,
  Progress,
  Checkbox,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;

// 미정 프로젝트 UUID
const UNASSIGNED_PROJECT_ID = 'f9c9f2d2-6e0c-4e63-838d-e0a4c5ad4de7';

export const ProjectManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hideUnassigned, setHideUnassigned] = useState(true);

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
    Modal.confirm({
      title: '프로젝트를 삭제하시겠습니까?',
      content: '하위 서비스, 팀, 액션도 함께 삭제됩니다.',
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

  const columns = [
    {
      title: '고객',
      key: 'client',
      width: 150,
      render: (_: any, record: Item) => record.Client?.name || '-',
    },
    {
      title: '프로젝트명',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Item) => {
        const services = (record as any).other_Item?.filter(
          (item: Item) => item.type === ItemType.SERVICE
        ) || [];

        return (
          <div>
            <Space>
              <FolderOutlined style={{ color: '#722ed1' }} />
              <span style={{ fontWeight: 'bold' }}>{text}</span>
            </Space>
            {services.length > 0 && (
              <div style={{ marginTop: 4, marginLeft: 24 }}>
                {services.map((service: Item) => (
                  <Tag
                    key={service.id}
                    icon={<AppstoreOutlined />}
                    color="blue"
                    style={{ fontSize: 11, marginBottom: 2 }}
                  >
                    {service.name}
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
      width: 150,
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

  // 필터링된 프로젝트 목록
  const filteredProjects = hideUnassigned
    ? projects.filter(project => project.id !== UNASSIGNED_PROJECT_ID)
    : projects;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>프로젝트 관리</Title>
        <Button
          icon={<FolderOutlined />}
          onClick={handleAdd}
          size="large"
          style={{
            backgroundColor: '#722ed1',
            borderColor: '#722ed1',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#531dab';
            e.currentTarget.style.borderColor = '#531dab';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#722ed1';
            e.currentTarget.style.borderColor = '#722ed1';
          }}
        >
          프로젝트 등록
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Checkbox
          checked={hideUnassigned}
          onChange={(e) => setHideUnassigned(e.target.checked)}
        >
          미정 프로젝트 숨기기
        </Checkbox>
      </div>

      <Table
        columns={columns}
        dataSource={filteredProjects}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <ProjectWizardModal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmit}
        item={editingItem}
        clients={clients}
        users={users}
        currentUserId={user?.id}
        currentUser={user}
      />
    </div>
  );
};
