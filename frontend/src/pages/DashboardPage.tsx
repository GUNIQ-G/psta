import React, { useState, useEffect } from 'react';
import { Layout, Typography, Select, message, Modal, Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ItemTree } from '../components/ItemTree';
import { ItemFormModal } from '../components/ItemFormModal';
import { Item, ItemType } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { useAuthStore } from '../store/authStore';

const { Header, Content } = Layout;
const { Title } = Typography;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [parentItem, setParentItem] = useState<Item | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const handleAdd = (parentId?: string, type?: ItemType) => {
    setEditingItem(null);
    setParentItem(parentId ? { id: parentId } as Item : null);
    setModalOpen(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setParentItem(null);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '항목을 삭제하시겠습니까?',
      content: '하위 항목도 함께 삭제됩니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await itemsApi.deleteItem(id);
          message.success('삭제되었습니다');
          setRefreshKey((prev) => prev + 1);
        } catch (error: any) {
          message.error('삭제 실패: ' + error.message);
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, values);
        message.success('수정되었습니다');
      } else {
        await itemsApi.createItem(values);
        message.success('생성되었습니다');
      }
      setModalOpen(false);
      setEditingItem(null);
      setParentItem(null);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      message.error(error.response?.data?.error || '작업 실패');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>
          [PJT] 일정 관리
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
            설정
          </Button>
          <span>{user?.displayName}</span>
          <a onClick={logout}>로그아웃</a>
        </div>
      </Header>
      <Content style={{ padding: '24px' }}>
        <div style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 200 }}
            placeholder="고객 선택"
            allowClear
            onChange={setSelectedClientId}
            value={selectedClientId}
          >
            {clients.map((client) => (
              <Select.Option key={client.id} value={client.id}>
                {client.name}
              </Select.Option>
            ))}
          </Select>
        </div>
        <ItemTree
          key={refreshKey}
          clientId={selectedClientId}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <ItemFormModal
          open={modalOpen}
          item={editingItem}
          parentItem={parentItem}
          onCancel={() => {
            setModalOpen(false);
            setEditingItem(null);
            setParentItem(null);
          }}
          onSubmit={handleSubmit}
          clients={clients}
          users={users}
        />
      </Content>
    </Layout>
  );
};