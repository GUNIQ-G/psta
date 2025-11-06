import React, { useState, useEffect } from 'react';
// @ts-ignore
import { Gantt, Task, ViewMode } from 'gantt-task-react';
// @ts-ignore
import 'gantt-task-react/dist/index.css';
import { Select, Spin, Button, Space } from 'antd';
import dayjs from 'dayjs';
import { Item, ItemType, ItemStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';

// Type color mapping
const TYPE_COLORS: Record<ItemType, string> = {
  PROJECT: '#722ed1',  // purple
  SERVICE: '#1890ff',  // blue
  TEAM: '#52c41a',     // green
  ACTION: '#fa8c16',   // orange
};

// Status styles mapping
const getStatusStyles = (status: ItemStatus) => {
  switch (status) {
    case ItemStatus.COMPLETED:
      return { progressColor: '#52c41a', progressSelectedColor: '#73d13d' };
    case ItemStatus.IN_PROGRESS:
      return { progressColor: '#1890ff', progressSelectedColor: '#40a9ff' };
    case ItemStatus.ON_HOLD:
      return { progressColor: '#d9d9d9', progressSelectedColor: '#bfbfbf' };
    case ItemStatus.NOT_STARTED:
      return { progressColor: '#f5f5f5', progressSelectedColor: '#e8e8e8' };
    default:
      return { progressColor: '#1890ff', progressSelectedColor: '#40a9ff' };
  }
};

// Convert Item to Gantt Task
const itemToTask = (item: Item, allItems: Item[]): Task => {
  const start = item.startDate ? dayjs(item.startDate).toDate() : dayjs().toDate();
  const end = item.endDate ? dayjs(item.endDate).toDate() : dayjs().add(7, 'day').toDate();

  const statusStyles = getStatusStyles(item.status);
  const typeColor = TYPE_COLORS[item.type];

  // Check if this item has children
  const hasChildren = allItems.some(i => i.parentId === item.id);

  return {
    id: item.id,
    name: item.name,
    start,
    end,
    progress: item.progress || 0,
    type: hasChildren ? 'project' : 'task',
    dependencies: item.parentId ? [item.parentId] : [],
    project: item.parentId || undefined,
    styles: {
      ...statusStyles,
      backgroundColor: typeColor,
      backgroundSelectedColor: typeColor,
    },
    isDisabled: false,
    hideChildren: false,
  };
};

// Recursively build tree structure
const buildTaskTree = (items: Item[], parentId: string | null = null): Task[] => {
  const tasks: Task[] = [];

  const children = items.filter(item => item.parentId === parentId);

  children.forEach(item => {
    tasks.push(itemToTask(item, items));
    const childTasks = buildTaskTree(items, item.id);
    tasks.push(...childTasks);
  });

  return tasks;
};

export const WbsGantt: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchItems();
    }
  }, [selectedClientId]);

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getClients();
      setClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await itemsApi.getItemsTree(selectedClientId);
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build Gantt tasks from items
  const tasks: Task[] = items.length > 0 ? buildTaskTree(items, null) : [];

  const handleTaskChange = (task: Task) => {
    console.log('Task changed:', task);
    // TODO: Update item via API
  };

  const handleTaskDelete = (task: Task) => {
    console.log('Task deleted:', task);
    // TODO: Delete item via API
  };

  const handleProgressChange = async (task: Task) => {
    console.log('Progress changed:', task);
    // TODO: Update progress via API
  };

  const handleExpanderClick = (task: Task) => {
    console.log('Expander clicked:', task);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
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

          <Select
            style={{ width: 120 }}
            value={viewMode}
            onChange={setViewMode}
          >
            <Select.Option value={ViewMode.Hour}>시간</Select.Option>
            <Select.Option value={ViewMode.QuarterDay}>6시간</Select.Option>
            <Select.Option value={ViewMode.HalfDay}>반일</Select.Option>
            <Select.Option value={ViewMode.Day}>일</Select.Option>
            <Select.Option value={ViewMode.Week}>주</Select.Option>
            <Select.Option value={ViewMode.Month}>월</Select.Option>
          </Select>
        </Space>

        <Button onClick={fetchItems}>새로고침</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : tasks.length > 0 ? (
        <div style={{ overflow: 'auto' }}>
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            locale="ko"
            listCellWidth="200px"
            columnWidth={viewMode === ViewMode.Month ? 80 : 60}
            onDateChange={handleTaskChange}
            onDelete={handleTaskDelete}
            onProgressChange={handleProgressChange}
            onExpanderClick={handleExpanderClick}
            ganttHeight={600}
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
          {selectedClientId ? '데이터가 없습니다.' : '고객을 선택해주세요.'}
        </div>
      )}
    </div>
  );
};
