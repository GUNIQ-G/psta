import React, { useEffect, useState } from 'react';
import {
  Card,
  Tree,
  Spin,
  message,
  Tag,
  Avatar,
  List,
  Row,
  Col,
  Descriptions,
  Button,
  Space,
  Statistic,
  Input,
  Typography,
  Empty,
  Modal,
  Steps,
  Alert,
  Result,
  Select,
} from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
  ApartmentOutlined,
  BankOutlined,
  SyncOutlined,
  MailOutlined,
  PhoneOutlined,
  SearchOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  LockOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import axios from '../api/axios';
import type { Team, User, UserRole } from '../types/user';
import { useAuthStore } from '../store/authStore';
import { userApi } from '../api/user';

const { Search } = Input;

interface TeamWithUsers extends Team {
  User?: User[];
  children?: TeamWithUsers[];
}

const OrganizationManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const [teamTree, setTeamTree] = useState<TeamWithUsers[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithUsers | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');

  // Statistics
  const [stats, setStats] = useState({
    totalTeams: 0,
    totalUsers: 0,
    ldapTeams: 0,
    ldapUsers: 0,
  });

  // Reset modal state
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetStep, setResetStep] = useState(0);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{
    success: boolean;
    deletedTeams?: number;
    updatedUsers?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadTeamHierarchy();
  }, []);

  const loadTeamHierarchy = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/teams/hierarchy');
      setTeamTree(response.data);

      // Calculate statistics
      const calcStats = (teams: TeamWithUsers[]) => {
        let teamCount = 0;
        let userCount = 0;
        let ldapTeamCount = 0;
        let ldapUserCount = 0;

        const traverse = (items: TeamWithUsers[]) => {
          items.forEach(team => {
            teamCount++;
            if (team.ldapDn) ldapTeamCount++;
            if (team.User) {
              userCount += team.User.length;
              ldapUserCount += team.User.filter(u => (u as any).ldapDn).length;
            }
            if (team.children) traverse(team.children);
          });
        };
        traverse(teams);

        return { totalTeams: teamCount, totalUsers: userCount, ldapTeams: ldapTeamCount, ldapUsers: ldapUserCount };
      };

      setStats(calcStats(response.data));

      // Auto-expand first level
      const firstLevelKeys = response.data.map((team: TeamWithUsers) => team.id);
      setExpandedKeys(firstLevelKeys);
    } catch (error: any) {
      message.error('팀 계층 구조 로드 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Filter teams by search value
  const filterTeams = (teams: TeamWithUsers[], search: string): TeamWithUsers[] => {
    if (!search) return teams;

    const searchLower = search.toLowerCase();

    const filterRecursive = (items: TeamWithUsers[]): TeamWithUsers[] => {
      return items.reduce((acc: TeamWithUsers[], team) => {
        const teamMatches = team.name.toLowerCase().includes(searchLower);
        const userMatches = team.User?.some(u =>
          u.displayName.toLowerCase().includes(searchLower) ||
          u.username.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
        );

        const filteredChildren = team.children ? filterRecursive(team.children) : [];

        if (teamMatches || userMatches || filteredChildren.length > 0) {
          acc.push({
            ...team,
            children: filteredChildren.length > 0 ? filteredChildren : team.children,
          });
        }

        return acc;
      }, []);
    };

    return filterRecursive(teams);
  };

  // Convert team hierarchy to Ant Design Tree data
  const convertToTreeData = (teams: TeamWithUsers[]): DataNode[] => {
    return teams.map(team => {
      const memberCount = team.User?.length || 0;
      const childCount = team.children?.length || 0;

      // Determine icon and color based on level or type
      let icon = <TeamOutlined />;
      let color = '#1890ff';

      if (team.ldapType === 'OU') {
        if (team.level === 1) {
          icon = <BankOutlined />;
          color = '#722ed1';
        } else if (team.level === 2) {
          icon = <ApartmentOutlined />;
          color = '#2f54eb';
        } else {
          icon = <TeamOutlined />;
          color = '#13c2c2';
        }
      } else {
        icon = <TeamOutlined />;
        color = '#fa8c16';
      }

      return {
        key: team.id,
        title: (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color }}>{icon}</span>
            <span style={{ fontWeight: 500 }}>{team.name}</span>
            {memberCount > 0 && (
              <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>{memberCount}명</Tag>
            )}
            {childCount > 0 && (
              <Tag color="default" style={{ margin: 0, fontSize: 11 }}>{childCount}개 하위</Tag>
            )}
          </div>
        ),
        children: team.children && team.children.length > 0
          ? convertToTreeData(team.children)
          : undefined,
      };
    });
  };

  // Find team by id in hierarchy
  const findTeamById = (teams: TeamWithUsers[], id: string): TeamWithUsers | null => {
    for (const team of teams) {
      if (team.id === id) return team;
      if (team.children) {
        const found = findTeamById(team.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const teamId = selectedKeys[0] as string;
      const team = findTeamById(teamTree, teamId);
      setSelectedTeam(team);
    } else {
      setSelectedTeam(null);
    }
  };

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys as string[]);
  };

  const handleExpandAll = () => {
    const getAllKeys = (teams: TeamWithUsers[]): string[] => {
      return teams.reduce((keys: string[], team) => {
        keys.push(team.id);
        if (team.children) keys.push(...getAllKeys(team.children));
        return keys;
      }, []);
    };

    if (expandedKeys.length === getAllKeys(teamTree).length) {
      setExpandedKeys([]);
    } else {
      setExpandedKeys(getAllKeys(teamTree));
    }
  };

  // Reset organization functions
  const openResetModal = () => {
    setResetModalVisible(true);
    setResetStep(0);
    setResetPassword('');
    setResetResult(null);
  };

  const closeResetModal = () => {
    setResetModalVisible(false);
    setResetStep(0);
    setResetPassword('');
    setResetResult(null);
  };

  const handleResetNext = () => {
    if (resetStep < 2) {
      setResetStep(resetStep + 1);
    }
  };

  const handleResetPrev = () => {
    if (resetStep > 0) {
      setResetStep(resetStep - 1);
    }
  };

  const executeReset = async () => {
    if (!resetPassword) {
      message.error('비밀번호를 입력해주세요.');
      return;
    }

    setResetLoading(true);
    try {
      const response = await axios.post('/teams/reset', { password: resetPassword });
      if (response.data.success) {
        setResetResult({
          success: true,
          deletedTeams: response.data.result.deletedTeams,
          updatedUsers: response.data.result.updatedUsers,
        });
        setResetStep(3); // Move to result step
        loadTeamHierarchy(); // Reload team data
      } else {
        setResetResult({
          success: false,
          error: response.data.error || '초기화에 실패했습니다.',
        });
        setResetStep(3);
      }
    } catch (error: any) {
      setResetResult({
        success: false,
        error: error.response?.data?.error || error.message || '초기화에 실패했습니다.',
      });
      setResetStep(3);
    } finally {
      setResetLoading(false);
    }
  };

  // 멤버 정렬 함수: 역할 > 직급 > 이름
  const sortMembers = (users: User[]) => {
    const roleOrder: Record<string, number> = { PO: 0, PM: 1, ADMIN: 2, MEMBER: 3 };
    const positionOrder: Record<string, number> = { '수석': 0, '책임': 1, '선임': 2, '사원': 3 };

    return [...users].sort((a, b) => {
      // 1차: 역할 정렬
      const roleA = roleOrder[a.role] ?? 99;
      const roleB = roleOrder[b.role] ?? 99;
      if (roleA !== roleB) return roleA - roleB;

      // 2차: 직급 정렬
      const posA = positionOrder[a.position || ''] ?? 99;
      const posB = positionOrder[b.position || ''] ?? 99;
      if (posA !== posB) return posA - posB;

      // 3차: 이름 가나다순
      return (a.displayName || '').localeCompare(b.displayName || '', 'ko');
    });
  };

  // 사용자 역할 변경 핸들러
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await userApi.update(userId, { role: newRole });
      message.success('역할이 변경되었습니다');
      // 팀 데이터 새로고침
      loadTeamHierarchy();
    } catch (error: any) {
      message.error('역할 변경에 실패했습니다: ' + (error.response?.data?.error || error.message));
    }
  };

  const filteredTree = filterTeams(teamTree, searchValue);
  const treeData = convertToTreeData(filteredTree);

  // Auto-expand all when searching
  useEffect(() => {
    if (searchValue) {
      const getAllKeys = (teams: TeamWithUsers[]): string[] => {
        return teams.reduce((keys: string[], team) => {
          keys.push(team.id);
          if (team.children) keys.push(...getAllKeys(team.children));
          return keys;
        }, []);
      };
      setExpandedKeys(getAllKeys(filteredTree));
    }
  }, [searchValue, filteredTree]);

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="blue" icon={<SyncOutlined />}>LDAP 연동</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            조직 정보는 LDAP 서버에서 동기화됩니다
          </Typography.Text>
        </div>
        <Space>
          {currentUser?.role === 'ADMIN' && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={openResetModal}
              size="large"
            >
              초기화
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={loadTeamHierarchy}
            loading={loading}
            size="large"
          >
            새로고침
          </Button>
        </Space>
      </div>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="전체 팀"
              value={stats.totalTeams}
              prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="전체 사용자"
              value={stats.totalUsers}
              prefix={<UserOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="LDAP 팀"
              value={stats.ldapTeams}
              prefix={<ApartmentOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
            <Statistic
              title="LDAP 사용자"
              value={stats.ldapUsers}
              prefix={<UserOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Row gutter={[16, 16]}>
        {/* Left: Tree */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ApartmentOutlined />
                <span>조직 구조</span>
              </Space>
            }
            extra={
              <Button size="small" onClick={handleExpandAll}>
                {expandedKeys.length > 0 ? '모두 접기' : '모두 펼치기'}
              </Button>
            }
            bordered={false}
            style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', height: '100%' }}
          >
            <Search
              placeholder="팀 또는 사용자 검색..."
              allowClear
              prefix={<SearchOutlined />}
              onChange={e => setSearchValue(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Spin spinning={loading}>
              <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
                {treeData.length > 0 ? (
                  <Tree
                    showLine={{ showLeafIcon: false }}
                    expandedKeys={expandedKeys}
                    onExpand={handleExpand}
                    onSelect={handleSelect}
                    treeData={treeData}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      searchValue ? '검색 결과가 없습니다' : (
                        <div>
                          <div>조직도가 없습니다</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            LDAP 관리에서 조직을 동기화하세요
                          </div>
                        </div>
                      )
                    }
                  />
                )}
              </div>
            </Spin>
          </Card>
        </Col>

        {/* Right: Detail Panel */}
        <Col xs={24} lg={14}>
          {selectedTeam ? (
            <Card
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 20
                  }}>
                    <TeamOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedTeam.name}</div>
                    <Space size={4}>
                      {selectedTeam.ldapType && (
                        <Tag color={selectedTeam.ldapType === 'OU' ? 'blue' : 'green'}>
                          {selectedTeam.ldapType === 'OU' ? '조직 단위' : '그룹'}
                        </Tag>
                      )}
                      {selectedTeam.ldapDn && <Tag color="purple">LDAP</Tag>}
                      <Tag>Level {selectedTeam.level}</Tag>
                    </Space>
                  </div>
                </div>
              }
            >
              {/* Team Info */}
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label="팀 이름">{selectedTeam.name}</Descriptions.Item>
                <Descriptions.Item label="계층 레벨">Level {selectedTeam.level}</Descriptions.Item>
                <Descriptions.Item label="멤버 수">{selectedTeam.User?.length || 0}명</Descriptions.Item>
                <Descriptions.Item label="하위 팀">{selectedTeam.children?.length || 0}개</Descriptions.Item>
                {selectedTeam.description && (
                  <Descriptions.Item label="설명" span={2}>{selectedTeam.description}</Descriptions.Item>
                )}
              </Descriptions>

              {/* Team Members */}
              <div>
                <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserOutlined />
                  <span>팀 멤버</span>
                  <Tag color="cyan">{selectedTeam.User?.length || 0}명</Tag>
                </h4>
                {selectedTeam.User && selectedTeam.User.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sortMembers(selectedTeam.User).map((user) => {
                      const isPOorPM = user.role === 'PO' || user.role === 'PM';
                      return (
                      <Card
                        key={user.id}
                        size="small"
                        bordered={isPOorPM}
                        style={{
                          background: isPOorPM ? '#f0f5ff' : '#fafafa',
                          borderRadius: 8,
                          borderColor: isPOorPM ? '#adc6ff' : undefined,
                        }}
                        styles={{ body: { padding: '12px 16px' } }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar
                            style={{ backgroundColor: '#1890ff', flexShrink: 0 }}
                            icon={<UserOutlined />}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, marginBottom: 4 }}>
                              {user.displayName}
                              <span style={{ marginLeft: 8, color: '#8c8c8c', fontWeight: 400, fontSize: 13 }}>
                                ({user.username})
                              </span>
                            </div>
                            <Space size={4} wrap>
                              {user.position && <Tag color="blue" style={{ margin: 0 }}>{user.position}</Tag>}
                              {user.title && <Tag color="cyan" style={{ margin: 0 }}>{user.title}</Tag>}
                              {currentUser?.role === 'ADMIN' ? (
                                <Select
                                  size="small"
                                  value={user.role}
                                  onChange={(value) => handleRoleChange(user.id, value as UserRole)}
                                  style={{ width: 105 }}
                                  options={[
                                    { value: 'PO', label: 'PO' },
                                    { value: 'PM', label: 'PM' },
                                    { value: 'MEMBER', label: 'MEMBER' },
                                  ]}
                                />
                              ) : (
                                <Tag
                                  color={user.role === 'ADMIN' ? 'red' : user.role === 'PM' ? 'geekblue' : user.role === 'PO' ? 'purple' : 'default'}
                                  style={{ margin: 0 }}
                                >
                                  {user.role}
                                </Tag>
                              )}
                            </Space>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', color: '#8c8c8c', fontSize: 12 }}>
                            {user.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MailOutlined />
                                <span>{user.email}</span>
                              </div>
                            )}
                            {user.phoneNumber && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <PhoneOutlined />
                                <span>{user.phoneNumber}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    )})}
                  </div>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="이 팀에 멤버가 없습니다"
                    style={{ padding: '40px 0', background: '#fafafa', borderRadius: 8 }}
                  />
                )}
              </div>

              {/* Sub Teams */}
              {selectedTeam.children && selectedTeam.children.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ApartmentOutlined />
                    <span>하위 팀</span>
                    <Tag>{selectedTeam.children.length}개</Tag>
                  </h4>
                  <Row gutter={[8, 8]}>
                    {selectedTeam.children.map((childTeam) => (
                      <Col xs={24} sm={12} key={childTeam.id}>
                        <Card
                          size="small"
                          hoverable
                          onClick={() => setSelectedTeam(childTeam)}
                          style={{ borderRadius: 8 }}
                        >
                          <Space>
                            <TeamOutlined style={{ color: '#1890ff' }} />
                            <span style={{ fontWeight: 500 }}>{childTeam.name}</span>
                            {childTeam.User && childTeam.User.length > 0 && (
                              <Tag color="cyan">{childTeam.User.length}명</Tag>
                            )}
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </Card>
          ) : (
            <Card
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', height: '100%', minHeight: 400 }}
            >
              <Empty
                image={<ApartmentOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
                description={
                  <div>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>팀을 선택하세요</div>
                    <div style={{ color: '#8c8c8c' }}>왼쪽 조직 구조에서 팀을 클릭하여 상세 정보를 확인하세요</div>
                  </div>
                }
                style={{ marginTop: 80 }}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* Reset Organization Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WarningOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
            <span>조직도 초기화</span>
          </div>
        }
        open={resetModalVisible}
        onCancel={closeResetModal}
        width={600}
        footer={null}
        maskClosable={false}
      >
        <Steps
          current={resetStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: '경고 확인' },
            { title: '최종 확인' },
            { title: '비밀번호 입력' },
            { title: '완료' },
          ]}
        />

        {/* Step 0: Warning */}
        {resetStep === 0 && (
          <div>
            <Alert
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="주의: 되돌릴 수 없는 작업입니다"
              description={
                <div>
                  <p>이 작업은 다음을 수행합니다:</p>
                  <ul style={{ marginLeft: 16 }}>
                    <li><strong>{stats.totalTeams}개</strong>의 모든 팀/조직이 삭제됩니다</li>
                    <li><strong>{stats.totalUsers}명</strong>의 사용자 팀 배정이 해제됩니다</li>
                    <li>삭제된 데이터는 복구할 수 없습니다</li>
                  </ul>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={closeResetModal}>취소</Button>
                <Button type="primary" danger onClick={handleResetNext}>
                  이해했습니다, 계속 진행
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* Step 1: Final Confirmation */}
        {resetStep === 1 && (
          <div>
            <Alert
              type="warning"
              showIcon
              message="최종 확인"
              description={
                <div>
                  <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                    정말로 모든 조직 데이터를 삭제하시겠습니까?
                  </p>
                  <p style={{ color: '#8c8c8c' }}>
                    이 작업 후 LDAP에서 조직을 다시 동기화해야 합니다.
                  </p>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={handleResetPrev}>이전</Button>
                <Button type="primary" danger onClick={handleResetNext}>
                  예, 초기화합니다
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* Step 2: Password Input */}
        {resetStep === 2 && (
          <div>
            <Alert
              type="info"
              showIcon
              icon={<LockOutlined />}
              message="관리자 인증 필요"
              description="보안을 위해 관리자 비밀번호를 입력해주세요."
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                비밀번호
              </Typography.Text>
              <Input.Password
                placeholder="관리자 비밀번호를 입력하세요"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                onPressEnter={executeReset}
                prefix={<LockOutlined />}
                size="large"
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={handleResetPrev}>이전</Button>
                <Button
                  type="primary"
                  danger
                  onClick={executeReset}
                  loading={resetLoading}
                  disabled={!resetPassword}
                >
                  초기화 실행
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {resetStep === 3 && resetResult && (
          <div>
            {resetResult.success ? (
              <Result
                status="success"
                title="초기화 완료"
                subTitle={
                  <div>
                    <p>{resetResult.deletedTeams}개의 팀이 삭제되었습니다.</p>
                    <p>{resetResult.updatedUsers}명의 사용자 팀 배정이 해제되었습니다.</p>
                  </div>
                }
                extra={
                  <Button type="primary" onClick={closeResetModal}>
                    확인
                  </Button>
                }
              />
            ) : (
              <Result
                status="error"
                title="초기화 실패"
                subTitle={resetResult.error}
                extra={
                  <Space>
                    <Button onClick={() => setResetStep(2)}>다시 시도</Button>
                    <Button type="primary" onClick={closeResetModal}>
                      닫기
                    </Button>
                  </Space>
                }
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrganizationManagement;
