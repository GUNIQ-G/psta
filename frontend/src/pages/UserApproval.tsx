import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Tag,
  Modal,
  Descriptions,
  Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import axiosInstance from '../api/axios';
import type { ColumnsType } from 'antd/es/table';

interface PendingUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  ldapDn?: string;
  role: string;
  title?: string;
  position?: string;
  isVerified: boolean;
  approvalRequested: boolean;
  approvalRequestedAt?: string;
  approvalMessage?: string;
  createdAt: string;
}

export const UserApproval: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/users/pending-approval');
      setUsers(response.data);
    } catch (error: any) {
      message.error('사용자 목록 조회 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, username: string) => {
    try {
      await axiosInstance.post(`/users/${userId}/approve`);
      message.success(`${username} 사용자가 승인되었습니다`);
      fetchPendingUsers();
    } catch (error: any) {
      message.error('승인 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleReject = async (userId: string, username: string) => {
    try {
      await axiosInstance.post(`/users/${userId}/reject`);
      message.success(`${username} 사용자의 승인 요청이 거부되었습니다`);
      fetchPendingUsers();
    } catch (error: any) {
      message.error('거부 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const showDetail = (user: PendingUser) => {
    setSelectedUser(user);
    setDetailModalVisible(true);
  };

  const columns: ColumnsType<PendingUser> = [
    {
      title: '사용자명',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '이름',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '직위/직책',
      key: 'job',
      render: (_, record) => (
        <Space size={4}>
          {record.position && <Tag color="blue">{record.position}</Tag>}
          {record.title && <Tag color="cyan">{record.title}</Tag>}
          {!record.position && !record.title && <span style={{ color: '#999' }}>-</span>}
        </Space>
      ),
    },
    {
      title: '인증 방식',
      key: 'authType',
      render: (_, record) => (
        <Tag color={record.ldapDn ? 'blue' : 'default'}>
          {record.ldapDn ? 'LDAP' : 'Local'}
        </Tag>
      ),
    },
    {
      title: '상태',
      key: 'status',
      render: (_, record) => {
        if (record.isVerified) {
          return <Tag color="success" icon={<CheckCircleOutlined />}>승인 완료</Tag>;
        }
        if (record.approvalRequested) {
          return <Tag color="warning" icon={<ClockCircleOutlined />}>승인 대기</Tag>;
        }
        return <Tag color="default">미요청</Tag>;
      },
    },
    {
      title: '요청일시',
      dataIndex: 'approvalRequestedAt',
      key: 'approvalRequestedAt',
      render: (date: string) => (date ? new Date(date).toLocaleString('ko-KR') : '-'),
    },
    {
      title: '가입일시',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('ko-KR'),
    },
    {
      title: '작업',
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => showDetail(record)}>
            상세
          </Button>
          {!record.isVerified && record.approvalRequested && (
            <>
              <Popconfirm
                title="사용자 승인"
                description={`${record.displayName} 사용자를 승인하시겠습니까?`}
                onConfirm={() => handleApprove(record.id, record.username)}
                okText="승인"
                cancelText="취소"
              >
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}>
                  승인
                </Button>
              </Popconfirm>
              <Popconfirm
                title="승인 거부"
                description={`${record.displayName} 사용자의 승인 요청을 거부하시겠습니까?`}
                onConfirm={() => handleReject(record.id, record.username)}
                okText="거부"
                cancelText="취소"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<CloseCircleOutlined />}>
                  거부
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>사용자 승인 관리</span>
          </Space>
        }
        extra={
          <Button onClick={fetchPendingUsers} loading={loading}>
            새로고침
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `전체 ${total}명`,
          }}
        />
      </Card>

      <Modal
        title="사용자 상세 정보"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            닫기
          </Button>,
          selectedUser && !selectedUser.isVerified && selectedUser.approvalRequested && (
            <>
              <Popconfirm
                key="approve"
                title="사용자 승인"
                description={`${selectedUser.displayName} 사용자를 승인하시겠습니까?`}
                onConfirm={() => {
                  handleApprove(selectedUser.id, selectedUser.username);
                  setDetailModalVisible(false);
                }}
                okText="승인"
                cancelText="취소"
              >
                <Button type="primary" icon={<CheckCircleOutlined />}>
                  승인
                </Button>
              </Popconfirm>
              <Popconfirm
                key="reject"
                title="승인 거부"
                description={`${selectedUser.displayName} 사용자의 승인 요청을 거부하시겠습니까?`}
                onConfirm={() => {
                  handleReject(selectedUser.id, selectedUser.username);
                  setDetailModalVisible(false);
                }}
                okText="거부"
                cancelText="취소"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<CloseCircleOutlined />}>
                  거부
                </Button>
              </Popconfirm>
            </>
          ),
        ]}
        width={700}
      >
        {selectedUser && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="사용자명">{selectedUser.username}</Descriptions.Item>
            <Descriptions.Item label="이름">{selectedUser.displayName}</Descriptions.Item>
            <Descriptions.Item label="이메일">{selectedUser.email}</Descriptions.Item>
            <Descriptions.Item label="역할">{selectedUser.role}</Descriptions.Item>
            <Descriptions.Item label="직위/직책">
              <Space size={4}>
                {selectedUser.position && <Tag color="blue">{selectedUser.position}</Tag>}
                {selectedUser.title && <Tag color="cyan">{selectedUser.title}</Tag>}
                {!selectedUser.position && !selectedUser.title && <Tag>없음</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="인증 방식">
              <Tag color={selectedUser.ldapDn ? 'blue' : 'default'}>
                {selectedUser.ldapDn ? 'LDAP' : 'Local'}
              </Tag>
            </Descriptions.Item>
            {selectedUser.ldapDn && (
              <Descriptions.Item label="LDAP DN">{selectedUser.ldapDn}</Descriptions.Item>
            )}
            <Descriptions.Item label="승인 상태">
              {selectedUser.isVerified ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>승인 완료</Tag>
              ) : selectedUser.approvalRequested ? (
                <Tag color="warning" icon={<ClockCircleOutlined />}>승인 대기</Tag>
              ) : (
                <Tag color="default">미요청</Tag>
              )}
            </Descriptions.Item>
            {selectedUser.approvalRequestedAt && (
              <Descriptions.Item label="승인 요청일시">
                {new Date(selectedUser.approvalRequestedAt).toLocaleString('ko-KR')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="가입일시">
              {new Date(selectedUser.createdAt).toLocaleString('ko-KR')}
            </Descriptions.Item>
            {selectedUser.approvalMessage && (
              <Descriptions.Item label="요청 메시지">
                <div style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                  {selectedUser.approvalMessage}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
