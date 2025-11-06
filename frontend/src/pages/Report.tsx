import React, { useState, useEffect } from 'react';
import { Typography, Select, Button, Space, Card, Statistic, Progress, Tag, DatePicker, Table, Empty, message, Modal, List, Dropdown, Row, Col, Divider, Input, Form } from 'antd';
import { PrinterOutlined, CameraOutlined, HistoryOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, TeamOutlined, DeleteOutlined, EyeOutlined, ArrowUpOutlined, ArrowDownOutlined, SettingOutlined, FileTextOutlined, RiseOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { Item, ItemStatus, ItemType } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { reportSnapshotsApi, ReportSnapshot } from '../api/report-snapshots';
import type { ColumnType } from 'antd/es/table';
import { useAuthStore } from '../store/authStore';

dayjs.extend(isoWeek);

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<ItemStatus, string> = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  ON_HOLD: 'warning',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
};

const TYPE_COLORS: Record<ItemType, string> = {
  PROJECT: '#722ed1',
  SERVICE: '#1890ff',
  TEAM: '#52c41a',
  ACTION: '#fa8c16',
};

const TYPE_LABELS: Record<ItemType, string> = {
  PROJECT: 'P',
  SERVICE: 'S',
  TEAM: 'T',
  ACTION: 'A',
};

export const Report: React.FC = () => {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>();
  const [selectedClient, setSelectedClient] = useState<any>();
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs().add(7, 'day')
  ]);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<ReportSnapshot | null>(null);
  const [snapshotDetailModalOpen, setSnapshotDetailModalOpen] = useState(false);
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false);
  const [createSnapshotModalOpen, setCreateSnapshotModalOpen] = useState(false);
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchItems();
      const client = clients.find(c => c.id === selectedClientId);
      setSelectedClient(client);
    }
  }, [selectedClientId, dateRange]);

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getClients();
      setClients(data);
      if (data.length > 0) {
        setSelectedClientId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await itemsApi.getItemTree(selectedClientId);
      const flatItems = flattenItems(data);
      setAllItems(flatItems);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const flattenItems = (items: Item[]): Item[] => {
    const result: Item[] = [];
    items.forEach(item => {
      result.push(item);
      if (item.children && item.children.length > 0) {
        result.push(...flattenItems(item.children));
      }
    });
    return result;
  };

  // Filter items by date range (for display - PROJECT and SERVICE only)
  const itemsInRange = allItems.filter(item => {
    // Only include PROJECT and SERVICE for list display
    if (item.type !== ItemType.PROJECT && item.type !== ItemType.SERVICE) {
      return false;
    }

    const itemStart = item.startDate ? dayjs(item.startDate) : null;
    const itemEnd = item.endDate ? dayjs(item.endDate) : null;
    const [rangeStart, rangeEnd] = dateRange;

    if (!itemStart && !itemEnd) return false;

    // Check if item period overlaps with selected range
    if (itemStart && itemEnd) {
      return itemStart.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
    } else if (itemStart) {
      return itemStart.isBefore(rangeEnd) && itemStart.isAfter(rangeStart);
    } else if (itemEnd) {
      return itemEnd.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
    }

    return false;
  });

  // Filter ACTION items for statistics
  const actionsInRange = allItems.filter(item => {
    // Only include ACTION type for statistics
    if (item.type !== ItemType.ACTION) {
      return false;
    }

    const itemStart = item.startDate ? dayjs(item.startDate) : null;
    const itemEnd = item.endDate ? dayjs(item.endDate) : null;
    const [rangeStart, rangeEnd] = dateRange;

    if (!itemStart && !itemEnd) return false;

    // Check if item period overlaps with selected range
    if (itemStart && itemEnd) {
      return itemStart.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
    } else if (itemStart) {
      return itemStart.isBefore(rangeEnd) && itemStart.isAfter(rangeStart);
    } else if (itemEnd) {
      return itemEnd.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
    }

    return false;
  });

  // Calculate statistics based on ACTION items only
  const totalItems = actionsInRange.length;
  const completedItems = actionsInRange.filter(i => i.status === ItemStatus.COMPLETED);
  const inProgressItems = actionsInRange.filter(i => i.status === ItemStatus.IN_PROGRESS);
  const notStartedItems = actionsInRange.filter(i => i.status === ItemStatus.NOT_STARTED);
  const onHoldItems = actionsInRange.filter(i => i.status === ItemStatus.ON_HOLD);
  const totalProgress = totalItems > 0
    ? Math.round(actionsInRange.reduce((sum, item) => sum + item.progress, 0) / totalItems)
    : 0;

  // Group ACTIONs by project
  const projectGroups = actionsInRange.reduce((acc, item) => {
    let projectName = '';
    // Find parent project for ACTION items
    let currentItem = item;
    while (currentItem.parentId) {
      const parent = allItems.find(i => i.id === currentItem.parentId);
      if (!parent) break;
      if (parent.type === ItemType.PROJECT) {
        projectName = parent.name;
        break;
      }
      currentItem = parent;
    }
    projectName = projectName || '기타';

    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  const handlePrint = () => {
    window.print();
  };

  // 기본 스냅샷 제목 생성 함수
  const generateDefaultSnapshotTitle = (): string => {
    const startDate = dateRange[0];
    const month = startDate.month() + 1; // 0-indexed
    const weekOfMonth = Math.ceil(startDate.date() / 7);

    // N째주를 한글로 변환
    const weekLabels = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
    const weekLabel = weekLabels[weekOfMonth - 1] || `${weekOfMonth}째`;

    return `${month}월 ${weekLabel}주 보고서`;
  };

  // 스냅샷 생성 모달 열기
  const handleOpenCreateSnapshotModal = () => {
    if (!selectedClientId || !selectedClient) {
      message.error('고객을 선택해주세요');
      return;
    }

    if (itemsInRange.length === 0) {
      message.error('저장할 데이터가 없습니다');
      return;
    }

    // 기본 제목 생성
    const defaultTitle = generateDefaultSnapshotTitle();
    form.setFieldsValue({ title: defaultTitle });
    setSnapshotTitle(defaultTitle);
    setCreateSnapshotModalOpen(true);
  };

  // 스냅샷 생성 실행
  const handleCreateSnapshot = async () => {
    try {
      await form.validateFields();

      // Get all ACTIONs in date range
      const actionsInDateRange = allItems.filter(item => {
        if (item.type !== ItemType.ACTION) return false;

        const itemStart = item.startDate ? dayjs(item.startDate) : null;
        const itemEnd = item.endDate ? dayjs(item.endDate) : null;
        const [rangeStart, rangeEnd] = dateRange;

        if (!itemStart && !itemEnd) return false;

        // Check if item period overlaps with selected range
        if (itemStart && itemEnd) {
          return itemStart.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
        } else if (itemStart) {
          return itemStart.isBefore(rangeEnd) && itemStart.isAfter(rangeStart);
        } else if (itemEnd) {
          return itemEnd.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
        }

        return false;
      });

      // Collect all parent items (PROJECT, SERVICE, TEAM) of actions in range
      const parentIds = new Set<string>();
      actionsInDateRange.forEach(action => {
        let currentItem = action;
        while (currentItem.parentId) {
          parentIds.add(currentItem.parentId);
          const parent = allItems.find(i => i.id === currentItem.parentId);
          if (!parent) break;
          currentItem = parent;
        }
      });

      // Include all parents + actions in snapshot
      const snapshotItems = allItems.filter(item =>
        parentIds.has(item.id) || actionsInDateRange.some(a => a.id === item.id)
      );

      console.log('=== 스냅샷 생성 데이터 ===');
      console.log('Actions in range:', actionsInDateRange.length);
      console.log('Total snapshot items:', snapshotItems.length);
      console.log('By type:', {
        PROJECT: snapshotItems.filter(i => i.type === ItemType.PROJECT).length,
        SERVICE: snapshotItems.filter(i => i.type === ItemType.SERVICE).length,
        TEAM: snapshotItems.filter(i => i.type === ItemType.TEAM).length,
        ACTION: snapshotItems.filter(i => i.type === ItemType.ACTION).length,
      });

      await reportSnapshotsApi.createSnapshot({
        title: snapshotTitle,
        clientId: selectedClientId,
        clientName: selectedClient.name,
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        data: snapshotItems,
        statistics: {
          total: totalItems,
          completed: completedItems.length,
          inProgress: inProgressItems.length,
          notStarted: notStartedItems.length,
          onHold: onHoldItems.length,
          averageProgress: totalProgress,
        },
      });

      message.success('스냅샷이 생성되었습니다');
      setCreateSnapshotModalOpen(false);
      form.resetFields();
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        return;
      }
      message.error('스냅샷 생성 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleViewSnapshots = async () => {
    if (!selectedClientId) {
      message.error('고객을 선택해주세요');
      return;
    }

    setLoadingSnapshots(true);
    try {
      const data = await reportSnapshotsApi.getSnapshots(selectedClientId);
      setSnapshots(data);
      setSnapshotPanelOpen(!snapshotPanelOpen);
    } catch (error: any) {
      message.error('스냅샷 목록 조회 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    try {
      await reportSnapshotsApi.deleteSnapshot(id);
      message.success('스냅샷이 삭제되었습니다');
      // Refresh list
      const data = await reportSnapshotsApi.getSnapshots(selectedClientId);
      setSnapshots(data);
    } catch (error: any) {
      message.error('스냅샷 삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleViewSnapshot = async (snapshot: ReportSnapshot) => {
    setViewingSnapshot(snapshot);
    setSnapshotDetailModalOpen(true);
  };

  const columns: ColumnType<Item>[] = [
    {
      title: '업무명',
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: false },
      render: (name: string, record: Item) => {
        // Count children in allItems
        const childrenCount = allItems.filter(item => item.parentId === record.id).length;

        return (
          <Space size="small" style={{ maxWidth: '100%' }}>
            <Tag color={TYPE_COLORS[record.type]} style={{ fontWeight: 600, flexShrink: 0 }}>
              {TYPE_LABELS[record.type]}
            </Tag>
            <Text ellipsis={{ tooltip: name }} style={{ flex: 1 }}>
              {name}
              {childrenCount > 0 && (
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  ({childrenCount})
                </Text>
              )}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ItemStatus) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 160,
      render: (_, record: Item) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.startDate ? dayjs(record.startDate).format('YY.MM.DD') : '-'} ~ {record.endDate ? dayjs(record.endDate).format('YY.MM.DD') : '-'}
        </Text>
      ),
    },
    {
      title: '진행률',
      dataIndex: 'progress',
      key: 'progress',
      width: 80,
      align: 'center',
      render: (progress: number) => (
        <Progress
          type="circle"
          percent={progress}
          size={50}
          strokeWidth={8}
          format={(percent) => (
            <span style={{ fontSize: 11, fontWeight: 600 }}>{percent}%</span>
          )}
        />
      ),
    },
  ];

  // Date preset buttons
  const datePresets = [
    { label: '이번 주', days: 7 },
    { label: '이번 달', days: 30 },
    { label: '이번 분기', days: 90 },
  ];

  return (
    <div className="report-page" style={{ background: 'white', minHeight: '100vh' }}>
      {/* Header */}
      <div
        style={{
          background: '#1e3a5f',
          borderBottom: '4px solid #4a90e2',
          padding: '24px 48px',
          marginBottom: 0,
        }}
      >
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Row align="middle" justify="space-between">
            {/* Left: Title & Controls */}
            <Col>
              <Space size="middle" align="center">
                {selectedClient?.logoUrl && (
                  <img
                    src={selectedClient.logoUrl}
                    alt={selectedClient.name}
                    style={{
                      width: 50,
                      height: 50,
                      objectFit: 'contain',
                      background: 'white',
                      padding: 6,
                      borderRadius: 4,
                    }}
                  />
                )}
                <div>
                  <Title level={4} style={{ color: 'white', margin: 0, marginBottom: 8, fontWeight: 600 }}>
                    업무 현황 보고서
                  </Title>
                  <Space size="middle">
                    <Select
                      value={selectedClientId}
                      onChange={setSelectedClientId}
                      style={{ width: 180 }}
                      options={clients.map(c => ({ label: c.name, value: c.id }))}
                    />
                    <RangePicker
                      value={dateRange}
                      onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
                      format="YYYY-MM-DD"
                    />
                  </Space>
                </div>
              </Space>
            </Col>

            {/* Right: Date & Actions */}
            <Col>
              <Space direction="vertical" align="end" size={4}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                  {dateRange[0].format('YYYY.MM.DD')} - {dateRange[1].format('MM.DD')}
                </Text>
                <Space size="small">
                  <Button
                    icon={<CameraOutlined />}
                    onClick={handleOpenCreateSnapshotModal}
                    disabled={!selectedClientId || itemsInRange.length === 0}
                    style={{ background: '#4a90e2', borderColor: '#4a90e2', color: 'white' }}
                  >
                    스냅샷
                  </Button>
                  <Button
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    style={{ background: '#4a90e2', borderColor: '#4a90e2', color: 'white' }}
                  >
                    인쇄
                  </Button>
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={handleViewSnapshots}
                    disabled={!selectedClientId}
                    style={{
                      background: snapshotPanelOpen ? '#d9d9d9' : 'white',
                      borderColor: snapshotPanelOpen ? '#d9d9d9' : 'white',
                      color: snapshotPanelOpen ? '#595959' : '#1e3a5f'
                    }}
                  >
                    {snapshotPanelOpen ? '닫기' : '기록'}
                  </Button>
                </Space>
              </Space>
            </Col>
          </Row>
        </div>
      </div>

      {/* Snapshot Panel */}
      {snapshotPanelOpen && (
        <div
          style={{
            background: '#f8f9fa',
            padding: '24px 48px',
            borderBottom: '1px solid #dee2e6',
          }}
        >
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0, color: '#1e3a5f', fontWeight: 600 }}>
                <HistoryOutlined style={{ marginRight: 8 }} />
                스냅샷 기록
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                총 {snapshots.length}개
              </Text>
            </div>

            {loadingSnapshots ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Text type="secondary">로딩중...</Text>
              </div>
            ) : snapshots.length === 0 ? (
              <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 0' }}>
                <Empty description="저장된 스냅샷이 없습니다" />
              </Card>
            ) : (
              <Table
                dataSource={snapshots}
                rowKey="id"
                pagination={false}
                style={{ background: 'white', borderRadius: 16 }}
                columns={[
                  {
                    title: '제목',
                    dataIndex: 'title',
                    key: 'title',
                    render: (title: string, record: ReportSnapshot) => (
                      <Space>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 4,
                            background: '#1e3a5f',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                          }}
                        >
                          <CameraOutlined style={{ fontSize: 16 }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
                          </Text>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    title: '보고 기간',
                    dataIndex: 'startDate',
                    key: 'period',
                    width: 200,
                    render: (_, record: ReportSnapshot) => (
                      <Text>
                        {dayjs(record.startDate).format('YYYY-MM-DD')} ~ {dayjs(record.endDate).format('MM-DD')}
                      </Text>
                    ),
                  },
                  {
                    title: '프로젝트',
                    key: 'projects',
                    width: 100,
                    align: 'center',
                    render: (_, record: ReportSnapshot) => {
                      // Count unique projects
                      const projectCount = [...new Set(record.data.map((item: any) => item.projectName))].length;
                      return (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#722ed1' }}>
                            {projectCount}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>개</Text>
                        </div>
                      );
                    },
                  },
                  {
                    title: '전체 업무',
                    key: 'total',
                    width: 100,
                    align: 'center',
                    render: (_, record: ReportSnapshot) => (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>
                          {record.statistics.total}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>건</Text>
                      </div>
                    ),
                  },
                  {
                    title: '완료',
                    key: 'completed',
                    width: 100,
                    align: 'center',
                    render: (_, record: ReportSnapshot) => (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>
                          {record.statistics.completed}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>건</Text>
                      </div>
                    ),
                  },
                  {
                    title: '진행률',
                    key: 'progress',
                    width: 150,
                    render: (_, record: ReportSnapshot) => (
                      <Progress
                        percent={record.statistics.averageProgress}
                        strokeColor="#1890ff"
                        size="small"
                      />
                    ),
                  },
                  {
                    title: '생성자',
                    dataIndex: ['CreatedBy', 'displayName'],
                    key: 'creator',
                    width: 100,
                  },
                  {
                    title: '작업',
                    key: 'actions',
                    width: 120,
                    align: 'center',
                    render: (_, record: ReportSnapshot) => (
                      <Space>
                        <Button
                          type="primary"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => handleViewSnapshot(record)}
                        >
                          보기
                        </Button>
                        {(user?.role === 'ADMIN' || record.createdById === user?.id) && (
                          <Button
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              Modal.confirm({
                                title: '스냅샷 삭제',
                                content: '이 스냅샷을 삭제하시겠습니까?',
                                okText: '삭제',
                                cancelText: '취소',
                                okButtonProps: { danger: true },
                                onOk: () => handleDeleteSnapshot(record.id),
                              });
                            }}
                          />
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0' }}>
        {/* Statistics Cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 24, marginTop: 24 }}>
          <Col span={6}>
            <Card
              styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              style={{
                background: 'white',
                border: '1px solid #dee2e6',
                borderTop: '3px solid #1e3a5f',
                borderRadius: 0,
              }}
            >
              <Statistic
                title={<span style={{ color: '#6c757d', fontSize: 13 }}>전체 업무</span>}
                value={totalItems}
                suffix="건"
                valueStyle={{ color: '#1e3a5f', fontSize: 32, fontWeight: 700 }}
              />
            </Card>
          </Col>

          <Col span={6}>
            <Card
              styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              style={{
                background: 'white',
                border: '1px solid #dee2e6',
                borderTop: '3px solid #52c41a',
                borderRadius: 0,
              }}
            >
              <Statistic
                title={<span style={{ color: '#6c757d', fontSize: 13 }}>완료</span>}
                value={completedItems.length}
                suffix="건"
                valueStyle={{ color: '#52c41a', fontSize: 32, fontWeight: 700 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                완료율 {totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 0}%
              </Text>
            </Card>
          </Col>

          <Col span={6}>
            <Card
              styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              style={{
                background: 'white',
                border: '1px solid #dee2e6',
                borderTop: '3px solid #1890ff',
                borderRadius: 0,
              }}
            >
              <Statistic
                title={<span style={{ color: '#6c757d', fontSize: 13 }}>진행중</span>}
                value={inProgressItems.length}
                suffix="건"
                valueStyle={{ color: '#1890ff', fontSize: 32, fontWeight: 700 }}
              />
            </Card>
          </Col>

          <Col span={6}>
            <Card
              styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              style={{
                background: 'white',
                border: '1px solid #dee2e6',
                borderTop: '3px solid #e74c3c',
                borderRadius: 0,
              }}
            >
              <Statistic
                title={<span style={{ color: '#6c757d', fontSize: 13 }}>평균 진행률</span>}
                value={totalProgress}
                suffix="%"
                valueStyle={{ color: '#e74c3c', fontSize: 32, fontWeight: 700 }}
              />
              <Progress
                percent={totalProgress}
                strokeColor="#e74c3c"
                trailColor="#f0f0f0"
                showInfo={false}
                style={{ marginTop: 8 }}
                size="small"
              />
            </Card>
          </Col>
        </Row>

        {/* Project Progress Cards */}
        <div style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 12, color: '#1e3a5f', fontWeight: 600 }}>
            프로젝트별 진행 현황
          </Title>

          {Object.keys(projectGroups).length > 0 ? (
            <Row gutter={[12, 12]}>
              {Object.entries(projectGroups).map(([projectName, actionItems], index) => {
                // actionItems contains ACTIONs for statistics
                // Get SERVICE and ACTION items for display (exclude PROJECT)
                const displayItems = allItems.filter(item => {
                  // Only include SERVICE and ACTION types
                  if (item.type !== ItemType.SERVICE && item.type !== ItemType.ACTION) {
                    return false;
                  }

                  // Find project name for this item
                  let itemProjectName = '';
                  let currentItem = item;
                  while (currentItem.parentId) {
                    const parent = allItems.find(i => i.id === currentItem.parentId);
                    if (!parent) break;
                    if (parent.type === ItemType.PROJECT) {
                      itemProjectName = parent.name;
                      break;
                    }
                    currentItem = parent;
                  }
                  return itemProjectName === projectName;
                }).filter(item => {
                  // Check if item is in date range
                  const itemStart = item.startDate ? dayjs(item.startDate) : null;
                  const itemEnd = item.endDate ? dayjs(item.endDate) : null;
                  const [rangeStart, rangeEnd] = dateRange;

                  if (!itemStart && !itemEnd) return false;

                  if (itemStart && itemEnd) {
                    return itemStart.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
                  } else if (itemStart) {
                    return itemStart.isBefore(rangeEnd) && itemStart.isAfter(rangeStart);
                  } else if (itemEnd) {
                    return itemEnd.isBefore(rangeEnd) && itemEnd.isAfter(rangeStart);
                  }

                  return false;
                });

                // Build hierarchy: SERVICE items with their ACTION children
                const serviceMap = new Map<string, { service: Item; actions: Item[] }>();

                displayItems.forEach(item => {
                  if (item.type === ItemType.SERVICE) {
                    if (!serviceMap.has(item.id)) {
                      serviceMap.set(item.id, { service: item, actions: [] });
                    }
                  } else if (item.type === ItemType.ACTION) {
                    // Find parent service or team, then service
                    let currentItem = item;
                    let serviceId: string | null = null;

                    while (currentItem.parentId) {
                      const parent = allItems.find(i => i.id === currentItem.parentId);
                      if (!parent) break;
                      if (parent.type === ItemType.SERVICE) {
                        serviceId = parent.id;
                        break;
                      }
                      currentItem = parent;
                    }

                    if (serviceId && serviceMap.has(serviceId)) {
                      serviceMap.get(serviceId)!.actions.push(item);
                    }
                  }
                });

                // Build table data with hierarchy
                const tableData: any[] = [];
                serviceMap.forEach(({ service, actions }) => {
                  tableData.push(service);
                  actions.forEach(action => {
                    tableData.push(action);
                  });
                });

                // Custom columns for project card table
                const projectCardColumns: ColumnType<Item>[] = [
                  {
                    title: '업무명',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name: string, record: Item) => {
                      // Find team name for ACTION items
                      let teamName = '';
                      if (record.type === ItemType.ACTION) {
                        let currentItem = record;
                        while (currentItem.parentId) {
                          const parent = allItems.find(i => i.id === currentItem.parentId);
                          if (!parent) break;
                          if (parent.type === ItemType.TEAM) {
                            teamName = parent.name;
                            break;
                          }
                          currentItem = parent;
                        }
                      }

                      const childrenCount = allItems.filter(item => item.parentId === record.id).length;
                      const indent = record.type === ItemType.ACTION ? 24 : 0;

                      const backgroundColor = record.type === ItemType.ACTION ? '#fafafa' : 'transparent';

                      return (
                        <div style={{ paddingLeft: indent, backgroundColor, margin: '-8px -16px', padding: '8px 16px' }}>
                          <div style={{ marginBottom: 4 }}>
                            <Space size={4}>
                              {record.type === ItemType.ACTION && (
                                <span style={{ color: '#bfbfbf', fontSize: 12, marginRight: 4 }}>└</span>
                              )}
                              <Tag color={TYPE_COLORS[record.type]} style={{ fontWeight: 600, flexShrink: 0 }}>
                                {TYPE_LABELS[record.type]}
                              </Tag>
                              <span>
                                {name}
                                {childrenCount > 0 && (
                                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                    ({childrenCount})
                                  </Text>
                                )}
                              </span>
                            </Space>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                              {teamName && (
                                <Tag style={{ margin: 0, backgroundColor: '#f0f0f0', color: '#666', border: '1px solid #d9d9d9' }}>
                                  {teamName}
                                </Tag>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Tag color={STATUS_COLORS[record.status]} style={{ margin: 0 }}>
                                {STATUS_LABELS[record.status]}
                              </Tag>
                              <div style={{ width: 100 }}>
                                <Progress
                                  percent={record.progress}
                                  strokeColor="#1890ff"
                                  trailColor="#f0f0f0"
                                  size="small"
                                  format={(percent) => `${percent}%`}
                                />
                              </div>
                              <Text type="secondary" style={{ fontSize: 11, width: 130, textAlign: 'right' }}>
                                {record.startDate ? dayjs(record.startDate).format('YY.MM.DD') : '-'} ~ {record.endDate ? dayjs(record.endDate).format('YY.MM.DD') : '-'}
                              </Text>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  },
                ];

                // Statistics based on ACTION items
                const projectCompleted = actionItems.filter(i => i.status === ItemStatus.COMPLETED).length;
                const projectProgress = actionItems.length > 0
                  ? Math.round(actionItems.reduce((sum, item) => sum + item.progress, 0) / actionItems.length)
                  : 0;

                return (
                  <Col span={12} key={projectName}>
                    <Card
                      styles={{ body: { padding: '16px' } }}
                      style={{
                        borderRadius: 0,
                        border: '1px solid #dee2e6',
                        borderLeft: `4px solid #1e3a5f`,
                      }}
                    >
                      {/* Card Header */}
                      <div style={{ marginBottom: 12 }}>
                        <Row gutter={16} align="middle">
                          <Col flex="1">
                            <Title level={5} style={{ margin: 0, marginBottom: 4, color: '#1e3a5f' }}>
                              {projectName}
                            </Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              총 {actionItems.length}건 · 완료 {projectCompleted}건 · 진행률 {projectProgress}%
                            </Text>
                          </Col>
                          <Col>
                            <Progress
                              type="circle"
                              percent={projectProgress}
                              strokeColor="#e74c3c"
                              trailColor="#f0f0f0"
                              size={60}
                              strokeWidth={6}
                              format={(percent) => (
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>
                                  {percent}%
                                </span>
                              )}
                            />
                          </Col>
                        </Row>
                      </div>

                      {/* Status Breakdown - Based on ACTION items */}
                      <Row gutter={8}>
                        <Col span={8}>
                          <div style={{ textAlign: 'center', padding: '8px 0', background: '#f5f5f5', borderRadius: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>
                              {actionItems.filter(i => i.status === ItemStatus.COMPLETED).length}
                            </div>
                            <Text type="secondary" style={{ fontSize: 11 }}>완료</Text>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ textAlign: 'center', padding: '8px 0', background: '#f5f5f5', borderRadius: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
                              {actionItems.filter(i => i.status === ItemStatus.IN_PROGRESS).length}
                            </div>
                            <Text type="secondary" style={{ fontSize: 11 }}>진행중</Text>
                          </div>
                        </Col>
                        <Col span={8}>
                          <div style={{ textAlign: 'center', padding: '8px 0', background: '#f5f5f5', borderRadius: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#d9d9d9' }}>
                              {actionItems.filter(i => i.status === ItemStatus.NOT_STARTED).length}
                            </div>
                            <Text type="secondary" style={{ fontSize: 11 }}>시작전</Text>
                          </div>
                        </Col>
                      </Row>

                      {/* Detailed Table */}
                      <Divider style={{ margin: '16px 0' }} />
                      <Table
                        dataSource={tableData}
                        columns={projectCardColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        showHeader={false}
                        expandable={{
                          defaultExpandAllRows: false,
                          expandRowByClick: false,
                          showExpandColumn: false,
                        }}
                      />
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Card style={{ borderRadius: 16 }}>
              <Empty description="선택한 기간에 해당하는 데이터가 없습니다" />
            </Card>
          )}
        </div>
      </div>

      {/* Snapshot Detail View */}
      <Modal
        open={snapshotDetailModalOpen}
        onCancel={() => {
          setSnapshotDetailModalOpen(false);
          setViewingSnapshot(null);
        }}
        footer={null}
        width="80%"
        style={{ top: 40 }}
        styles={{ body: { padding: 0 } }}
        closeIcon={null}
        className="snapshot-detail-modal"
      >
        {viewingSnapshot && (
          <div style={{ background: 'white' }} className="snapshot-print-area">
            {/* Header */}
            <div
              style={{
                background: '#1e3a5f',
                borderBottom: '4px solid #4a90e2',
                padding: '24px 48px',
                marginBottom: 0,
              }}
            >
              <div style={{ maxWidth: 1400, margin: '0 auto' }}>
                <Row align="middle" justify="space-between">
                  {/* Left: Title */}
                  <Col>
                    <Space size="middle" align="center">
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 4,
                          background: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 6,
                        }}
                      >
                        <CameraOutlined style={{ fontSize: 24, color: '#1e3a5f' }} />
                      </div>
                      <div>
                        <Title level={4} style={{ color: 'white', margin: 0, marginBottom: 8, fontWeight: 600 }}>
                          {viewingSnapshot.title}
                        </Title>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                          {viewingSnapshot.clientName}
                        </Text>
                      </div>
                    </Space>
                  </Col>

                  {/* Right: Date & Actions */}
                  <Col>
                    <Space direction="vertical" align="end" size={4}>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                        {dayjs(viewingSnapshot.startDate).format('YYYY.MM.DD')} - {dayjs(viewingSnapshot.endDate).format('MM.DD')}
                      </Text>
                      <Space size="small">
                        <Button
                          icon={<PrinterOutlined />}
                          onClick={() => window.print()}
                          style={{ background: '#4a90e2', borderColor: '#4a90e2', color: 'white' }}
                        >
                          인쇄
                        </Button>
                        <Button
                          icon={<EyeOutlined />}
                          onClick={() => {
                            setSnapshotDetailModalOpen(false);
                            setViewingSnapshot(null);
                          }}
                          style={{ background: 'white', borderColor: 'white', color: '#1e3a5f' }}
                        >
                          닫기
                        </Button>
                      </Space>
                    </Space>
                  </Col>
                </Row>
              </div>
            </div>

            {/* Content Area */}
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0' }}>
              {/* Statistics Cards */}
              <Row gutter={[12, 12]} style={{ marginBottom: 24, marginTop: 24 }}>
                <Col span={6}>
                  <Card
                    styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    style={{
                      background: 'white',
                      border: '1px solid #dee2e6',
                      borderTop: '3px solid #1e3a5f',
                      borderRadius: 0,
                    }}
                  >
                    <Statistic
                      title={<span style={{ color: '#6c757d', fontSize: 13 }}>전체 업무</span>}
                      value={viewingSnapshot.statistics.total}
                      suffix="건"
                      valueStyle={{ color: '#1e3a5f', fontSize: 32, fontWeight: 700 }}
                    />
                  </Card>
                </Col>

                <Col span={6}>
                  <Card
                    styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    style={{
                      background: 'white',
                      border: '1px solid #dee2e6',
                      borderTop: '3px solid #52c41a',
                      borderRadius: 0,
                    }}
                  >
                    <Statistic
                      title={<span style={{ color: '#6c757d', fontSize: 13 }}>완료</span>}
                      value={viewingSnapshot.statistics.completed}
                      suffix="건"
                      valueStyle={{ color: '#52c41a', fontSize: 32, fontWeight: 700 }}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      완료율 {viewingSnapshot.statistics.total > 0 ? Math.round((viewingSnapshot.statistics.completed / viewingSnapshot.statistics.total) * 100) : 0}%
                    </Text>
                  </Card>
                </Col>

                <Col span={6}>
                  <Card
                    styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    style={{
                      background: 'white',
                      border: '1px solid #dee2e6',
                      borderTop: '3px solid #1890ff',
                      borderRadius: 0,
                    }}
                  >
                    <Statistic
                      title={<span style={{ color: '#6c757d', fontSize: 13 }}>진행중</span>}
                      value={viewingSnapshot.statistics.inProgress}
                      suffix="건"
                      valueStyle={{ color: '#1890ff', fontSize: 32, fontWeight: 700 }}
                    />
                  </Card>
                </Col>

                <Col span={6}>
                  <Card
                    styles={{ body: { padding: '16px', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    style={{
                      background: 'white',
                      border: '1px solid #dee2e6',
                      borderTop: '3px solid #4a90e2',
                      borderRadius: 0,
                    }}
                  >
                    <Statistic
                      title={<span style={{ color: '#6c757d', fontSize: 13 }}>평균 진행률</span>}
                      value={viewingSnapshot.statistics.averageProgress}
                      suffix="%"
                      valueStyle={{ color: '#4a90e2', fontSize: 32, fontWeight: 700 }}
                    />
                    <Progress
                      percent={viewingSnapshot.statistics.averageProgress}
                      strokeColor="#4a90e2"
                      trailColor="#f0f0f0"
                      showInfo={false}
                      style={{ marginTop: 8 }}
                      size="small"
                    />
                  </Card>
                </Col>
              </Row>

              {/* Project Progress Cards */}
              <div style={{ marginBottom: 24 }}>
                <Title level={5} style={{ marginBottom: 12, color: '#1e3a5f', fontWeight: 600 }}>
                  프로젝트별 진행 현황
                </Title>

                {(() => {
                  // Group ACTION items by project for statistics
                  const snapshotData = viewingSnapshot.data as Item[];

                  console.log('=== 스냅샷 데이터 디버그 ===');
                  console.log('전체 아이템 수:', snapshotData.length);
                  console.log('아이템 타입별 개수:');
                  console.log('- PROJECT:', snapshotData.filter(i => i.type === ItemType.PROJECT).length);
                  console.log('- SERVICE:', snapshotData.filter(i => i.type === ItemType.SERVICE).length);
                  console.log('- TEAM:', snapshotData.filter(i => i.type === ItemType.TEAM).length);
                  console.log('- ACTION:', snapshotData.filter(i => i.type === ItemType.ACTION).length);

                  const actionItems = snapshotData.filter((item: Item) => item.type === ItemType.ACTION);

                  const projectGroups = actionItems.reduce((acc, item: Item) => {
                    let projectName = '';

                    // Find project name from parent hierarchy
                    let currentItem = item;
                    console.log(`액션 "${item.name}" 처리 중, parentId: ${currentItem.parentId}`);

                    while (currentItem.parentId) {
                      const parent = snapshotData.find(i => i.id === currentItem.parentId);
                      console.log(`  부모 찾기 시도: ${currentItem.parentId}, 결과:`, parent ? `${parent.name} (${parent.type})` : 'NOT FOUND');
                      if (!parent) break;
                      if (parent.type === ItemType.PROJECT) {
                        projectName = parent.name;
                        break;
                      }
                      currentItem = parent;
                    }
                    projectName = projectName || '기타';
                    console.log(`  최종 프로젝트명: ${projectName}`);

                    if (!acc[projectName]) {
                      acc[projectName] = [];
                    }
                    acc[projectName].push(item);
                    return acc;
                  }, {} as Record<string, Item[]>);

                  console.log('프로젝트 그룹:', Object.keys(projectGroups));

                  // Snapshot column definition
                  const snapshotColumns: ColumnType<Item>[] = [
                    {
                      title: '업무명',
                      dataIndex: 'name',
                      key: 'name',
                      render: (name: string, record: Item) => {
                        // Find team name for ACTION items
                        let teamName = '';
                        if (record.type === ItemType.ACTION) {
                          let currentItem = record;
                          while (currentItem.parentId) {
                            const parent = snapshotData.find(i => i.id === currentItem.parentId);
                            if (!parent) break;
                            if (parent.type === ItemType.TEAM) {
                              teamName = parent.name;
                              break;
                            }
                            currentItem = parent;
                          }
                        }

                        const childrenCount = snapshotData.filter(item => item.parentId === record.id).length;
                        const indent = record.type === ItemType.ACTION ? 24 : 0;

                        const backgroundColor = record.type === ItemType.ACTION ? '#fafafa' : 'transparent';

                        return (
                          <div style={{ paddingLeft: indent, backgroundColor, margin: '-8px -16px', padding: '8px 16px' }}>
                            <div style={{ marginBottom: 4 }}>
                              <Space size={4}>
                                {record.type === ItemType.ACTION && (
                                  <span style={{ color: '#bfbfbf', fontSize: 12, marginRight: 4 }}>└</span>
                                )}
                                <Tag color={TYPE_COLORS[record.type]} style={{ fontWeight: 600, flexShrink: 0 }}>
                                  {TYPE_LABELS[record.type]}
                                </Tag>
                                <span>
                                  {name}
                                  {childrenCount > 0 && (
                                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                      ({childrenCount})
                                    </Text>
                                  )}
                                </span>
                              </Space>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div>
                                {teamName && (
                                  <Tag style={{ margin: 0, backgroundColor: '#f0f0f0', color: '#666', border: '1px solid #d9d9d9' }}>
                                    {teamName}
                                  </Tag>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Tag color={STATUS_COLORS[record.status]} style={{ margin: 0 }}>
                                  {STATUS_LABELS[record.status]}
                                </Tag>
                                <div style={{ width: 100 }}>
                                  <Progress
                                    percent={record.progress}
                                    strokeColor="#1890ff"
                                    trailColor="#f0f0f0"
                                    size="small"
                                    format={(percent) => `${percent}%`}
                                  />
                                </div>
                                <Text type="secondary" style={{ fontSize: 11, width: 130, textAlign: 'right' }}>
                                  {record.startDate ? dayjs(record.startDate).format('YY.MM.DD') : '-'} ~ {record.endDate ? dayjs(record.endDate).format('YY.MM.DD') : '-'}
                                </Text>
                              </div>
                            </div>
                          </div>
                        );
                      },
                    },
                  ];

                  return Object.keys(projectGroups).length > 0 ? (
                    <Row gutter={[12, 12]}>
                      {Object.entries(projectGroups).map(([projectName, actionItems]) => {
                        // Get SERVICE and ACTION items for display (exclude PROJECT)
                        const displayItems = snapshotData.filter(item => {
                          // Only include SERVICE and ACTION types
                          if (item.type !== ItemType.SERVICE && item.type !== ItemType.ACTION) {
                            return false;
                          }

                          // Find project name for this item
                          let itemProjectName = '';
                          let currentItem = item;
                          while (currentItem.parentId) {
                            const parent = snapshotData.find(i => i.id === currentItem.parentId);
                            if (!parent) break;
                            if (parent.type === ItemType.PROJECT) {
                              itemProjectName = parent.name;
                              break;
                            }
                            currentItem = parent;
                          }
                          return itemProjectName === projectName;
                        });

                        // Build hierarchy: SERVICE items with their ACTION children
                        const serviceMap = new Map<string, { service: Item; actions: Item[] }>();

                        displayItems.forEach(item => {
                          if (item.type === ItemType.SERVICE) {
                            if (!serviceMap.has(item.id)) {
                              serviceMap.set(item.id, { service: item, actions: [] });
                            }
                          } else if (item.type === ItemType.ACTION) {
                            // Find parent service
                            let currentItem = item;
                            let serviceId: string | null = null;

                            while (currentItem.parentId) {
                              const parent = snapshotData.find(i => i.id === currentItem.parentId);
                              if (!parent) break;
                              if (parent.type === ItemType.SERVICE) {
                                serviceId = parent.id;
                                break;
                              }
                              currentItem = parent;
                            }

                            if (serviceId && serviceMap.has(serviceId)) {
                              serviceMap.get(serviceId)!.actions.push(item);
                            }
                          }
                        });

                        // Build table data with hierarchy
                        const tableData: any[] = [];
                        serviceMap.forEach(({ service, actions }) => {
                          tableData.push(service);
                          actions.forEach(action => {
                            tableData.push(action);
                          });
                        });

                        // Statistics based on ACTION items
                        const projectCompleted = actionItems.filter(i => i.status === ItemStatus.COMPLETED).length;
                        const projectProgress = actionItems.length > 0
                          ? Math.round(actionItems.reduce((sum, item) => sum + item.progress, 0) / actionItems.length)
                          : 0;

                        return (
                          <Col span={12} key={projectName}>
                            <Card
                              styles={{ body: { padding: '16px' } }}
                              style={{
                                borderRadius: 0,
                                border: '1px solid #dee2e6',
                                borderLeft: `4px solid #1e3a5f`,
                              }}
                            >
                              {/* Card Header */}
                              <div style={{ marginBottom: 12 }}>
                                <Row gutter={16} align="middle">
                                  <Col flex="1">
                                    <Title level={5} style={{ margin: 0, marginBottom: 4, color: '#1e3a5f' }}>
                                      {projectName}
                                    </Title>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      총 {actionItems.length}건 · 완료 {projectCompleted}건 · 진행률 {projectProgress}%
                                    </Text>
                                  </Col>
                                  <Col>
                                    <Progress
                                      type="circle"
                                      percent={projectProgress}
                                      strokeColor="#e74c3c"
                                      trailColor="#f0f0f0"
                                      size={60}
                                      strokeWidth={6}
                                      format={(percent) => (
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>
                                          {percent}%
                                        </span>
                                      )}
                                    />
                                  </Col>
                                </Row>
                              </div>

                              {/* Status Breakdown - Based on ACTION items */}
                              <Row gutter={8}>
                                <Col span={8}>
                                  <div style={{ textAlign: 'center', padding: '8px 0', background: '#f5f5f5', borderRadius: 8 }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>
                                      {actionItems.filter(i => i.status === ItemStatus.COMPLETED).length}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>완료</Text>
                                  </div>
                                </Col>
                                <Col span={8}>
                                  <div style={{ textAlign: 'center', padding: '8px 0', background: '#f5f5f5', borderRadius: 8 }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
                                      {actionItems.filter(i => i.status === ItemStatus.IN_PROGRESS).length}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>진행중</Text>
                                  </div>
                                </Col>
                                <Col span={8}>
                                  <div style={{ textAlign: 'center', padding: '8px 0', background: '#f5f5f5', borderRadius: 8 }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: '#d9d9d9' }}>
                                      {actionItems.filter(i => i.status === ItemStatus.NOT_STARTED).length}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>시작전</Text>
                                  </div>
                                </Col>
                              </Row>

                              {/* Detailed Table */}
                              <Divider style={{ margin: '16px 0' }} />
                              <Table
                                dataSource={tableData}
                                columns={snapshotColumns}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                showHeader={false}
                                expandable={{
                                  defaultExpandAllRows: false,
                                  expandRowByClick: false,
                                  showExpandColumn: false,
                                }}
                              />
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  ) : (
                    <Card style={{ borderRadius: 0 }}>
                      <Empty description="선택한 기간에 해당하는 데이터가 없습니다" />
                    </Card>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Print Styles */}
      <style>{`
        @media print {
          /* 페이지 설정 */
          @page {
            size: A4;
            margin: 0.8cm;
          }

          /* 기본 body 설정 */
          body {
            background: white !important;
            margin: 0;
            padding: 0;
            font-size: 10pt !important;
          }

          /* 전체 글씨 크기 축소 */
          * {
            font-size: inherit !important;
          }

          /* 제목 크기 조정 */
          h1, h2, h3, h4, h5, h6 {
            font-size: 14pt !important;
            margin: 8px 0 !important;
          }

          /* 통계 숫자 크기 조정 */
          .ant-statistic-content-value {
            font-size: 18pt !important;
          }

          .ant-statistic-title {
            font-size: 9pt !important;
          }

          /* 테이블 글씨 크기 */
          .ant-table {
            font-size: 9pt !important;
          }

          /* 태그 크기 조정 */
          .ant-tag {
            font-size: 8pt !important;
            padding: 1px 6px !important;
            line-height: 16px !important;
          }

          /* Progress 바 크기 조정 */
          .ant-progress {
            font-size: 8pt !important;
          }

          /* 카드 패딩 축소 */
          .ant-card {
            margin-bottom: 12px !important;
          }

          .ant-card-body {
            padding: 12px !important;
          }

          /* Row 간격 축소 */
          .ant-row {
            margin-bottom: 8px !important;
          }

          /* 사이드바와 기본 헤더 숨김 */
          .ant-layout-sider,
          .ant-layout-header,
          aside,
          nav {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }

          /* 메인 컨텐츠 영역을 전체 너비로 */
          .ant-layout {
            width: 100% !important;
          }

          .ant-layout-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          /* 스냅샷 모달이 열려있을 때 */
          .snapshot-detail-modal ~ * {
            display: none !important;
          }

          /* 스냅샷 모달 영역만 표시 */
          .snapshot-print-area {
            display: block !important;
            background: white !important;
          }

          /* 스냅샷 헤더 패딩 축소 */
          .snapshot-print-area > div:first-child {
            padding: 12px 24px !important;
          }

          /* 스냅샷 컨텐츠 영역 패딩 축소 */
          .snapshot-print-area > div:first-child > div {
            max-width: 100% !important;
          }

          /* 모달 배경 제거 */
          .ant-modal-mask,
          .ant-modal-wrap {
            display: block !important;
          }

          .ant-modal {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .ant-modal-content {
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* 스냅샷 내부 버튼 숨김 */
          .snapshot-print-area button {
            display: none !important;
          }

          /* 메인 페이지 인쇄 시 (스냅샷 모달 닫혀있을 때) */
          .report-page {
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            visibility: visible !important;
          }

          /* 헤더 영역 표시 */
          .report-page > div:first-child {
            display: block !important;
            padding: 16px 32px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #1e3a5f !important;
            border-bottom: 3px solid #4a90e2 !important;
            visibility: visible !important;
          }

          /* 버튼과 컨트롤 숨김 */
          .report-page button,
          .report-page .ant-select,
          .report-page .ant-picker {
            display: none !important;
          }

          /* 스냅샷 패널 숨김 */
          .report-page > div:nth-child(2) {
            display: none !important;
          }

          /* 컨텐츠 영역 표시 */
          .report-page > div:nth-child(3),
          .report-page > div:last-child {
            display: block !important;
            padding: 16px !important;
            max-width: 100% !important;
            visibility: visible !important;
          }

          /* 모든 자식 요소 표시 */
          .report-page * {
            visibility: visible !important;
          }

          /* Row를 flex로 유지 */
          .report-page .ant-row {
            display: flex !important;
            visibility: visible !important;
          }

          /* Col도 표시 */
          .report-page .ant-col {
            display: block !important;
            visibility: visible !important;
          }

          /* 통계 카드와 테이블 표시 */
          .report-page .ant-card,
          .report-page .ant-statistic,
          .report-page .ant-table {
            display: block !important;
            visibility: visible !important;
          }

          /* 테이블 내부 요소들 */
          .report-page .ant-table-wrapper,
          .report-page .ant-table-container,
          .report-page .ant-table-content,
          .report-page table,
          .report-page tbody,
          .report-page tr,
          .report-page td {
            display: table !important;
            visibility: visible !important;
          }

          .report-page tr {
            display: table-row !important;
          }

          .report-page td {
            display: table-cell !important;
          }

          /* 카드 페이지 분할 방지 */
          .ant-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Row 페이지 분할 방지 */
          .ant-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* 통계 카드 행 */
          .report-page .ant-row:first-of-type {
            margin-bottom: 16px !important;
          }

          /* 색상 유지 */
          *:not(body):not(h1):not(h2):not(h3):not(h4):not(h5):not(h6):not(.ant-tag):not(.ant-statistic-content-value):not(.ant-statistic-title):not(.ant-table):not(.ant-progress) {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* 통계 카드 높이 축소 */
          .ant-statistic {
            height: auto !important;
          }

          /* 통계 컨텐츠 영역 최대폭 설정 */
          .snapshot-print-area .ant-row {
            max-width: 100% !important;
          }

          /* Progress 바 표시 */
          .ant-progress {
            break-inside: avoid;
          }

          /* 테이블 페이지 분할 최적화 */
          .ant-table {
            break-inside: auto;
          }

          .ant-table-tbody > tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* 메인 페이지 숨김 (스냅샷 모달 열려있을 때) */
          .snapshot-detail-modal:not([style*="display: none"]) ~ .report-page {
            display: none !important;
          }
        }
      `}</style>

      {/* 스냅샷 생성 모달 */}
      <Modal
        title={
          <Space>
            <CameraOutlined style={{ color: '#1890ff' }} />
            <span>스냅샷 생성</span>
          </Space>
        }
        open={createSnapshotModalOpen}
        onOk={handleCreateSnapshot}
        onCancel={() => {
          setCreateSnapshotModalOpen(false);
          form.resetFields();
        }}
        okText="생성"
        cancelText="취소"
        width={500}
      >
        <div style={{ padding: '24px 0' }}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="title"
              label="스냅샷 제목"
              rules={[{ required: true, message: '제목을 입력해주세요' }]}
            >
              <Input
                placeholder="예: 10월 첫째주 보고서"
                value={snapshotTitle}
                onChange={(e) => setSnapshotTitle(e.target.value)}
                size="large"
                prefix={<FileTextOutlined style={{ color: '#bfbfbf' }} />}
              />
            </Form.Item>

            <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <CalendarOutlined style={{ marginRight: 8 }} />
                스냅샷 기간: <strong>{dateRange[0].format('YYYY-MM-DD')} ~ {dateRange[1].format('YYYY-MM-DD')}</strong>
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 13, marginTop: 8, display: 'inline-block' }}>
                <TeamOutlined style={{ marginRight: 8 }} />
                총 <strong>{itemsInRange.length}개</strong>의 업무 항목이 포함됩니다
              </Text>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
};
