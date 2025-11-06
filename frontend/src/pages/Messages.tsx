import React, { useState, useEffect } from 'react';
import {
  Typography,
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message as antdMessage,
  Tag,
  Space,
  Popconfirm,
  Progress,
} from 'antd';
import {
  MailOutlined,
  SendOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  LinkOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMessageStore } from '../store/messageStore';
import { Message, User } from '../types';
import { userApi } from '../api/user';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const Messages: React.FC = () => {
  const [activeTab, setActiveTab] = useState('received');
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [form] = Form.useForm();

  const {
    receivedMessages,
    sentMessages,
    unreadCount,
    isLoading,
    fetchReceivedMessages,
    fetchSentMessages,
    fetchUnreadCount,
    sendMessage,
    markAsRead,
    deleteMessage,
    startPolling,
    stopPolling,
  } = useMessageStore();

  useEffect(() => {
    fetchReceivedMessages();
    fetchSentMessages();
    fetchUnreadCount();
    startPolling();

    return () => stopPolling();
  }, []);

  useEffect(() => {
    // 사용자 목록 조회
    const loadUsers = async () => {
      try {
        const userList = await userApi.getAll();
        setUsers(userList);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    loadUsers();
  }, []);

  const handleViewMessage = async (msg: Message) => {
    setSelectedMessage(msg);
    setViewModalOpen(true);

    // 받은 메시지이고 읽지 않았다면 읽음 처리
    if (activeTab === 'received' && !msg.isRead) {
      await markAsRead(msg.id);
      fetchReceivedMessages();
    }
  };

  const handleComposeSubmit = async (values: any) => {
    try {
      await sendMessage({
        toUserId: values.toUserId,
        subject: values.subject,
        content: values.content,
      });
      antdMessage.success('메시지가 전송되었습니다');
      setComposeModalOpen(false);
      form.resetFields();
      fetchSentMessages();
    } catch (error: any) {
      antdMessage.error('메시지 전송 실패: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage(id);
      antdMessage.success('메시지가 삭제되었습니다');
      if (activeTab === 'received') {
        fetchReceivedMessages();
      } else {
        fetchSentMessages();
      }
    } catch (error: any) {
      antdMessage.error('삭제 실패: ' + error.message);
    }
  };

  // 메시지 내용 렌더링 (PSTA 스타일로 항목 정보와 링크 버튼 표시)
  const renderMessageContent = (content: string) => {
    const parts: React.ReactNode[] = [];
    let processedContent = content;

    // [ITEM_INFO] 파싱
    const itemInfoRegex = /\[ITEM_INFO\](.*?)\[\/ITEM_INFO\]/;
    const itemInfoMatch = processedContent.match(itemInfoRegex);

    if (itemInfoMatch) {
      const [typeLabel, statusLabel, itemName, assignee, dateRange, progressStr] = itemInfoMatch[1].split('|');
      const progress = parseInt(progressStr) || 0;

      // ITEM_INFO 앞의 내용 (댓글 내용)
      const beforeItemInfo = processedContent.substring(0, itemInfoMatch.index);

      // ITEM_INFO를 PSTA 스타일 컴포넌트로 교체
      const itemInfoComponent = (
        <div
          key="item-info"
          style={{
            marginTop: 16,
            marginBottom: 12,
            padding: '12px 16px',
            border: '1px solid #f0f0f0',
            borderRadius: '6px',
            backgroundColor: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* 좌측 그룹: 업무계층, 상태, PSTA 명 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <Tag
              color={
                typeLabel === '프로젝트' ? 'purple' :
                typeLabel === '서비스' ? 'blue' :
                typeLabel === '팀' ? 'green' : 'orange'
              }
              style={{ margin: 0, fontSize: '11px', padding: '2px 6px' }}
            >
              {typeLabel}
            </Tag>
            <Tag
              color={
                statusLabel === '완료' ? 'success' :
                statusLabel === '진행중' ? 'processing' :
                statusLabel === '대기' ? 'warning' : 'default'
              }
              style={{ margin: 0, fontSize: '11px' }}
            >
              {statusLabel}
            </Tag>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{itemName}</div>
          </div>

          {/* 우측 그룹: 담당자, 진행일정, 진행률 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '12px', color: '#595959', minWidth: '80px', textAlign: 'right' }}>
              {assignee}
            </div>
            <div style={{ fontSize: '12px', color: '#595959', minWidth: '150px', textAlign: 'right' }}>
              {dateRange}
            </div>
            <Progress
              type="circle"
              percent={progress}
              size={40}
              strokeWidth={6}
              format={(percent) => (
                <span style={{ fontSize: '10px', fontWeight: 600 }}>
                  {percent}%
                </span>
              )}
            />
          </div>
        </div>
      );

      parts.push(beforeItemInfo);
      parts.push(itemInfoComponent);

      // ITEM_INFO 뒤의 내용 처리
      processedContent = processedContent.substring(itemInfoMatch.index! + itemInfoMatch[0].length);
    }

    // [LINK] 파싱
    const linkRegex = /\[LINK\](.*?)\[\/LINK\]/;
    const linkMatch = processedContent.match(linkRegex);

    if (linkMatch) {
      const beforeLink = processedContent.substring(0, linkMatch.index);
      if (beforeLink && beforeLink.trim()) {
        parts.push(beforeLink);
      }

      const url = linkMatch[1];
      const linkButton = (
        <div key="link-button" style={{ marginTop: 12, textAlign: 'center' }}>
          <Button
            type="primary"
            icon={<RightOutlined />}
            onClick={() => window.location.href = url}
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            해당 페이지 이동하기
          </Button>
        </div>
      );

      parts.push(linkButton);

      const afterLink = processedContent.substring(linkMatch.index! + linkMatch[0].length);
      if (afterLink && afterLink.trim()) {
        parts.push(afterLink);
      }
    } else if (processedContent.trim()) {
      parts.push(processedContent);
    }

    return parts.length > 0 ? parts : content;
  };

  const receivedColumns: ColumnsType<Message> = [
    {
      title: '상태',
      dataIndex: 'isRead',
      key: 'isRead',
      width: 100,
      render: (isRead: boolean, record: Message) => (
        <Space direction="vertical" size={0}>
          <Tag color={isRead ? 'success' : 'blue'}>{isRead ? '읽음' : '안읽음'}</Tag>
          {isRead && record.readAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(record.readAt).toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '보낸 사람',
      dataIndex: ['FromUser', 'displayName'],
      key: 'from',
      width: 150,
    },
    {
      title: '제목',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: string, record: Message) => (
        <a onClick={() => handleViewMessage(record)} style={{ fontWeight: !record.isRead ? 600 : 400 }}>
          {subject}
        </a>
      ),
    },
    {
      title: '보낸 날짜',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) =>
        new Date(date).toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      render: (_, record: Message) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewMessage(record)}
          />
          <Popconfirm
            title="삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="text" icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sentColumns: ColumnsType<Message> = [
    {
      title: '읽음 상태',
      dataIndex: 'isRead',
      key: 'isRead',
      width: 100,
      render: (isRead: boolean, record: Message) => (
        <Space direction="vertical" size={0}>
          <Tag color={isRead ? 'success' : 'default'}>{isRead ? '읽음' : '안읽음'}</Tag>
          {isRead && record.readAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(record.readAt).toLocaleString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '받는 사람',
      dataIndex: ['ToUser', 'displayName'],
      key: 'to',
      width: 150,
    },
    {
      title: '제목',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: string, record: Message) => (
        <a onClick={() => handleViewMessage(record)}>{subject}</a>
      ),
    },
    {
      title: '보낸 날짜',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) =>
        new Date(date).toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      render: (_, record: Message) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewMessage(record)}
          />
          <Popconfirm
            title="삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="text" icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>
          <Space>
            <MailOutlined />
            메시지함
            {unreadCount > 0 && (
              <Tag color="red" style={{ fontSize: 14 }}>
                {unreadCount}개 안읽음
              </Tag>
            )}
          </Space>
        </Title>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => setComposeModalOpen(true)}
        >
          메시지 작성
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'received',
            label: (
              <span>
                <MailOutlined />
                받은 메시지 ({receivedMessages.length})
              </span>
            ),
            children: (
              <Table
                columns={receivedColumns}
                dataSource={receivedMessages}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'sent',
            label: (
              <span>
                <SendOutlined />
                보낸 메시지 ({sentMessages.length})
              </span>
            ),
            children: (
              <Table
                columns={sentColumns}
                dataSource={sentMessages}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />

      {/* 메시지 작성 모달 */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            메시지 작성
          </Space>
        }
        open={composeModalOpen}
        onCancel={() => {
          setComposeModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleComposeSubmit}>
          <Form.Item
            label="받는 사람"
            name="toUserId"
            rules={[{ required: true, message: '받는 사람을 선택하세요' }]}
          >
            <Select
              showSearch
              placeholder="받는 사람 선택"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={users.map((user) => ({
                value: user.id,
                label: `${user.displayName} (${user.username})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="제목"
            name="subject"
            rules={[{ required: true, message: '제목을 입력하세요' }]}
          >
            <Input placeholder="제목" />
          </Form.Item>

          <Form.Item
            label="내용"
            name="content"
            rules={[{ required: true, message: '내용을 입력하세요' }]}
          >
            <TextArea rows={8} placeholder="메시지 내용" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setComposeModalOpen(false);
                form.resetFields();
              }}>
                취소
              </Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                전송
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 메시지 보기 모달 */}
      <Modal
        title={
          <Space>
            <MailOutlined />
            메시지 상세
          </Space>
        }
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setSelectedMessage(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setViewModalOpen(false);
              setSelectedMessage(null);
            }}
          >
            닫기
          </Button>,
        ]}
        width={700}
      >
        {selectedMessage && (
          <div>
            <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>보낸 사람: </Text>
                <Text>{selectedMessage.FromUser?.displayName} ({selectedMessage.FromUser?.username})</Text>
              </div>
              {activeTab === 'sent' && (
                <div style={{ marginBottom: 8 }}>
                  <Text strong>받는 사람: </Text>
                  <Text>{selectedMessage.ToUser?.displayName} ({selectedMessage.ToUser?.username})</Text>
                </div>
              )}
              <div style={{ marginBottom: 8 }}>
                <Text strong>보낸 날짜: </Text>
                <Text>
                  {new Date(selectedMessage.createdAt).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text strong>읽음 상태: </Text>
                <Tag color={selectedMessage.isRead ? 'success' : (activeTab === 'sent' ? 'default' : 'blue')}>
                  {selectedMessage.isRead ? '읽음' : '안읽음'}
                </Tag>
                {selectedMessage.isRead && selectedMessage.readAt && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    ({new Date(selectedMessage.readAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })})
                  </Text>
                )}
              </div>
              <div>
                <Text strong>제목: </Text>
                <Text>{selectedMessage.subject}</Text>
              </div>
            </div>

            <div style={{ padding: 16, border: '1px solid #d9d9d9', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
              {renderMessageContent(selectedMessage.content)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
