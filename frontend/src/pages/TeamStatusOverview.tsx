import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  App,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  Select,
  Progress,
  Spin,
  Empty,
  Tooltip,
  Tree,
} from 'antd';
import {
  TeamOutlined,
  ProjectOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  BankOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { itemsApi } from '../api/items';
import { teamApi } from '../api/team';
import { ItemType, ItemStatus, Item } from '../types';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

interface TeamWithChildren {
  id: string;
  name: string;
  description?: string;
  level?: number;
  ldapType?: string;
  parentId?: string | null;
  children?: TeamWithChildren[];
}

interface TeamStats {
  teamId: string;
  teamName: string;
  totalActions: number;
  completedActions: number;
  inProgressActions: number;
  notStartedActions: number;
  onHoldActions: number;
  avgProgress: number;
  projectCount: number;
  serviceCount: number;
}

const getStatusColor = (status: ItemStatus) => {
  switch (status) {
    case ItemStatus.IN_PROGRESS:
      return 'processing';
    case ItemStatus.COMPLETED:
      return 'success';
    case ItemStatus.ON_HOLD:
      return 'warning';
    case ItemStatus.NOT_STARTED:
      return 'default';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: ItemStatus) => {
  switch (status) {
    case ItemStatus.IN_PROGRESS:
      return '진행중';
    case ItemStatus.COMPLETED:
      return '완료';
    case ItemStatus.ON_HOLD:
      return '보류';
    case ItemStatus.NOT_STARTED:
      return '미시작';
    default:
      return status;
  }
};

export const TeamStatusOverview: React.FC = () => {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [teamHierarchy, setTeamHierarchy] = useState<TeamWithChildren[]>([]);
  const [actions, setActions] = useState<Item[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch team hierarchy
      const teamsData = await teamApi.getHierarchy();
      setTeamHierarchy(teamsData);

      // Auto-expand first level
      const firstLevelKeys = teamsData.map((team: TeamWithChildren) => team.id);
      setExpandedKeys(firstLevelKeys);

      // Fetch all actions with creator team info
      const actionsData = await itemsApi.getItems({ type: ItemType.ACTION });
      setActions(actionsData);
    } catch (error: any) {
      message.error('데이터 로드 실패: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  // Build flat team map for quick lookup
  const teamMap = useMemo(() => {
    const map = new Map<string, TeamWithChildren>();

    const traverse = (teams: TeamWithChildren[]) => {
      for (const team of teams) {
        map.set(team.id, team);
        if (team.children) {
          traverse(team.children);
        }
      }
    };
    traverse(teamHierarchy);
    return map;
  }, [teamHierarchy]);

  // Get all descendant team IDs
  const getAllDescendantIds = (teamId: string): string[] => {
    const team = teamMap.get(teamId);
    if (!team) return [];

    const ids: string[] = [teamId];
    if (team.children) {
      for (const child of team.children) {
        ids.push(...getAllDescendantIds(child.id));
      }
    }
    return ids;
  };

  // Calculate stats for selected team (including descendants)
  const teamStats = useMemo<TeamStats | null>(() => {
    if (!selectedTeamId) return null;

    const team = teamMap.get(selectedTeamId);
    if (!team) return null;

    // Get all descendant team IDs
    const teamIds = getAllDescendantIds(selectedTeamId);

    // Filter actions by team
    const teamActions = actions.filter((action: any) => {
      const creatorTeamId = action.User_Item_createdByIdToUser?.teamId;
      return creatorTeamId && teamIds.includes(creatorTeamId);
    });

    // Calculate stats
    const completed = teamActions.filter((a) => a.status === ItemStatus.COMPLETED).length;
    const inProgress = teamActions.filter((a) => a.status === ItemStatus.IN_PROGRESS).length;
    const notStarted = teamActions.filter((a) => a.status === ItemStatus.NOT_STARTED).length;
    const onHold = teamActions.filter((a) => a.status === ItemStatus.ON_HOLD).length;

    const avgProgress = teamActions.length > 0
      ? Math.round(teamActions.reduce((sum, a) => sum + (a.progress || 0), 0) / teamActions.length)
      : 0;

    // Count unique projects and services
    const projectIds = new Set<string>();
    const serviceIds = new Set<string>();
    teamActions.forEach((action: any) => {
      const service = action.Item; // parentId가 가리키는 서비스
      if (service) {
        serviceIds.add(service.id);
        if (service.Item) {
          projectIds.add(service.Item.id);
        }
      }
    });

    return {
      teamId: selectedTeamId,
      teamName: team.name,
      totalActions: teamActions.length,
      completedActions: completed,
      inProgressActions: inProgress,
      notStartedActions: notStarted,
      onHoldActions: onHold,
      avgProgress,
      projectCount: projectIds.size,
      serviceCount: serviceIds.size,
    };
  }, [selectedTeamId, actions, teamMap]);

  // Get filtered actions for selected team
  const filteredActions = useMemo(() => {
    if (!selectedTeamId) return [];

    const teamIds = getAllDescendantIds(selectedTeamId);
    return actions.filter((action: any) => {
      const creatorTeamId = action.User_Item_createdByIdToUser?.teamId;
      return creatorTeamId && teamIds.includes(creatorTeamId);
    });
  }, [selectedTeamId, actions]);

  // Convert team hierarchy to tree data
  const treeData = useMemo(() => {
    const convertToTreeData = (teams: TeamWithChildren[]): DataNode[] => {
      return teams.map((team) => {
        const hasChildren = team.children && team.children.length > 0;

        // Count actions for this team (including descendants)
        const teamIds = getAllDescendantIds(team.id);
        const actionCount = actions.filter((action: any) => {
          const creatorTeamId = action.User_Item_createdByIdToUser?.teamId;
          return creatorTeamId && teamIds.includes(creatorTeamId);
        }).length;

        // Determine icon based on level
        let icon = <TeamOutlined />;
        let color = '#52c41a';

        if (team.ldapType === 'OU') {
          if (team.level === 1) {
            icon = <BankOutlined />;
            color = '#722ed1';
          } else if (team.level === 2) {
            icon = <ApartmentOutlined />;
            color = '#1890ff';
          } else {
            icon = <TeamOutlined />;
            color = '#13c2c2';
          }
        }

        return {
          key: team.id,
          title: (
            <Space size={4}>
              <span style={{ color }}>{icon}</span>
              <span
                style={{
                  fontWeight: selectedTeamId === team.id ? 700 : hasChildren ? 600 : 400,
                  color: selectedTeamId === team.id ? '#1890ff' : undefined,
                }}
              >
                {team.name}
              </span>
              <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>
                {actionCount}
              </Tag>
            </Space>
          ),
          children: hasChildren ? convertToTreeData(team.children!) : undefined,
        };
      });
    };
    return convertToTreeData(teamHierarchy);
  }, [teamHierarchy, actions, selectedTeamId]);

  // Table columns for actions
  const columns = [
    {
      title: '액션명',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <Tag color="orange" style={{ fontSize: 10 }}>A</Tag>
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '프로젝트/서비스',
      key: 'hierarchy',
      render: (_: any, record: any) => {
        const service = record.Item;
        const project = service?.Item;
        return (
          <Space direction="vertical" size={0}>
            <Space size={4}>
              <Tag color="purple" style={{ fontSize: 10 }}>P</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{project?.name || '-'}</Text>
            </Space>
            <Space size={4}>
              <Tag color="blue" style={{ fontSize: 10 }}>S</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{service?.name || '-'}</Text>
            </Space>
          </Space>
        );
      },
    },
    {
      title: '담당자',
      key: 'assignee',
      render: (_: any, record: any) => {
        const assignee = record.User_Item_assigneeIdToUser;
        return assignee ? (
          <Tooltip title={assignee.displayName || assignee.username}>
            <Text>{assignee.displayName || assignee.username}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">미지정</Text>
        );
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      render: (status: ItemStatus) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: '진행률',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress || 0} size="small" style={{ width: 100 }} />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <TeamOutlined style={{ marginRight: 8 }} />
        팀별 현황 조회
      </Title>

      <Spin spinning={loading}>
        <Row gutter={24}>
          {/* Left: Team Tree */}
          <Col xs={24} md={8} lg={6}>
            <Card
              title={
                <Space>
                  <ApartmentOutlined />
                  <span>조직도</span>
                </Space>
              }
              size="small"
              style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}
            >
              {teamHierarchy.length > 0 ? (
                <Tree
                  showLine={{ showLeafIcon: false }}
                  showIcon
                  expandedKeys={expandedKeys}
                  onExpand={(keys) => setExpandedKeys(keys)}
                  selectedKeys={selectedTeamId ? [selectedTeamId] : []}
                  onSelect={(keys) => setSelectedTeamId(keys[0] as string || null)}
                  treeData={treeData}
                  style={{ background: 'transparent' }}
                />
              ) : (
                <Empty description="팀 데이터가 없습니다" />
              )}
            </Card>
          </Col>

          {/* Right: Stats and Actions */}
          <Col xs={24} md={16} lg={18}>
            {selectedTeamId && teamStats ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {/* Stats Cards */}
                <Row gutter={16}>
                  <Col xs={12} sm={8} md={4}>
                    <Card size="small">
                      <Statistic
                        title="전체 액션"
                        value={teamStats.totalActions}
                        prefix={<FileTextOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Card size="small">
                      <Statistic
                        title="진행중"
                        value={teamStats.inProgressActions}
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Card size="small">
                      <Statistic
                        title="완료"
                        value={teamStats.completedActions}
                        valueStyle={{ color: '#52c41a' }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Card size="small">
                      <Statistic
                        title="미시작"
                        value={teamStats.notStartedActions}
                        valueStyle={{ color: '#8c8c8c' }}
                        prefix={<PauseCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Card size="small">
                      <Statistic
                        title="프로젝트"
                        value={teamStats.projectCount}
                        prefix={<ProjectOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Card size="small">
                      <Statistic
                        title="평균 진행률"
                        value={teamStats.avgProgress}
                        suffix="%"
                        prefix={<Progress type="circle" percent={teamStats.avgProgress} size={20} />}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Actions Table */}
                <Card
                  title={
                    <Space>
                      <Tag color="green">{teamStats.teamName}</Tag>
                      <span>팀 액션 목록</span>
                      <Tag>{filteredActions.length}개</Tag>
                    </Space>
                  }
                  size="small"
                >
                  <Table
                    columns={columns}
                    dataSource={filteredActions}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    locale={{ emptyText: '해당 팀의 액션이 없습니다' }}
                  />
                </Card>
              </Space>
            ) : (
              <Card style={{ height: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty
                  image={<TeamOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
                  description={
                    <Space direction="vertical">
                      <Text strong>팀을 선택해주세요</Text>
                      <Text type="secondary">왼쪽 조직도에서 팀을 선택하면 해당 팀의 현황을 확인할 수 있습니다.</Text>
                    </Space>
                  }
                />
              </Card>
            )}
          </Col>
        </Row>
      </Spin>
    </div>
  );
};
