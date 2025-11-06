import React from 'react';
import { Dropdown, Button, Space, Checkbox } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

interface PstaFilterDropdownProps {
  showMyTasksOnly: boolean;
  hideUnassigned: boolean;
  onShowMyTasksOnlyChange: (checked: boolean) => void;
  onHideUnassignedChange: (checked: boolean) => void;
}

export const PstaFilterDropdown: React.FC<PstaFilterDropdownProps> = ({
  showMyTasksOnly,
  hideUnassigned,
  onShowMyTasksOnlyChange,
  onHideUnassignedChange,
}) => {
  const items: MenuProps['items'] = [
    {
      key: 'myTasks',
      label: (
        <Checkbox
          checked={showMyTasksOnly}
          onChange={(e) => {
            e.stopPropagation();
            onShowMyTasksOnlyChange(e.target.checked);
          }}
          style={{ width: '100%' }}
        >
          내 업무만 보기
        </Checkbox>
      ),
    },
    {
      key: 'hideUnassigned',
      label: (
        <Checkbox
          checked={hideUnassigned}
          onChange={(e) => {
            e.stopPropagation();
            onHideUnassignedChange(e.target.checked);
          }}
          style={{ width: '100%' }}
        >
          미정 항목 숨기기
        </Checkbox>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: 'reset',
      label: '초기화',
      onClick: () => {
        onShowMyTasksOnlyChange(false);
        onHideUnassignedChange(true);
      },
    },
  ];

  // 활성 필터 개수
  const activeFilterCount = [showMyTasksOnly, hideUnassigned].filter(Boolean).length;

  return (
    <Dropdown
      menu={{ items }}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button icon={<FilterOutlined />}>
        <Space size={4}>
          필터
          {activeFilterCount > 0 && (
            <span
              style={{
                backgroundColor: '#1890ff',
                color: '#fff',
                borderRadius: '10px',
                padding: '0 6px',
                fontSize: '12px',
                fontWeight: 'bold',
                minWidth: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </Space>
      </Button>
    </Dropdown>
  );
};
