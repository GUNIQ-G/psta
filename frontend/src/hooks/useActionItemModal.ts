import { useState, useEffect } from 'react';
import { App } from 'antd';
import { Item, ItemType } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { useAuthStore } from '../store/authStore';

interface UseActionItemModalOptions {
  onSuccess?: () => void;
  enableHierarchyEdit?: boolean;
  hideClientField?: boolean;
  hideTypeField?: boolean;
  fixedType?: ItemType;
  nameLabel?: string;
}

export const useActionItemModal = (options: UseActionItemModalOptions = {}) => {
  const {
    onSuccess,
    enableHierarchyEdit = false,
    hideClientField = true,
    hideTypeField = true,
    fixedType = ItemType.ACTION,
    nameLabel = '액션명',
  } = options;

  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [teams, setTeams] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all required data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [clientsData, usersData, projectsData, servicesData, teamsData] = await Promise.all([
        clientsApi.getClients(),
        userApi.getAll(),
        itemsApi.getItems({ type: ItemType.PROJECT }),
        itemsApi.getItems({ type: ItemType.SERVICE }),
        itemsApi.getItems({ type: ItemType.TEAM }),
      ]);

      setClients(clientsData);
      setUsers(usersData);
      setProjects(projectsData);
      setServices(servicesData);
      setTeams(teamsData);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      message.error('데이터 조회 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item?: Item) => {
    setEditingItem(item || null);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (values: any) => {
    try {
      // Force ACTION type if fixedType is set
      const itemData = fixedType ? {
        ...values,
        type: fixedType,
      } : values;

      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, itemData);
        message.success('수정되었습니다');
      } else {
        await itemsApi.createItem(itemData);
        message.success('생성되었습니다');
      }

      closeModal();
      onSuccess?.();
    } catch (error: any) {
      if (error.response?.status === 403) {
        message.error('권한이 없습니다. 생성자 또는 최고관리자만 수정할 수 있습니다.');
      } else {
        message.error(error.response?.data?.error || '작업 실패');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await itemsApi.deleteItem(id);
      message.success('삭제되었습니다');
      closeModal();
      onSuccess?.();
    } catch (error: any) {
      if (error.response?.status === 403) {
        message.error('권한이 없습니다. 생성자 또는 최고관리자만 삭제할 수 있습니다.');
      } else {
        message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // Standardized props for ItemFormModal
  const modalProps = {
    open,
    item: editingItem,
    onCancel: closeModal,
    onSubmit: handleSubmit,
    onDelete: handleDelete,
    parentItem: null,
    clients,
    users,
    fixedType,
    hideTypeField,
    hideClientField,
    nameLabel,
    projects,
    services,
    teams,
    showParentSelection: false,
    enableActionHierarchyEdit: enableHierarchyEdit,
  };

  return {
    modalProps,
    openModal,
    closeModal,
    isOpen: open,
    loading,
    // Expose raw data for custom usage if needed
    data: {
      clients,
      users,
      projects,
      services,
      teams,
    },
  };
};
