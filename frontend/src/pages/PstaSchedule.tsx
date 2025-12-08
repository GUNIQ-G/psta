import React, { useState, useEffect, useMemo } from 'react';
import { Typography, App, Button, Space, Checkbox, Divider, Input, Tabs, Dropdown } from 'antd';
import { CheckOutlined, DownOutlined, EyeInvisibleOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { ItemTree } from '../components/ItemTree';
import { ItemFormModal } from '../components/ItemFormModal';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { HierarchyToggleButtons } from '../components/HierarchyToggleButtons';
import { WbsTimeline } from '../components/WbsTimeline';
import { Item, ItemType, User } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { teamApi } from '../api/team';
import { useAuthStore } from '../store/authStore';
import { useActionItemModal } from '../hooks/useActionItemModal';

const { Title } = Typography;

// 미정 프로젝트 및 서비스 UUID
const UNASSIGNED_PROJECT_ID = 'f9c9f2d2-6e0c-4e63-838d-e0a4c5ad4de7';
const UNASSIGNED_SERVICE_ID = 'caeb1542-73bf-4edb-b7c5-073a97771ff1';

export const PstaSchedule: React.FC = () => {
  const { message, modal } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [hideUnassigned, setHideUnassigned] = useState(true);
  const [hideEmptyTeams, setHideEmptyTeams] = useState(true);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [expandedTypes, setExpandedTypes] = useState<Set<ItemType>>(
    new Set([ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION])
  );
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [originalTreeItem, setOriginalTreeItem] = useState<Item | null>(null); // ItemTree 원본 데이터 (ACTION 수정용)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [parentItem, setParentItem] = useState<Item | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'tree' | 'wbs'>('tree');
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const user = useAuthStore((state) => state.user);

  // ACTION 타입 전용 훅 - Dashboard, ActionManagement와 동일한 방식
  const { modalProps: actionModalProps, openModal: openActionModal } = useActionItemModal({
    onSuccess: () => setRefreshKey((prev) => prev + 1),
    enableHierarchyEdit: true,
  });

  // hideUnassignedIds를 useMemo로 메모이제이션하여 무한 렌더링 방지
  const hideUnassignedIds = useMemo(() => {
    return hideUnassigned ? [UNASSIGNED_PROJECT_ID, UNASSIGNED_SERVICE_ID] : [];
  }, [hideUnassigned]);

  useEffect(() => {
    fetchClients();
    fetchUsers();
    fetchProjects();
    fetchServices();
    fetchTeams();
  }, []);

  // URL 파라미터에서 itemId를 읽어 해당 항목 자동 선택
  useEffect(() => {
    const itemId = searchParams.get('itemId');
    const shouldEdit = searchParams.get('edit') === 'true';

    if (itemId) {
      loadItemById(itemId, shouldEdit);
      // URL 파라미터 제거 (한 번만 실행)
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadItemById = async (itemId: string, shouldEdit: boolean = false) => {
    try {
      const item = await itemsApi.getItemById(itemId);
      setSelectedItem(item);

      if (shouldEdit) {
        // 수정 모달 열기
        setEditingItem(item);
        setModalOpen(true);
        message.success('액션 정보를 입력해주세요');
      } else {
        message.success('멘션된 항목으로 이동했습니다');
      }
    } catch (error) {
      console.error('Failed to load item:', error);
      message.error('항목을 불러올 수 없습니다');
    }
  };

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
      const projectItems = await itemsApi.getItems({ type: ItemType.PROJECT });
      setProjects(projectItems);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const serviceItems = await itemsApi.getItems({ type: ItemType.SERVICE });
      setServices(serviceItems);
    } catch (error) {
      console.error('Failed to fetch services:', error);
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

  const handleHierarchyToggle = (type: ItemType) => {
    const newExpandedTypes = new Set(expandedTypes);

    // 계층 순서: PROJECT -> SERVICE -> TEAM -> ACTION
    const hierarchy = [ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION];
    const clickedIndex = hierarchy.indexOf(type);

    if (newExpandedTypes.has(type)) {
      // 이미 펼쳐져 있으면 해당 계층과 하위 계층 모두 제거
      for (let i = clickedIndex; i < hierarchy.length; i++) {
        newExpandedTypes.delete(hierarchy[i]);
      }
    } else {
      // 접혀 있으면 해당 계층까지 모두 추가
      for (let i = 0; i <= clickedIndex; i++) {
        newExpandedTypes.add(hierarchy[i]);
      }
    }

    setExpandedTypes(newExpandedTypes);
  };

  const handleAdd = (parentId?: string, type?: ItemType) => {
    setEditingItem(null);
    setParentItem(parentId ? { id: parentId } as Item : null);
    setOpenInEditMode(false);
    setModalOpen(true);
  };

  const handleEdit = async (item: Item) => {
    // ACTION 타입: useActionItemModal 훅 사용 (Dashboard, ActionManagement와 동일)
    // ItemTree 원본 데이터 사용 (getItemById 사용 안 함)
    if (item.type === ItemType.ACTION) {
      // originalTreeItem이 있고 같은 아이템이면 원본 사용, 아니면 현재 item 사용
      const actionItem = (originalTreeItem && originalTreeItem.id === item.id)
        ? originalTreeItem
        : item;
      openActionModal(actionItem);
      return;
    }

    // 다른 타입(PROJECT, SERVICE, TEAM): 기존 방식 유지
    try {
      const fullItem = await itemsApi.getItemById(item.id);
      setEditingItem(fullItem);
    } catch (error) {
      console.error('Failed to fetch full item data:', error);
      setEditingItem(item);
    }

    setParentItem(null);
    setOpenInEditMode(true);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
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
      // Determine item type (from editingItem or values)
      const itemType = editingItem?.type || values.type;
      let itemId: string;

      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, values);
        itemId = editingItem.id;
        message.success('수정되었습니다');
      } else {
        const createdItem = await itemsApi.createItem(values);
        itemId = createdItem.id;
        message.success('생성되었습니다');
      }

      // Close modal and refresh
      setModalOpen(false);
      setEditingItem(null);
      setParentItem(null);
      setOpenInEditMode(false);
      setRefreshKey((prev) => prev + 1);

      // If ItemDetailModal is open, refresh the selected item
      if (selectedItem && selectedItem.id === itemId) {
        const updatedItem = await itemsApi.getItemById(itemId);
        setSelectedItem(updatedItem);
      }
    } catch (error: any) {
      console.error('PstaSchedule handleSubmit error:', error);
      if (error.response?.status === 403) {
        message.error('권한이 없습니다. 생성자 또는 최고관리자만 수정할 수 있습니다.');
      } else {
        message.error(error.response?.data?.error || '작업 실패');
      }
    }
  };

  const handleItemClick = async (item: Item) => {
    // ItemTree 원본 데이터 저장 (ACTION 수정 시 사용)
    setOriginalTreeItem(item);

    try {
      // getItemById를 호출하여 WorkRequest 등 모든 관계 데이터 포함 (ItemDetailModal용)
      const fullItem = await itemsApi.getItemById(item.id);

      // other_Item을 children으로 매핑 (ItemDetailModal 호환성)
      const itemWithChildren = {
        ...fullItem,
        children: (fullItem as any).other_Item || fullItem.children || [],
      };

      setSelectedItem(itemWithChildren);
    } catch (error) {
      console.error('Failed to load item:', error);
      // 실패 시 기존 item으로라도 표시
      setSelectedItem(item);
    }
  };

  const handleCloseDetail = () => {
    setSelectedItem(null);
    setOriginalTreeItem(null);
  };

  const tabItems = [
    {
      key: 'tree',
      label: '아이템 트리',
    },
    {
      key: 'wbs',
      label: 'WBS',
    },
  ];

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 상세 정보 패널 */}
      <ItemDetailModal
        item={selectedItem}
        open={!!selectedItem}
        onClose={handleCloseDetail}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onItemClick={handleItemClick}
        users={users}
      />

      {/* 테이블 영역 */}
      <div style={{
        flex: selectedItem ? '0 0 40%' : '1',
        overflow: 'hidden',
        transition: 'flex 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 12px',
          marginBottom: 0
        }}>
          {/* 좌측: 탭 */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'tree' | 'wbs')}
            items={tabItems}
            size="small"
            style={{ marginBottom: 0 }}
          />

          {/* 우측: 필터 그룹 */}
          <Space size={8}>
            {/* 검색창 */}
            <Input
              size="small"
              placeholder="PSTA 명 검색"
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 220 }}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />

            {/* 고객 */}
            <Dropdown
              menu={{
                items: clients.map(client => ({
                  key: client.id,
                  label: (
                    <Checkbox
                      checked={selectedClientIds.includes(client.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedClientIds(prev =>
                          checked ? [...prev, client.id] : prev.filter(id => id !== client.id)
                        );
                        setRefreshKey((prev) => prev + 1);
                      }}
                    >
                      {client.name}
                    </Checkbox>
                  ),
                })),
              }}
              trigger={['click']}
            >
              <Button size="small">
                고객
                {selectedClientIds.length > 0 && (
                  <span style={{
                    marginLeft: 4,
                    color: '#1890ff',
                    fontWeight: 600
                  }}>
                    {selectedClientIds.length}
                  </span>
                )}
                <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
              </Button>
            </Dropdown>

            {/* 프로젝트 */}
            <Dropdown
              menu={{
                items: projects
                  .filter(p => selectedClientIds.length === 0 || selectedClientIds.includes(p.clientId || ''))
                  .map(project => ({
                    key: project.id,
                    label: (
                      <Checkbox
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedProjectIds(prev =>
                            checked ? [...prev, project.id] : prev.filter(id => id !== project.id)
                          );
                          setRefreshKey((prev) => prev + 1);
                        }}
                      >
                        {project.name}
                      </Checkbox>
                    ),
                  })),
              }}
              trigger={['click']}
            >
              <Button size="small">
                프로젝트
                {selectedProjectIds.length > 0 && (
                  <span style={{
                    marginLeft: 4,
                    color: '#1890ff',
                    fontWeight: 600
                  }}>
                    {selectedProjectIds.length}
                  </span>
                )}
                <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
              </Button>
            </Dropdown>

            {/* 내 작업 */}
            <Button
              size="small"
              type={showMyTasksOnly ? 'primary' : 'default'}
              icon={showMyTasksOnly ? <CheckOutlined /> : <UserOutlined />}
              onClick={() => {
                setShowMyTasksOnly(!showMyTasksOnly);
                setRefreshKey((prev) => prev + 1);
              }}
            >
              내 작업
            </Button>

            {/* 미정 숨김 */}
            <Button
              size="small"
              type={hideUnassigned ? 'primary' : 'default'}
              icon={hideUnassigned ? <CheckOutlined /> : <EyeInvisibleOutlined />}
              onClick={() => {
                setHideUnassigned(!hideUnassigned);
                setRefreshKey((prev) => prev + 1);
              }}
            >
              미정 숨김
            </Button>

            {/* 액션 없음 숨김 */}
            <Button
              size="small"
              type={hideEmptyTeams ? 'primary' : 'default'}
              icon={hideEmptyTeams ? <CheckOutlined /> : <EyeInvisibleOutlined />}
              onClick={() => {
                setHideEmptyTeams(!hideEmptyTeams);
                setRefreshKey((prev) => prev + 1);
              }}
            >
              액션 없음 숨김
            </Button>

            {/* PSTA 펼치기/숨기기 */}
            <HierarchyToggleButtons
              expandedTypes={expandedTypes}
              onToggle={handleHierarchyToggle}
            />
          </Space>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', height: 0 }}>
          {activeTab === 'tree' ? (
            <ItemTree
              key={refreshKey}
              userTeamId={showMyTasksOnly ? user?.teamId : undefined}
              expandedTypes={expandedTypes}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onItemClick={handleItemClick}
              hasDetailPanel={!!selectedItem}
              hideUnassignedIds={hideUnassignedIds}
              hideEmptyTeams={hideEmptyTeams}
              selectedClientIds={selectedClientIds}
              selectedProjectIds={selectedProjectIds}
              searchKeyword={searchKeyword}
            />
          ) : (
            <WbsTimeline
              key={refreshKey}
              userTeamId={showMyTasksOnly ? user?.teamId : undefined}
              expandedTypes={expandedTypes}
              hideUnassignedIds={hideUnassignedIds}
              hideEmptyTeams={hideEmptyTeams}
              selectedClientIds={selectedClientIds}
              selectedProjectIds={selectedProjectIds}
              searchKeyword={searchKeyword}
              onItemClick={handleItemClick}
            />
          )}
        </div>
      </div>

      {/* PROJECT, SERVICE, TEAM용 모달 (기존 방식) */}
      <ItemFormModal
        open={modalOpen}
        item={editingItem}
        parentItem={parentItem}
        fixedType={editingItem?.type}
        hideTypeField={!!editingItem}
        hideClientField={editingItem?.type === ItemType.SERVICE}
        nameLabel={
          editingItem?.type === ItemType.PROJECT ? '프로젝트명' :
          editingItem?.type === ItemType.SERVICE ? '서비스명' :
          editingItem?.type === ItemType.TEAM ? '팀명' : '업무명'
        }
        initialEditMode={openInEditMode}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
          setParentItem(null);
          setOpenInEditMode(false);
        }}
        onSubmit={handleSubmit}
        onRefresh={() => setRefreshKey((prev) => prev + 1)}
        clients={clients}
        users={users}
        projects={projects}
        services={services}
        teams={teams}
        enableActionHierarchyEdit={false}
        showParentSelection={false}
      />

      {/* ACTION용 모달 - useActionItemModal 훅 사용 (Dashboard, ActionManagement와 동일) */}
      <ItemFormModal {...actionModalProps} />
    </div>
  );
};
