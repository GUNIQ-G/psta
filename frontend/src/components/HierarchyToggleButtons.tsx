import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import { ItemType } from '../types';

interface HierarchyToggleButtonsProps {
  expandedTypes: Set<ItemType>;
  onToggle: (type: ItemType) => void;
}

export const HierarchyToggleButtons: React.FC<HierarchyToggleButtonsProps> = ({
  expandedTypes,
  onToggle,
}) => {
  const hierarchyConfig = [
    {
      type: ItemType.PROJECT,
      label: 'P',
      tooltip: '프로젝트',
      color: '#722ed1',
    },
    {
      type: ItemType.SERVICE,
      label: 'S',
      tooltip: '서비스',
      color: '#1890ff',
    },
    {
      type: ItemType.TEAM,
      label: 'T',
      tooltip: '팀',
      color: '#52c41a',
    },
    {
      type: ItemType.ACTION,
      label: 'A',
      tooltip: '액션',
      color: '#fa8c16',
    },
  ];

  return (
    <Space size={0}>
      {hierarchyConfig.map((config, index) => {
        const isExpanded = expandedTypes.has(config.type);

        return (
          <Tooltip key={config.type} title={`${config.tooltip}까지만 보기`}>
            <Button
              size="small"
              onClick={() => onToggle(config.type)}
              style={{
                backgroundColor: isExpanded ? config.color : '#fff',
                color: isExpanded ? '#fff' : '#595959',
                borderColor: config.color,
                borderLeft: index === 0 ? `1px solid ${config.color}` : 'none',
                borderRight: `1px solid ${config.color}`,
                borderTop: `1px solid ${config.color}`,
                borderBottom: `1px solid ${config.color}`,
                borderRadius: index === 0 ? '6px 0 0 6px' : index === hierarchyConfig.length - 1 ? '0 6px 6px 0' : '0',
                fontWeight: 600,
                fontSize: '11px',
                height: '24px',
                minWidth: '24px',
                padding: '0 6px',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                if (!isExpanded) {
                  e.currentTarget.style.backgroundColor = config.color;
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isExpanded) {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.color = '#595959';
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {config.label}
            </Button>
          </Tooltip>
        );
      })}
    </Space>
  );
};
