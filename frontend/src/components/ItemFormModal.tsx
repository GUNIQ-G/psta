import React, { useState, useEffect } from 'react';
import { Drawer, Form, Button, Space, Tag, App, Popconfirm, Select, Input, Divider } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Item, ItemType, User } from '../types';
import { useAuthStore } from '../store/authStore';
import { useUnifiedItemForm } from '../hooks/useUnifiedItemForm';
import { CommonFormFields } from './form-sections/CommonFormFields';
import { ProjectFormSection } from './form-sections/ProjectFormSection';
import { ServiceFormSection } from './form-sections/ServiceFormSection';
import { TeamFormSection } from './form-sections/TeamFormSection';
import { ActionFormSection } from './form-sections/ActionFormSection';
import { FileAndLinkSection } from './form-sections/FileAndLinkSection';

interface ItemFormModalProps {
  open: boolean;
  item?: Item | null;
  parentItem?: Item | null;
  onCancel: () => void;
  onSubmit: (values: any) => void;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
  clients: any[];
  users: User[];
  fixedType?: ItemType;
  hideTypeField?: boolean;
  hideTimeSpentField?: boolean;
  hideClientField?: boolean;
  selectedClientId?: string;
  nameLabel?: string;
  projects?: any[];
  services?: any[];
  teams?: any[];
  showParentSelection?: boolean;
  enableActionHierarchyEdit?: boolean;
  initialEditMode?: boolean;
}

const getTypeInfo = (type: ItemType): { text: string; color: string } => {
  switch (type) {
    case ItemType.PROJECT:
      return { text: '프로젝트', color: '#722ed1' };
    case ItemType.SERVICE:
      return { text: '서비스', color: '#1890ff' };
    case ItemType.TEAM:
      return { text: '팀', color: '#52c41a' };
    case ItemType.ACTION:
      return { text: '액션', color: '#fa8c16' };
    default:
      return { text: type, color: '#d9d9d9' };
  }
};

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  open,
  item,
  parentItem,
  onCancel,
  onSubmit,
  onDelete,
  onRefresh,
  clients,
  users,
  fixedType,
  hideTypeField = false,
  hideTimeSpentField = false,
  hideClientField = false,
  selectedClientId,
  nameLabel = '업무명',
  projects = [],
  services = [],
  teams = [],
  showParentSelection = false,
  enableActionHierarchyEdit = false,
  initialEditMode = false,
}) => {
  const { modal, message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [currentType, setCurrentType] = useState<ItemType | undefined>(fixedType || item?.type);

  // Create shared form instance
  const [sharedForm] = Form.useForm();

  // 통합 Hook - 모든 타입을 처리
  // open이 false일 때는 item을 undefined로 전달하여 Hook이 아무것도 하지 않도록 함
  const activeForm = useUnifiedItemForm({
    form: sharedForm,
    item: open ? item : undefined,
    initialEditMode,
    clients,
    projects,
    services,
    teams,
    enableHierarchyEdit: enableActionHierarchyEdit,
  });
  const {
    form,
    isEditing,
    setIsEditing,
    files,
    links,
    uploading,
    handleFileUpload,
    handleFileDelete,
    handleLinkCreate,
    handleLinkDelete,
    formatFileSize,
    toggleEditMode,
  } = activeForm;

  // 타입 변경 시 currentType 업데이트
  useEffect(() => {
    setCurrentType(fixedType || item?.type);
  }, [fixedType, item]);

  // Form 제출 핸들러
  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      // Prepare data to submit
      const submitData: any = {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };

      // ACTION 타입: parentId를 selectedServiceId로 설정 (계층 수정 시)
      if (currentType === ItemType.ACTION && enableActionHierarchyEdit && activeForm.selectedServiceId) {
        submitData.parentId = activeForm.selectedServiceId;
      }

      onSubmit(submitData);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // 수정 버튼 클릭 핸들러 - 권한 체크 후 편집 모드 진입
  const handleEditClick = () => {
    if (!item) return;

    // 권한 체크: 생성자, 담당자, 또는 ADMIN만 수정 가능
    const isCreator = item.createdById === user?.id;
    const isAssignee = item.assigneeId === user?.id;
    const isAdmin = user?.role === 'ADMIN';

    if (!isCreator && !isAssignee && !isAdmin) {
      message.error('생성자, 담당자 또는 최고관리자만 수정할 수 있습니다');
      return;
    }

    toggleEditMode();
  };

  // 삭제 핸들러
  const handleDeleteClick = () => {
    if (!item || !onDelete) return;

    // 권한 체크: 생성자 또는 ADMIN만 삭제 가능
    const isCreator = item.createdById === user?.id;
    const isAdmin = user?.role === 'ADMIN';

    if (!isCreator && !isAdmin) {
      message.error('생성자 또는 최고관리자만 삭제할 수 있습니다');
      return;
    }

    modal.confirm({
      title: '항목을 삭제하시겠습니까?',
      content: '이 작업은 되돌릴 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: () => {
        onDelete(item.id);
      },
    });
  };

  // 타입 선택 렌더링 (생성 모드에서만)
  const renderTypeSelection = () => {
    if (item || hideTypeField) return null;

    return (
      <Form.Item
        name="type"
        label="구분"
        rules={[{ required: true, message: '구분을 선택해주세요' }]}
      >
        <Select
          size="large"
          onChange={(value: ItemType) => {
            setCurrentType(value);
            if (value === ItemType.SERVICE) {
              const clientId = form.getFieldValue('clientId');
              if (clientId) {
                activeForm.loadProjects(clientId);
              }
            }
          }}
        >
          <Select.Option value={ItemType.PROJECT}>
            <Tag color={getTypeInfo(ItemType.PROJECT).color} style={{ marginRight: 8 }}>
              {getTypeInfo(ItemType.PROJECT).text}
            </Tag>
          </Select.Option>
          <Select.Option value={ItemType.SERVICE}>
            <Tag color={getTypeInfo(ItemType.SERVICE).color} style={{ marginRight: 8 }}>
              {getTypeInfo(ItemType.SERVICE).text}
            </Tag>
          </Select.Option>
          <Select.Option value={ItemType.TEAM}>
            <Tag color={getTypeInfo(ItemType.TEAM).color} style={{ marginRight: 8 }}>
              {getTypeInfo(ItemType.TEAM).text}
            </Tag>
          </Select.Option>
          <Select.Option value={ItemType.ACTION}>
            <Tag color={getTypeInfo(ItemType.ACTION).color} style={{ marginRight: 8 }}>
              {getTypeInfo(ItemType.ACTION).text}
            </Tag>
          </Select.Option>
        </Select>
      </Form.Item>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      width="60%"
      destroyOnClose
      title={
        <Space>
          {item ? (
            <>
              <Tag color={getTypeInfo(currentType || item.type).color}>
                {getTypeInfo(currentType || item.type).text}
              </Tag>
              <span>{item.name}</span>
            </>
          ) : (
            '새 항목 생성'
          )}
        </Space>
      }
      extra={
        <Space>
          {item ? (
            // 수정 모드 (기존 항목)
            <>
              {isEditing ? (
                <>
                  <Button type="primary" onClick={handleOk}>
                    저장
                  </Button>
                  <Button onClick={toggleEditMode}>취소</Button>
                </>
              ) : (
                <>
                  <Button icon={<EditOutlined />} onClick={handleEditClick}>
                    수정
                  </Button>
                  {onDelete && (
                    <Button danger icon={<DeleteOutlined />} onClick={handleDeleteClick}>
                      삭제
                    </Button>
                  )}
                </>
              )}
            </>
          ) : (
            // 생성 모드 (새 항목)
            <>
              <Button type="primary" onClick={handleOk}>
                생성
              </Button>
              <Button onClick={onCancel}>취소</Button>
            </>
          )}
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleOk}>
        {/* 타입별 FormSection 렌더링 */}
        {currentType === ItemType.PROJECT && (
          <ProjectFormSection
            isEditing={isEditing}
            item={item}
            clients={clients}
            hideClientField={hideClientField}
          />
        )}

        {currentType === ItemType.SERVICE && (
          <ServiceFormSection
            isEditing={isEditing}
            item={item}
            clients={clients}
            availableProjects={activeForm.availableProjects}
            hideClientField={hideClientField}
            onClientChange={activeForm.handleClientChange}
            onProjectChange={activeForm.handleProjectChange}
          />
        )}

        {currentType === ItemType.TEAM && (
          <TeamFormSection
            isEditing={isEditing}
            item={item}
            clients={clients}
            hideClientField={hideClientField}
          />
        )}

        {currentType === ItemType.ACTION && (
          <ActionFormSection
            isEditing={isEditing}
            item={item}
            projects={projects}
            filteredServices={activeForm.filteredServices}
            filteredTeams={activeForm.filteredTeams}
            selectedProjectId={activeForm.selectedProjectId}
            selectedServiceId={activeForm.selectedServiceId}
            enableHierarchyEdit={enableActionHierarchyEdit}
            onProjectChange={activeForm.handleProjectChange}
            onServiceChange={activeForm.handleServiceChange}
            form={form}
          />
        )}

        {/* 구분 선택 (생성 모드) */}
        {renderTypeSelection()}

        {/* 공통 필드 */}
        <CommonFormFields
          isEditing={isEditing}
          nameLabel={nameLabel}
          users={users}
          currentType={currentType}
          item={item}
          hideTypeField={hideTypeField}
        />
      </Form>

      {/* 파일 & 링크 섹션 */}
      <Divider />
      <FileAndLinkSection
        item={item}
        currentType={currentType}
        isEditing={isEditing}
        files={files}
        links={links}
        uploading={uploading}
        user={user}
        onFileUpload={handleFileUpload}
        onFileDelete={handleFileDelete}
        onLinkCreate={handleLinkCreate}
        onLinkDelete={handleLinkDelete}
        formatFileSize={formatFileSize}
      />
    </Drawer>
  );
};
