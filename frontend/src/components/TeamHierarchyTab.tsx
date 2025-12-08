import React, { useState, useEffect } from 'react';
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
} from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
  ApartmentOutlined,
  BankOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import axios from '../api/axios';
import type { Team, User } from '../types/user';

interface TeamWithUsers extends Team {
  User?: User[];
  children?: TeamWithUsers[];
}

export const TeamHierarchyTab: React.FC = () => {
  const [teamTree, setTeamTree] = useState<TeamWithUsers[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithUsers | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    loadTeamHierarchy();
  }, []);

  const loadTeamHierarchy = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/teams/hierarchy');
      setTeamTree(response.data);

      // Auto-expand first level
      const firstLevelKeys = response.data.map((team: TeamWithUsers) => team.id);
      setExpandedKeys(firstLevelKeys);
    } catch (error: any) {
      message.error('팀 계층 구조 로드 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Convert team hierarchy to Ant Design Tree data
  const convertToTreeData = (teams: TeamWithUsers[]): DataNode[] => {
    return teams.map(team => {
      const memberCount = team.User?.length || 0;
      const childCount = team.children?.length || 0;

      // Determine icon based on level or type
      let icon = <TeamOutlined />;
      let color = 'blue';

      if (team.ldapType === 'OU') {
        if (team.level === 1) {
          icon = <BankOutlined />;
          color = 'purple';
        } else if (team.level === 2) {
          icon = <ApartmentOutlined />;
          color = 'geekblue';
        } else {
          icon = <TeamOutlined />;
          color = 'cyan';
        }
      } else {
        icon = <TeamOutlined />;
        color = 'orange';
      }

      return {
        key: team.id,
        title: (
          <Space>
            <span style={{ color }}>
              {icon}
            </span>
            <strong>{team.name}</strong>
            {team.ldapType && (
              <Tag color={team.ldapType === 'OU' ? 'blue' : 'green'}>
                {team.ldapType}
              </Tag>
            )}
            {memberCount > 0 && (
              <Tag color="cyan">{memberCount}명</Tag>
            )}
            {childCount > 0 && (
              <Tag color="default">{childCount}개 하위</Tag>
            )}
          </Space>
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

  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys as string[]);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={10}>
        <Card
          title={
            <Space>
              <ApartmentOutlined />
              <span>팀 조직도</span>
            </Space>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={loadTeamHierarchy}
              loading={loading}
            >
              새로고침
            </Button>
          }
        >
          <Spin spinning={loading}>
            {teamTree.length > 0 ? (
              <Tree
                showLine
                showIcon
                expandedKeys={expandedKeys}
                onExpand={handleExpand}
                onSelect={handleSelect}
                treeData={convertToTreeData(teamTree)}
                style={{ marginTop: 16 }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <ApartmentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>팀 조직도가 없습니다</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  LDAP 동기화를 실행하여 조직 구조를 가져오세요
                </div>
              </div>
            )}
          </Spin>
        </Card>
      </Col>

      <Col span={14}>
        {selectedTeam ? (
          <Card
            title={
              <Space>
                <TeamOutlined />
                <span>{selectedTeam.name}</span>
                {selectedTeam.ldapType && (
                  <Tag color={selectedTeam.ldapType === 'OU' ? 'blue' : 'green'}>
                    {selectedTeam.ldapType}
                  </Tag>
                )}
              </Space>
            }
          >
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="팀 이름">{selectedTeam.name}</Descriptions.Item>
              <Descriptions.Item label="계층 레벨">Level {selectedTeam.level}</Descriptions.Item>
              <Descriptions.Item label="유형" span={2}>
                {selectedTeam.ldapType === 'OU' ? '조직 단위 (OU)' : '그룹 (Group)'}
              </Descriptions.Item>
              {selectedTeam.ldapDn && (
                <Descriptions.Item label="LDAP DN" span={2}>
                  <div style={{ fontSize: 11, wordBreak: 'break-all' }}>
                    {selectedTeam.ldapDn}
                  </div>
                </Descriptions.Item>
              )}
              {selectedTeam.description && (
                <Descriptions.Item label="설명" span={2}>
                  {selectedTeam.description}
                </Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 16 }}>
                <UserOutlined /> 팀 멤버 ({selectedTeam.User?.length || 0}명)
              </h4>
              {selectedTeam.User && selectedTeam.User.length > 0 ? (
                <List
                  dataSource={selectedTeam.User}
                  renderItem={(user) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{ backgroundColor: '#008cd6' }}
                            icon={<UserOutlined />}
                          />
                        }
                        title={
                          <Space>
                            <span>{user.displayName}</span>
                            {user.position && (
                              <Tag color="blue">{user.position}</Tag>
                            )}
                            {user.title && (
                              <Tag color="cyan">{user.title}</Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <span>{user.email}</span>
                            {user.phoneNumber && (
                              <span style={{ fontSize: 12, color: '#999' }}>
                                {user.phoneNumber}
                              </span>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#999',
                  backgroundColor: '#fafafa',
                  borderRadius: 4,
                }}>
                  <UserOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                  <div>이 팀에 멤버가 없습니다</div>
                </div>
              )}
            </div>

            {selectedTeam.children && selectedTeam.children.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ marginBottom: 16 }}>
                  <ApartmentOutlined /> 하위 팀 ({selectedTeam.children.length}개)
                </h4>
                <List
                  grid={{ gutter: 16, column: 2 }}
                  dataSource={selectedTeam.children}
                  renderItem={(childTeam) => (
                    <List.Item>
                      <Card size="small" hoverable>
                        <Space>
                          <TeamOutlined />
                          <span>{childTeam.name}</span>
                          {childTeam.User && childTeam.User.length > 0 && (
                            <Tag color="cyan">{childTeam.User.length}명</Tag>
                          )}
                        </Space>
                      </Card>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <div style={{
              textAlign: 'center',
              padding: '60px 0',
              color: '#999'
            }}>
              <ApartmentOutlined style={{ fontSize: 64, marginBottom: 16 }} />
              <div style={{ fontSize: 16 }}>팀을 선택하여 상세 정보를 확인하세요</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                왼쪽 조직도에서 팀을 클릭하세요
              </div>
            </div>
          </Card>
        )}
      </Col>
    </Row>
  );
};
