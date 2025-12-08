import React from 'react';
import { Form, Select } from 'antd';
import { Item } from '../../types';

interface ProjectFormSectionProps {
  isEditing: boolean;
  item?: Item | null;
  clients: any[];
  hideClientField?: boolean;
}

export const ProjectFormSection: React.FC<ProjectFormSectionProps> = ({
  isEditing,
  item,
  clients,
  hideClientField = false,
}) => {
  // 고객명 찾기
  const getClientName = () => {
    if (!item?.clientId) return '-';
    const client = clients.find(c => c.id === item.clientId);
    return client?.name || '-';
  };

  return (
    <>
      {/* 고객 선택 */}
      {!hideClientField && (
        <Form.Item name="clientId" label="고객">
          {isEditing ? (
            <Select allowClear size="large">
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
    </>
  );
};
