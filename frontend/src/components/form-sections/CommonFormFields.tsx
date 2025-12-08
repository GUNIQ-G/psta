import React from 'react';
import { Form, Input, Select, DatePicker, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ItemType, User } from '../../types';
import { useAuthStore } from '../../store/authStore';

interface CommonFormFieldsProps {
  isEditing: boolean;
  nameLabel?: string;
  users: User[];
  currentType?: ItemType;
  item?: any;
  hideTypeField?: boolean;
}

const getTypeInfo = (type: ItemType): { text: string; color: string } => {
  switch (type) {
    case ItemType.PROJECT:
      return { text: '프로젝트', color: '#722ed1' }; // 보라색
    case ItemType.SERVICE:
      return { text: '서비스', color: '#1890ff' }; // 파란색
    case ItemType.TEAM:
      return { text: '팀', color: '#52c41a' }; // 녹색
    case ItemType.ACTION:
      return { text: '액션', color: '#fa8c16' }; // 주황색
    default:
      return { text: type, color: '#d9d9d9' };
  }
};

export const CommonFormFields: React.FC<CommonFormFieldsProps> = ({
  isEditing,
  nameLabel = '업무명',
  users,
  currentType,
  item,
  hideTypeField = false,
}) => {
  const user = useAuthStore((state) => state.user);

  // 담당자 이름 찾기
  const getAssigneeName = () => {
    if (!item?.assigneeId) return '-';
    const assignee = users.find(u => u.id === item.assigneeId);
    return assignee ? `${assignee.displayName} (${assignee.username})` : '-';
  };

  // 일정 포맷팅
  const formatDateRange = () => {
    if (!item?.startDate && !item?.endDate) return '-';
    const start = item?.startDate ? dayjs(item.startDate).format('YYYY-MM-DD') : '미정';
    const end = item?.endDate ? dayjs(item.endDate).format('YYYY-MM-DD') : '미정';
    return `${start}  →  ${end}`;
  };

  return (
    <>
      {/* 업무명 */}
      <Form.Item
        name="name"
        label={
          <Space size={8}>
            <span>{nameLabel}</span>
            {!hideTypeField && (
              <>
                {item ? (
                  <Tag
                    color={getTypeInfo(currentType || item.type).color}
                    style={{
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {getTypeInfo(currentType || item.type).text}
                  </Tag>
                ) : (
                  <Tag
                    color="#d9d9d9"
                    style={{
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    구분 선택 필요
                  </Tag>
                )}
              </>
            )}
          </Space>
        }
        rules={isEditing ? [{ required: true, message: `${nameLabel}을 입력해주세요` }] : []}
      >
        {isEditing ? (
          <Input size="large" />
        ) : (
          <div className="view-field">{item?.name || '-'}</div>
        )}
      </Form.Item>

      {/* 일정 (시작일 + 종료일) */}
      <Form.Item label="일정">
        {isEditing ? (
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="startDate" noStyle>
              <DatePicker placeholder="시작일" style={{ width: '50%' }} size="large" />
            </Form.Item>
            <Form.Item name="endDate" noStyle>
              <DatePicker placeholder="종료일" style={{ width: '50%' }} size="large" />
            </Form.Item>
          </Space.Compact>
        ) : (
          <div className="view-field">{formatDateRange()}</div>
        )}
      </Form.Item>

      {/* 설명 */}
      <Form.Item name="description" label="설명">
        {isEditing ? (
          <Input.TextArea rows={4} />
        ) : (
          <div className="view-field view-field-multiline">
            {item?.description || '-'}
          </div>
        )}
      </Form.Item>

      {/* 담당자 */}
      <Form.Item name="assigneeId" label="담당자">
        {isEditing ? (
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            size="large"
            disabled={
              // ACTION 수정 모드일 때만 권한 체크
              item &&
              currentType === ItemType.ACTION &&
              (() => {
                // 담당자 본인인지 확인
                const isAssignee = item.assigneeId === user?.id;
                // PM 이상 역할인지 확인 (ADMIN, PO, PM)
                const isPMOrAbove = user?.role === 'ADMIN' || user?.role === 'PO' || user?.role === 'PM';
                // 담당자 본인이거나 PM 이상이면 수정 가능 (disabled = false)
                // 그 외에는 수정 불가 (disabled = true)
                return !isAssignee && !isPMOrAbove;
              })()
            }
          >
            {users.map((u) => (
              <Select.Option key={u.id} value={u.id}>
                {u.displayName} ({u.username})
              </Select.Option>
            ))}
          </Select>
        ) : (
          <div className="view-field">{getAssigneeName()}</div>
        )}
      </Form.Item>

      {/* hidden type field */}
      {item && (
        <Form.Item name="type" hidden>
          <Input />
        </Form.Item>
      )}

      {hideTypeField && (
        <Form.Item name="type" hidden>
          <Input />
        </Form.Item>
      )}
    </>
  );
};
