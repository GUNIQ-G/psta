import React from 'react';
import { Form, Select, Input } from 'antd';
import { Item } from '../../types';

interface ServiceFormSectionProps {
  isEditing: boolean;
  item?: Item | null;
  clients: any[];
  availableProjects: Item[];
  hideClientField?: boolean;
  onClientChange: (clientId: string) => void;
  onProjectChange: (projectId: string) => void;
}

export const ServiceFormSection: React.FC<ServiceFormSectionProps> = ({
  isEditing,
  item,
  clients,
  availableProjects,
  hideClientField = false,
  onClientChange,
  onProjectChange,
}) => {
  // 고객명 찾기
  const getClientName = () => {
    if (!item?.clientId) return '-';
    const client = clients.find(c => c.id === item.clientId);
    return client?.name || '-';
  };

  // 프로젝트명 찾기
  const getProjectName = () => {
    if (!item?.parentId) return '-';
    const project = availableProjects.find(p => p.id === item.parentId);
    // availableProjects에 없으면 item.Item에서 가져오기 (부모 관계)
    return project?.name || (item as any)?.Item?.name || '-';
  };

  return (
    <>
      {/* 고객 선택 (생성 모드 또는 고객이 없을 때만) */}
      {!hideClientField && (!item || !item.clientId) && (
        <Form.Item
          name="clientId"
          label="고객"
          rules={isEditing ? [{ required: true, message: '고객을 선택해주세요' }] : []}
        >
          {isEditing ? (
            <Select
              size="large"
              placeholder="고객을 선택해주세요"
              onChange={onClientChange}
            >
              {clients.map((client) => (
                <Select.Option key={client.id} value={client.id}>
                  {client.name}
                </Select.Option>
              ))}
            </Select>
          ) : (
            <div className="view-field">{getClientName()}</div>
          )}
        </Form.Item>
      )}

      {/* clientId hidden field (수정 모드) */}
      {item && item.clientId && (
        <Form.Item name="clientId" hidden>
          <Input />
        </Form.Item>
      )}

      {/* 프로젝트 선택 */}
      <Form.Item
        name="parentId"
        label="프로젝트"
        rules={isEditing ? [{ required: true, message: '프로젝트를 선택해주세요' }] : []}
      >
        {isEditing ? (
          <Select
            size="large"
            placeholder="프로젝트를 선택해주세요"
            onChange={onProjectChange}
          >
            {availableProjects.map((project) => (
              <Select.Option key={project.id} value={project.id}>
                {project.name}
              </Select.Option>
            ))}
          </Select>
        ) : (
          <div className="view-field">{getProjectName()}</div>
        )}
      </Form.Item>
    </>
  );
};
