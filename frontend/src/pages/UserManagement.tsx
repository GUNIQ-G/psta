import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  message,
  Space,
  Tag,
  Popconfirm,
  Card,
  Tabs,
  Badge,
  Descriptions,
} from 'antd';
import {
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { userApi } from '../api/user';
import { teamApi } from '../api/team';
import { ldapSyncApi } from '../api/ldap-sync';
import { User, UserRole, Team } from '../types/user';

const { Option } = Select;

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [verifyForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, pendingData, teamsData] = await Promise.all([
        userApi.getAll(),
        userApi.getPending(),
        teamApi.getAll(),
      ]);
      setUsers(usersData);
      setPendingUsers(pendingData);
      setTeams(teamsData);
    } catch (error: any) {
      message.error('데이터 조회 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (user: User) => {
    setSelectedUser(user);
    verifyForm.setFieldsValue({
      role: UserRole.MEMBER,
    });
    setVerifyModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      role: user.role,
      teamId: user.teamId,
      isActive: user.isActive,
    });
    setEditModalVisible(true);
  };

  const handleVerifySubmit = async () => {
    try {
      const values = await verifyForm.validateFields();
      if (selectedUser) {
        // teamId는 LDAP에서 자동으로 할당되므로 전달하지 않음
        await userApi.verify(selectedUser.id, values.role, undefined);
        message.success('사용자가 승인되었습니다');
        setVerifyModalVisible(false);
        fetchData();
      }
    } catch (error: any) {
      message.error('승인 실패: ' + error.message);
    }
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedUser) {
        await userApi.update(selectedUser.id, values);
        message.success('사용자 정보가 수정되었습니다');
        setEditModalVisible(false);
        fetchData();
      }
    } catch (error: any) {
      message.error('수정 실패: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await userApi.delete(id);
      message.success('사용자가 삭제되었습니다');
      fetchData();
    } catch (error: any) {
      message.error('삭제 실패: ' + error.message);
    }
  };

  const handleSyncAllLDAP = async () => {
    Modal.confirm({
      title: 'LDAP 전체 동기화',
      content: (
        <div>
          <p>LDAP 서버의 팀(그룹)과 사용자 정보를 PSTA와 동기화합니다.</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>LDAP에 없는 팀은 비활성화됩니다</li>
            <li>LDAP에 없는 사용자는 비활성화됩니다</li>
            <li>팀 멤버십이 자동으로 업데이트됩니다</li>
          </ul>
          <p style={{ marginTop: 8, color: '#ff4d4f' }}>
            <strong>주의:</strong> 이 작업은 실제 데이터를 변경합니다.
          </p>
        </div>
      ),
      okText: '동기화 실행',
      cancelText: '취소',
      onOk: async () => {
        setLoading(true);
        try {
          const response = await ldapSyncApi.triggerSync(false);
          const result = response.result;

          if (result.success) {
            const changes = [
              result.teamsCreated > 0 && `팀 ${result.teamsCreated}개 생성`,
              result.teamsDeactivated > 0 && `팀 ${result.teamsDeactivated}개 비활성화`,
              result.usersDeactivated > 0 && `사용자 ${result.usersDeactivated}명 비활성화`,
              result.teamMembershipsUpdated > 0 && `팀 멤버십 ${result.teamMembershipsUpdated}건 업데이트`,
            ].filter(Boolean).join(', ');

            message.success(`LDAP 동기화 완료: ${changes || '변경사항 없음'}`);

            // Show details if there are changes
            if (result.teamsCreated + result.teamsDeactivated + result.usersDeactivated > 0) {
              Modal.info({
                title: '동기화 상세 결과',
                width: 600,
                content: (
                  <div>
                    {result.details.teamsCreated.length > 0 && (
                      <>
                        <p><strong>생성된 팀:</strong></p>
                        <ul>{result.details.teamsCreated.map((name: string, idx: number) => <li key={idx}>{name}</li>)}</ul>
                      </>
                    )}
                    {result.details.teamsDeactivated.length > 0 && (
                      <>
                        <p><strong>비활성화된 팀:</strong></p>
                        <ul>{result.details.teamsDeactivated.map((name: string, idx: number) => <li key={idx}>{name}</li>)}</ul>
                      </>
                    )}
                    {result.details.usersDeactivated.length > 0 && (
                      <>
                        <p><strong>비활성화된 사용자:</strong></p>
                        <ul>{result.details.usersDeactivated.map((name: string, idx: number) => <li key={idx}>{name}</li>)}</ul>
                      </>
                    )}
                  </div>
                ),
              });
            }
          } else {
            message.error('LDAP 동기화 실패');
            if (result.errors.length > 0) {
              console.error('동기화 오류:', result.errors);
            }
          }

          fetchData();
        } catch (error: any) {
          message.error('LDAP 동기화 실패: ' + error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleSyncUserLDAP = async (user: User) => {
    try {
      const result = await userApi.syncFromLDAP(user.id);
      message.success(`${user.displayName}님의 LDAP 정보가 동기화되었습니다`);
      fetchData();
    } catch (error: any) {
      message.error('LDAP 동기화 실패: ' + error.message);
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'red';
      case UserRole.PO:
        return 'purple';
      case UserRole.PM:
        return 'blue';
      case UserRole.MEMBER:
        return 'green';
      default:
        return 'default';
    }
  };

  const getRoleText = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return '최고 관리자';
      case UserRole.PO:
        return 'PO (프로젝트 책임자)';
      case UserRole.PM:
        return 'PM (프로젝트 관리자)';
      case UserRole.MEMBER:
        return '일반 사용자';
      default:
        return role;
    }
  };

  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return '-';

    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Format based on length
    if (cleaned.length === 11) {
      // 010-0000-0000
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      // 010-000-0000 or 02-0000-0000
      if (cleaned.startsWith('02')) {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
      } else {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
    } else if (cleaned.length === 9) {
      // 02-000-0000
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
    }

    // Return as-is if format doesn't match
    return phone;
  };

  const handleViewMessage = (user: User) => {
    setSelectedUser(user);
    setMessageModalVisible(true);
  };

  const truncateMessage = (message: string | null | undefined, maxLength: number = 30) => {
    if (!message) return '';
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const pendingColumns = [
    {
      title: '사용자명',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '표시명',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '가입일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('ko-KR'),
    },
    {
      title: '승인 요청일',
      dataIndex: 'approvalRequestedAt',
      key: 'approvalRequestedAt',
      width: 130,
      render: (date: string | null) =>
        date ? new Date(date).toLocaleDateString('ko-KR') : '-',
    },
    {
      title: '요청 메시지',
      key: 'approvalMessage',
      width: 200,
      render: (_: any, record: User) => {
        if (!record.approvalRequested) {
          return <Tag color="default">승인 요청 전</Tag>;
        }
        if (!record.approvalMessage) {
          return <Tag color="default">메시지 없음</Tag>;
        }
        return (
          <Button
            type="link"
            onClick={() => handleViewMessage(record)}
            style={{ padding: 0, height: 'auto' }}
          >
            {truncateMessage(record.approvalMessage)}
          </Button>
        );
      },
    },
    {
      title: '작업',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleVerify(record)}
          >
            승인
          </Button>
          <Popconfirm
            title="정말 거부하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button danger icon={<CloseOutlined />}>
              거부
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const userColumns = [
    {
      title: '사용자명',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: User) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
          {record.ldapDn && <Tag color="blue">LDAP</Tag>}
        </Space>
      ),
    },
    {
      title: '표시명',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '전화번호',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      render: (phone: string | null) => formatPhoneNumber(phone),
    },
    {
      title: '권한',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => (
        <Tag color={getRoleColor(role)}>{getRoleText(role)}</Tag>
      ),
    },
    {
      title: '소속팀',
      dataIndex: 'Team',
      key: 'team',
      render: (team: Team | undefined) =>
        team ? (
          <Tag icon={<TeamOutlined />} color="green">
            {team.name}
          </Tag>
        ) : (
          <Tag color="default">미배정</Tag>
        ),
    },
    {
      title: '상태',
      key: 'status',
      render: (_: any, record: User) => (
        <Space>
          {record.isVerified ? (
            <Tag color="success">승인됨</Tag>
          ) : (
            <Tag color="warning">대기중</Tag>
          )}
          {record.isActive ? (
            <Tag color="processing">활성</Tag>
          ) : (
            <Tag color="default">비활성</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>회원 관리</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleSyncAllLDAP}
            loading={loading}
          >
            LDAP 사용자 동기화
          </Button>
        }
      >
        <Tabs
          defaultActiveKey="all"
          items={[
            {
              key: 'all',
              label: '전체 회원',
              children: (
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  loading={loading}
                  expandable={{
                    expandedRowRender: (record: User) => (
                      <Descriptions bordered size="small">
                        <Descriptions.Item label="사용자 ID" span={3}>
                          {record.id}
                        </Descriptions.Item>
                        {record.ldapDn && (
                          <Descriptions.Item label="LDAP DN" span={3}>
                            {record.ldapDn}
                          </Descriptions.Item>
                        )}
                        <Descriptions.Item label="가입일" span={1.5}>
                          {new Date(record.createdAt).toLocaleString('ko-KR')}
                        </Descriptions.Item>
                        <Descriptions.Item label="수정일" span={1.5}>
                          {new Date(record.updatedAt).toLocaleString('ko-KR')}
                        </Descriptions.Item>
                      </Descriptions>
                    ),
                  }}
                />
              ),
            },
            {
              key: 'pending',
              label: (
                <Badge count={pendingUsers.length} offset={[10, 0]}>
                  <span>승인 대기</span>
                </Badge>
              ),
              children: (
                <Table
                  columns={pendingColumns}
                  dataSource={pendingUsers}
                  rowKey="id"
                  loading={loading}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="사용자 승인"
        open={verifyModalVisible}
        onOk={handleVerifySubmit}
        onCancel={() => setVerifyModalVisible(false)}
        okText="승인"
        cancelText="취소"
      >
        {selectedUser && (
          <>
            <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="사용자명" span={3}>
                {selectedUser.username}
              </Descriptions.Item>
              <Descriptions.Item label="표시명" span={3}>
                {selectedUser.displayName}
              </Descriptions.Item>
              <Descriptions.Item label="이메일" span={3}>
                {selectedUser.email}
              </Descriptions.Item>
              {selectedUser.Team && (
                <Descriptions.Item label="소속팀" span={3}>
                  <Tag icon={<TeamOutlined />} color="green">
                    {selectedUser.Team.name}
                  </Tag>
                  <span style={{ marginLeft: 8, color: '#999' }}>
                    (LDAP에서 자동 할당)
                  </span>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Form form={verifyForm} layout="vertical">
              <Form.Item
                name="role"
                label="권한"
                rules={[{ required: true, message: '권한을 선택하세요' }]}
              >
                <Select placeholder="권한 선택">
                  <Option value={UserRole.ADMIN}>최고 관리자</Option>
                  <Option value={UserRole.PO}>PO (프로젝트 책임자)</Option>
                  <Option value={UserRole.PM}>PM (프로젝트 관리자)</Option>
                  <Option value={UserRole.MEMBER}>일반 사용자</Option>
                </Select>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title="사용자 정보 수정"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        okText="저장"
        cancelText="취소"
      >
        {selectedUser && (
          <>
            <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="사용자명" span={3}>
                {selectedUser.username}
              </Descriptions.Item>
              <Descriptions.Item label="이메일" span={3}>
                {selectedUser.email}
              </Descriptions.Item>
            </Descriptions>
            <Form form={editForm} layout="vertical">
              <Form.Item
                name="role"
                label="권한"
                rules={[{ required: true, message: '권한을 선택하세요' }]}
              >
                <Select>
                  <Option value={UserRole.ADMIN}>최고 관리자</Option>
                  <Option value={UserRole.PO}>PO (프로젝트 책임자)</Option>
                  <Option value={UserRole.PM}>PM (프로젝트 관리자)</Option>
                  <Option value={UserRole.MEMBER}>일반 사용자</Option>
                </Select>
              </Form.Item>
              <Form.Item name="teamId" label="소속팀">
                <Select placeholder="팀 선택" allowClear>
                  {teams.map((team) => (
                    <Option key={team.id} value={team.id}>
                      {team.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="isActive"
                label="활성 상태"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value={true}>활성</Option>
                  <Option value={false}>비활성</Option>
                </Select>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* 승인 요청 메시지 모달 */}
      <Modal
        title="승인 요청 메시지"
        open={messageModalVisible}
        onCancel={() => {
          setMessageModalVisible(false);
          setSelectedUser(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setMessageModalVisible(false);
              setSelectedUser(null);
            }}
          >
            닫기
          </Button>,
        ]}
        width={600}
      >
        {selectedUser && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="사용자명">
                {selectedUser.username}
              </Descriptions.Item>
              <Descriptions.Item label="표시명">
                {selectedUser.displayName}
              </Descriptions.Item>
              <Descriptions.Item label="이메일">
                {selectedUser.email}
              </Descriptions.Item>
              <Descriptions.Item label="승인 요청일">
                {selectedUser.approvalRequestedAt
                  ? new Date(selectedUser.approvalRequestedAt).toLocaleString('ko-KR')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>요청 메시지:</div>
              <div
                style={{
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  minHeight: '80px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {selectedUser.approvalMessage || '메시지가 없습니다.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
