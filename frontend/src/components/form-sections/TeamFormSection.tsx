import React from 'react';
import { Form, Select } from 'antd';
import { Item } from '../../types';

interface TeamFormSectionProps {
  isEditing: boolean;
  item?: Item | null;
  clients: any[];
  hideClientField?: boolean;
}

export const TeamFormSection: React.FC<TeamFormSectionProps> = ({
  isEditing,
  item,
  clients,
  hideClientField = false,
}) => {
  return (
    <>
      {/* 고객 선택 */}
      {!hideClientField && (
        <Form.Item name="clientId" label="고객">
          <Select allowClear size="large" disabled={!isEditing}>
            {clients.map((client) => (
              <Select.Option key={client.id} value={client.id}>
                {client.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}
    </>
  );
};
