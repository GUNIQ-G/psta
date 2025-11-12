import React, { useEffect, useState } from 'react';
import {
  Layout,
  Tree,
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Statistic,
  Row,
  Col,
  Empty,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  SyncOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { teamApi } from '../api/team';
import { userApi } from '../api/user';
import { ldapSyncApi } from '../api/ldap-sync';
import { Team, User } from '../types/user';
import { useAuthStore } from '../store/authStore';

const { Content, Sider } = Layout;
const { Search } = Input;

interface TreeNodeData {
  key: string;
  title: string;
  type: 'team' | 'user';
  data: Team | User;
  icon?: React.ReactNode;
  children?: TreeNodeData[];
  isLeaf?: boolean;
}

const OrganizationManagement: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Modal states
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [teamForm] = Form.useForm();
  const [userForm] = Form.useForm();

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Build tree data when teams or users change
  useEffect(() => {
    buildTreeData();
  }, [teams, users, searchValue]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsData, usersData] = await Promise.all([
        teamApi.getAll(),
        userApi.getAll(true), // Include inactive users
      ]);

      setTeams(teamsData);
      setUsers(usersData);
    } catch (error: any) {
      message.error('데이터 로드 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const buildTreeData = () => {
    const filteredTeams = teams.filter(team => {
      if (!searchValue) return true;
      const searchLower = searchValue.toLowerCase();
      return team.name.toLowerCase().includes(searchLower);
    });

    const filteredUsers = users.filter(user => {
      if (!searchValue) return true;
      const searchLower = searchValue.toLowerCase();
      return (
        user.username.toLowerCase().includes(searchLower) ||
        user.displayName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    });

    const tree: TreeNodeData[] = filteredTeams.map(team => {
      const teamUsers = filteredUsers.filter(user => user.teamId === team.id && user.isActive);

      const userNodes: TreeNodeData[] = teamUsers.map(user => ({
        key: `user-${user.id}`,
        title: `${user.displayName} (${user.username})`,
        type: 'user',
        data: user,
        icon: <UserOutlined />,
        isLeaf: true,
      }));

      return {
        key: `team-${team.id}`,
        title: `${team.name} (${teamUsers.length}명)`,
        type: 'team',
        data: team,
        icon: <TeamOutlined />,
        children: userNodes,
      };
    });

    // Add users without team
    const usersWithoutTeam = filteredUsers.filter(user => !user.teamId && user.isActive);
    if (usersWithoutTeam.length > 0) {
      const noTeamNode: TreeNodeData = {
        key: 'team-no-team',
        title: `미배정 사용자 (${usersWithoutTeam.length}명)`,
        type: 'team',
        data: { id: 'no-team', name: '미배정', isActive: true, ldapDn: null, createdAt: '', updatedAt: '' },
        icon: <TeamOutlined />,
        children: usersWithoutTeam.map(user => ({
          key: `user-${user.id}`,
          title: `${user.displayName} (${user.username})`,
          type: 'user',
          data: user,
          icon: <UserOutlined />,
          isLeaf: true,
        })),
      };
      tree.push(noTeamNode);
    }

    setTreeData(tree);

    // Auto-expand all if searching
    if (searchValue) {
      const allKeys = tree.map(node => node.key);
      setExpandedKeys(allKeys);
    }
  };

  const onSelect = (selectedKeys: React.Key[], info: any) => {
    setSelectedKeys(selectedKeys);
    if (selectedKeys.length > 0) {
      setSelectedNode(info.node as TreeNodeData);
    } else {
      setSelectedNode(null);
    }
  };

  const onExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys);
  };

  const handleLdapSync = () => {
    Modal.confirm({
      title: 'LDAP 동기화',
      content: (
        <div>
          <p>LDAP 서버의 조직 정보를 PSTA와 동기화합니다.</p>
          <ul>
            <li>LDAP에 없는 팀은 비활성화됩니다</li>
            <li>LDAP에 없는 사용자는 비활성화됩니다</li>
            <li>팀 멤버십이 자동으로 업데이트됩니다</li>
          </ul>
          <p style={{ color: '#ff4d4f', marginTop: 16 }}>
            <strong>⚠️ 주의:</strong> 이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
      ),
      okText: '동기화 실행',
      okType: 'primary',
      cancelText: '취소',
      onOk: async () => {
        setSyncing(true);
        try {
          const response = await ldapSyncApi.triggerSync(false);
          if (response.success) {
            const result = response.result;
            Modal.success({
              title: '동기화 완료',
              content: (
                <div>
                  <p>LDAP 동기화가 성공적으로 완료되었습니다.</p>
                  <ul>
                    <li>팀 생성: {result.teamsCreated}개</li>
                    <li>팀 비활성화: {result.teamsDeactivated}개</li>
                    <li>사용자 비활성화: {result.usersDeactivated}개</li>
                    <li>멤버십 업데이트: {result.teamMembershipsUpdated}개</li>
                  </ul>
                </div>
              ),
            });
            await loadData();
          }
        } catch (error: any) {
          message.error('LDAP 동기화 실패: ' + error.message);
        } finally {
          setSyncing(false);
        }
      },
    });
  };

  // Team CRUD operations
  const handleCreateTeam = () => {
    setEditingTeam(null);
    teamForm.resetFields();
    setIsTeamModalVisible(true);
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    teamForm.setFieldsValue({
      name: team.name,
      isActive: team.isActive,
    });
    setIsTeamModalVisible(true);
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await teamApi.delete(teamId);
      message.success('팀이 삭제되었습니다');
      await loadData();
      setSelectedNode(null);
      setSelectedKeys([]);
    } catch (error: any) {
      message.error('팀 삭제 실패: ' + error.message);
    }
  };

  const handleTeamModalOk = async () => {
    try {
      const values = await teamForm.validateFields();

      if (editingTeam) {
        // Update team
        await teamApi.update(editingTeam.id, values);
        message.success('팀이 수정되었습니다');
        await loadData();
      } else {
        // Create team
        await teamApi.create(values);
        message.success('팀이 생성되었습니다');
        await loadData();
      }

      setIsTeamModalVisible(false);
      teamForm.resetFields();
    } catch (error: any) {
      message.error('팀 저장 실패: ' + error.message);
    }
  };

  // User CRUD operations
  const handleCreateUser = () => {
    setEditingUser(null);
    userForm.resetFields();
    setIsUserModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      isActive: user.isActive,
    });
    setIsUserModalVisible(true);
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await userApi.delete(userId);
      message.success('사용자가 삭제되었습니다');
      await loadData();
      setSelectedNode(null);
      setSelectedKeys([]);
    } catch (error: any) {
      message.error('사용자 삭제 실패: ' + error.message);
    }
  };

  const handleUserModalOk = async () => {
    try {
      const values = await userForm.validateFields();

      if (editingUser) {
        // Update user
        await userApi.update(editingUser.id, values);
        message.success('사용자가 수정되었습니다');
        await loadData();
      } else {
        // Create user - Note: user creation may not be supported in this API
        message.warning('사용자 생성은 LDAP 동기화를 통해서만 가능합니다');
        return;
      }

      setIsUserModalVisible(false);
      userForm.resetFields();
    } catch (error: any) {
      message.error('사용자 저장 실패: ' + error.message);
    }
  };

  // Render team detail panel
  const renderTeamDetail = (team: Team) => {
    const teamUsers = users.filter(user => user.teamId === team.id && user.isActive);
    const isLdapTeam = !!team.ldapDn;

    return (
      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: 'rgb(0, 140, 214)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 20
            }}>
              <TeamOutlined />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {team.name}
              </div>
              <Space size={8}>
                {isLdapTeam && <Tag color="blue">LDAP</Tag>}
                {!team.isActive && <Tag color="red">비활성</Tag>}
              </Space>
            </div>
          </div>
        }
      >
        <Descriptions bordered column={1} size="small">
          {/* <Descriptions.Item label="팀 ID">{team.id}</Descriptions.Item> */}
          <Descriptions.Item label="팀명">{team.name}</Descriptions.Item>
          <Descriptions.Item label="멤버 수">{teamUsers.length}명</Descriptions.Item>
          {/* <Descriptions.Item label="LDAP DN">
            {team.ldapDn || <Tag>없음</Tag>}
          </Descriptions.Item> */}
          <Descriptions.Item label="상태">
            {team.isActive ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="생성일">
            {team.createdAt ? new Date(team.createdAt).toLocaleString('ko-KR') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="수정일">
            {team.updatedAt ? new Date(team.updatedAt).toLocaleString('ko-KR') : '-'}
          </Descriptions.Item>
        </Descriptions>

        {team.id !== 'no-team' && (
          <div style={{
            marginTop: 24,
            padding: 20,
            background: '#fafafa',
            borderRadius: 8
          }}>
            <h3 style={{
              marginTop: 0,
              marginBottom: 16,
              fontSize: 16,
              fontWeight: 600,
              color: '#262626'
            }}>
              팀 멤버 ({teamUsers.length}명)
            </h3>
            {teamUsers.length === 0 ? (
              <Empty description="팀원이 없습니다" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {teamUsers.map(user => (
                  <Card
                    key={user.id}
                    size="small"
                    hoverable
                    bordered={false}
                    onClick={() => {
                      setSelectedKeys([`user-${user.id}`]);
                      setSelectedNode({
                        key: `user-${user.id}`,
                        title: user.displayName,
                        type: 'user',
                        data: user,
                      });
                    }}
                    style={{
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}
                    bodyStyle={{ padding: '10px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: 'rgb(0, 140, 214)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 14
                      }}>
                        <UserOutlined />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 14 }}>
                          {user.displayName}
                          <span style={{ marginLeft: 6, color: '#8c8c8c', fontWeight: 400, fontSize: 13 }}>
                            ({user.username})
                          </span>
                        </div>
                        <Space size={4}>
                          <Tag
                            color={user.role === 'ADMIN' ? 'red' : user.role === 'PM' ? 'blue' : user.role === 'PO' ? 'purple' : 'default'}
                            style={{ margin: 0, fontSize: 11 }}
                          >
                            {user.role}
                          </Tag>
                          {user.ldapDn && <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>LDAP</Tag>}
                        </Space>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  // Render user detail panel
  const renderUserDetail = (user: User) => {
    const isLdapUser = !!user.ldapDn;

    return (
      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: 'rgb(0, 140, 214)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 20
            }}>
              <UserOutlined />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {user.displayName}
              </div>
              <Space size={8}>
                {isLdapUser && <Tag color="blue">LDAP</Tag>}
                {!user.isActive && <Tag color="red">비활성</Tag>}
              </Space>
            </div>
          </div>
        }
      >
        <Descriptions bordered column={1} size="small">
          {/* <Descriptions.Item label="사용자 ID">{user.id}</Descriptions.Item> */}
          <Descriptions.Item label="아이디">{user.username}</Descriptions.Item>
          <Descriptions.Item label="이름">{user.displayName}</Descriptions.Item>
          <Descriptions.Item label="이메일">{user.email}</Descriptions.Item>
          <Descriptions.Item label="역할">
            <Tag color={user.role === 'ADMIN' ? 'red' : user.role === 'PM' ? 'blue' : user.role === 'PO' ? 'purple' : 'default'}>
              {user.role}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="소속 팀">
            {user.Team ? user.Team.name : <Tag>미배정</Tag>}
          </Descriptions.Item>
          {/* <Descriptions.Item label="LDAP DN">
            {user.ldapDn || <Tag>없음</Tag>}
          </Descriptions.Item> */}
          <Descriptions.Item label="상태">
            {user.isActive ? <Tag color="green">활성</Tag> : <Tag color="red">비활성</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="생성일">
            {user.createdAt ? new Date(user.createdAt).toLocaleString('ko-KR') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="수정일">
            {user.updatedAt ? new Date(user.updatedAt).toLocaleString('ko-KR') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  const activeTeamsCount = teams.filter(t => t.isActive).length;
  const activeUsersCount = users.filter(u => u.isActive).length;

  return (
    <div>
      {/* Header Section */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <Space>
          {user?.role === 'ADMIN' && (
            <Button
              type="primary"
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleLdapSync}
              loading={syncing}
              size="large"
            >
              LDAP 동기화
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
            size="large"
          >
            새로고침
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="활성 팀"
              value={activeTeamsCount}
              suffix={<span style={{ fontSize: 16, color: '#8c8c8c' }}>/ {teams.length}</span>}
              prefix={<TeamOutlined style={{ color: 'rgb(0, 140, 214)' }} />}
              valueStyle={{ color: '#262626' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="활성 사용자"
              value={activeUsersCount}
              suffix={<span style={{ fontSize: 16, color: '#8c8c8c' }}>/ {users.length}</span>}
              prefix={<UserOutlined style={{ color: 'rgb(0, 140, 214)' }} />}
              valueStyle={{ color: '#262626' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="LDAP 팀"
              value={teams.filter(t => t.ldapDn).length}
              prefix={<TeamOutlined style={{ color: 'rgb(0, 140, 214)' }} />}
              valueStyle={{ color: '#262626' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="LDAP 사용자"
              value={users.filter(u => u.ldapDn).length}
              prefix={<UserOutlined style={{ color: 'rgb(0, 140, 214)' }} />}
              valueStyle={{ color: '#262626' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Layout */}
      <Layout style={{ background: '#fff', minHeight: 600, border: '1px solid #f0f0f0' }}>
        <Sider
          width={360}
          style={{
            background: '#fafafa',
            borderRight: '1px solid #e8e8e8'
          }}
        >
          <div style={{ padding: 16 }}>
            <Search
              placeholder="팀 또는 사용자 검색"
              allowClear
              prefix={<SearchOutlined />}
              onChange={e => setSearchValue(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
              </div>
            ) : (
              <div style={{
                maxHeight: 'calc(100vh - 320px)',
                overflowY: 'auto'
              }}>
                <Tree
                  showIcon
                  treeData={treeData}
                  selectedKeys={selectedKeys}
                  expandedKeys={expandedKeys}
                  onSelect={onSelect}
                  onExpand={onExpand}
                  style={{ background: 'transparent' }}
                />
              </div>
            )}
          </div>
        </Sider>
        <Content style={{
          padding: 24,
          minHeight: 600,
          background: '#fff'
        }}>
          {selectedNode ? (
            <div>
              {selectedNode.type === 'team' ? (
                renderTeamDetail(selectedNode.data as Team)
              ) : (
                renderUserDetail(selectedNode.data as User)
              )}
            </div>
          ) : (
            <Empty
              description="트리에서 팀 또는 사용자를 선택하세요"
              style={{
                marginTop: 120
              }}
            />
          )}
        </Content>
      </Layout>

      {/* Team Modal */}
      <Modal
        title={editingTeam ? '팀 수정' : '팀 생성'}
        open={isTeamModalVisible}
        onOk={handleTeamModalOk}
        onCancel={() => {
          setIsTeamModalVisible(false);
          teamForm.resetFields();
        }}
        okText="저장"
        cancelText="취소"
      >
        <Form form={teamForm} layout="vertical">
          <Form.Item
            label="팀명"
            name="name"
            rules={[{ required: true, message: '팀명을 입력하세요' }]}
          >
            <Input placeholder="팀명 입력" />
          </Form.Item>
          <Form.Item
            label="상태"
            name="isActive"
            initialValue={true}
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={true}>활성</Select.Option>
              <Select.Option value={false}>비활성</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* User Modal */}
      <Modal
        title={editingUser ? '사용자 수정' : '사용자 생성'}
        open={isUserModalVisible}
        onOk={handleUserModalOk}
        onCancel={() => {
          setIsUserModalVisible(false);
          userForm.resetFields();
        }}
        okText="저장"
        cancelText="취소"
      >
        <Form form={userForm} layout="vertical">
          <Form.Item
            label="아이디"
            name="username"
            rules={[{ required: true, message: '아이디를 입력하세요' }]}
          >
            <Input placeholder="아이디 입력" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            label="이름"
            name="displayName"
            rules={[{ required: true, message: '이름을 입력하세요' }]}
          >
            <Input placeholder="이름 입력" />
          </Form.Item>
          <Form.Item
            label="이메일"
            name="email"
            rules={[
              { required: true, message: '이메일을 입력하세요' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다' },
            ]}
          >
            <Input placeholder="이메일 입력" />
          </Form.Item>
          <Form.Item
            label="역할"
            name="role"
            initialValue="MEMBER"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="ADMIN">관리자</Select.Option>
              <Select.Option value="PM">PM</Select.Option>
              <Select.Option value="PO">PO</Select.Option>
              <Select.Option value="MEMBER">멤버</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="소속 팀" name="teamId">
            <Select allowClear placeholder="팀 선택">
              {teams
                .filter(t => t.isActive && t.id !== 'no-team')
                .map(team => (
                  <Select.Option key={team.id} value={team.id}>
                    {team.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="상태"
            name="isActive"
            initialValue={true}
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={true}>활성</Select.Option>
              <Select.Option value={false}>비활성</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrganizationManagement;
