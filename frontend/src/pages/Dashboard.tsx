import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Tag, Space, message, Badge, Progress, Modal, Descriptions, Divider, Button, Popconfirm, Table, List, Avatar, Mentions, Popover, Input, Upload } from 'antd';
import { ProjectOutlined, TeamOutlined, CheckCircleOutlined, ClockCircleOutlined, PauseCircleOutlined, CalendarOutlined, FolderOutlined, AppstoreOutlined, UserOutlined, BellOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, ArrowRightOutlined, MessageOutlined, FileOutlined, LinkOutlined, DownloadOutlined, SendOutlined, SmileOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { workRequestsApi } from '../api/work-requests';
import { commentsApi } from '../api/comments';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';
import { Item, ItemStatus, WorkRequest, WorkRequestPriority, WorkRequestStatus, Comment, FileAttachment, Link, User } from '../types';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { ItemFormModal } from '../components/ItemFormModal';

const { Title, Text } = Typography;

interface TaskWithHierarchy extends Item {
  projectName?: string | null;
  serviceName?: string | null;
  teamName?: string | null;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [myTasks, setMyTasks] = useState<TaskWithHierarchy[]>([]);
  const [myWorkRequests, setMyWorkRequests] = useState<WorkRequest[]>([]);
  const [assignedWorkRequests, setAssignedWorkRequests] = useState<WorkRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [workRequestsLoading, setWorkRequestsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithHierarchy | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState<Array<{ type: 'file' | 'link', data: FileAttachment | Link }>>([]);
  const user = useAuthStore((state) => state.user);
  const { unreadCount, notifications } = useNotificationStore();

  useEffect(() => {
    if (user) {
      fetchMyTasks();
      fetchMyWorkRequests();
      fetchAssignedWorkRequests();
      fetchClientsAndUsers();
    }
  }, [user]);

  const fetchClientsAndUsers = async () => {
    try {
      const [clientsData, usersData] = await Promise.all([
        clientsApi.getClients(),
        userApi.getAll(),
      ]);
      setClients(clientsData);
      setUsers(usersData);
    } catch (error: any) {
      console.error('Failed to fetch clients or users:', error);
    }
  };

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const tasks = await itemsApi.getMyTasks();
      console.log('===== MyTasks Data =====');
      console.log('First task:', tasks[0]);
      console.log('First task _count:', tasks[0]?._count);
      console.log('========================');
      setMyTasks(tasks as TaskWithHierarchy[]);
    } catch (error: any) {
      message.error('작업 조회 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyWorkRequests = async () => {
    setWorkRequestsLoading(true);
    try {
      const workRequests = await workRequestsApi.getMyWorkRequests();
      setMyWorkRequests(workRequests);
    } catch (error: any) {
      message.error('작업 요청 조회 실패: ' + error.message);
    } finally {
      setWorkRequestsLoading(false);
    }
  };

  const fetchAssignedWorkRequests = async () => {
    setWorkRequestsLoading(true);
    try {
      const workRequests = await workRequestsApi.getAssignedWorkRequests();
      setAssignedWorkRequests(workRequests);
    } catch (error: any) {
      message.error('할당된 작업 요청 조회 실패: ' + error.message);
    } finally {
      setWorkRequestsLoading(false);
    }
  };

  const getStatusColor = (status: ItemStatus) => {
    switch (status) {
      case ItemStatus.IN_PROGRESS:
        return '#1890ff';
      case ItemStatus.COMPLETED:
        return '#52c41a';
      case ItemStatus.ON_HOLD:
        return '#faad14';
      case ItemStatus.NOT_STARTED:
        return '#8c8c8c';
      default:
        return '#8c8c8c';
    }
  };

  const getStatusText = (status: ItemStatus) => {
    switch (status) {
      case ItemStatus.IN_PROGRESS:
        return '진행중';
      case ItemStatus.COMPLETED:
        return '완료';
      case ItemStatus.ON_HOLD:
        return '보류';
      case ItemStatus.NOT_STARTED:
        return '시작 전';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const getPriorityLabel = (priority: WorkRequestPriority): string => {
    switch (priority) {
      case WorkRequestPriority.LOW: return '낮음';
      case WorkRequestPriority.MEDIUM: return '보통';
      case WorkRequestPriority.HIGH: return '높음';
      case WorkRequestPriority.URGENT: return '긴급';
      default: return priority;
    }
  };

  const getPriorityColor = (priority: WorkRequestPriority): string => {
    switch (priority) {
      case WorkRequestPriority.LOW: return 'green';
      case WorkRequestPriority.MEDIUM: return 'blue';
      case WorkRequestPriority.HIGH: return 'orange';
      case WorkRequestPriority.URGENT: return 'red';
      default: return 'default';
    }
  };

  const getWorkRequestStatusLabel = (wr: WorkRequest): string => {
    // 액션이 생성된 경우 액션의 상태를 표시
    if (wr.Action) {
      switch (wr.Action.status) {
        case ItemStatus.NOT_STARTED: return '시작 전';
        case ItemStatus.IN_PROGRESS: return '진행중';
        case ItemStatus.COMPLETED: return '완료';
        case ItemStatus.ON_HOLD: return '보류';
        default: return wr.Action.status;
      }
    }

    // 액션 생성 전 워크플로우 상태
    if (wr.isRecalled) return '회수됨';
    if (wr.isApproved) return '승인됨';

    // 작업 요청의 기본 상태
    switch (wr.status) {
      case WorkRequestStatus.PENDING: return '대기중';
      case WorkRequestStatus.IN_PROGRESS: return '진행중';
      case WorkRequestStatus.COMPLETED: return '완료';
      case WorkRequestStatus.CANCELLED: return '취소됨';
      case WorkRequestStatus.REJECTED: return '반려';
      case WorkRequestStatus.IN_NEGOTIATION: return '협의중';
      default: return wr.status;
    }
  };

  const getWorkRequestStatusColor = (wr: WorkRequest): string => {
    // 액션이 생성된 경우 액션의 상태 색상
    if (wr.Action) {
      return getStatusColor(wr.Action.status);
    }

    // 액션 생성 전 워크플로우 상태 색상
    if (wr.isRecalled) return 'warning';
    if (wr.isApproved) return 'success';

    // 작업 요청의 기본 상태 색상
    switch (wr.status) {
      case WorkRequestStatus.PENDING: return 'default';
      case WorkRequestStatus.IN_PROGRESS: return 'processing';
      case WorkRequestStatus.COMPLETED: return 'success';
      case WorkRequestStatus.CANCELLED: return 'error';
      case WorkRequestStatus.REJECTED: return 'error';
      case WorkRequestStatus.IN_NEGOTIATION: return 'warning';
      default: return 'default';
    }
  };

  const handleWorkRequestClick = (workRequest: WorkRequest) => {
    // 항상 작업 요청 페이지의 상세 모달로 이동
    navigate(`/requests?workRequestId=${workRequest.id}`);
  };

  // 내 작업 요청 테이블 컬럼
  const myWorkRequestColumns: ColumnsType<WorkRequest> = [
    {
      title: '우선순위',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (priority: WorkRequestPriority) => (
        <Tag color={getPriorityColor(priority)} style={{ margin: 0 }}>
          {getPriorityLabel(priority)}
        </Tag>
      ),
    },
    {
      title: '상태',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={getWorkRequestStatusColor(record)} style={{ margin: 0 }}>
          {getWorkRequestStatusLabel(record)}
        </Tag>
      ),
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <Text strong>{title}</Text>,
    },
    {
      title: '담당자',
      key: 'assignee',
      width: 120,
      render: (_, record) => (
        record.Assignee ? (
          <Text>{record.Assignee.displayName}</Text>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: '마감일',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 100,
      render: (dueDate: string | undefined) => (
        <Text type="secondary">{formatDate(dueDate)}</Text>
      ),
    },
  ];

  // 할당된 작업 요청 테이블 컬럼
  const assignedWorkRequestColumns: ColumnsType<WorkRequest> = [
    {
      title: '우선순위',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (priority: WorkRequestPriority) => (
        <Tag color={getPriorityColor(priority)} style={{ margin: 0 }}>
          {getPriorityLabel(priority)}
        </Tag>
      ),
    },
    {
      title: '상태',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={getWorkRequestStatusColor(record)} style={{ margin: 0 }}>
          {getWorkRequestStatusLabel(record)}
        </Tag>
      ),
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <Text strong>{title}</Text>,
    },
    {
      title: '요청자',
      key: 'requester',
      width: 120,
      render: (_, record) => (
        record.Requester ? (
          <Text>{record.Requester.displayName}</Text>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: '마감일',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 100,
      render: (dueDate: string | undefined) => (
        <Text type="secondary">{formatDate(dueDate)}</Text>
      ),
    },
  ];

  const fetchComments = async (itemId: string) => {
    try {
      const data = await commentsApi.getCommentsByItem(itemId);
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const loadRelatedDocuments = async (itemId: string) => {
    try {
      const { files: hierarchicalFiles, links: hierarchicalLinks } = await filesApi.getHierarchicalDocuments(itemId);

      // Combine files and links into a single array with type indicator
      const combined: Array<{ type: 'file' | 'link', data: FileAttachment | Link }> = [
        ...hierarchicalFiles.map(f => ({ type: 'file' as const, data: f })),
        ...hierarchicalLinks.map(l => ({ type: 'link' as const, data: l })),
      ];

      // Sort by createdAt descending (most recent first)
      combined.sort((a, b) => {
        const dateA = new Date(a.data.createdAt).getTime();
        const dateB = new Date(b.data.createdAt).getTime();
        return dateB - dateA;
      });

      setRelatedDocs(combined);
    } catch (error) {
      console.error('Failed to load related documents:', error);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTask || !commentContent.trim()) return;

    try {
      await commentsApi.createComment(selectedTask.id, commentContent.trim());
      setCommentContent('');
      await fetchComments(selectedTask.id);
      message.success('댓글이 추가되었습니다');
    } catch (error: any) {
      message.error('댓글 추가 실패: ' + error.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedTask) return;

    try {
      await commentsApi.deleteComment(commentId);
      await fetchComments(selectedTask.id);
      message.success('댓글이 삭제되었습니다');
    } catch (error: any) {
      message.error('댓글 삭제 실패: ' + error.message);
    }
  };

  const handleReactionToggle = async (commentId: string, emoji: string) => {
    if (!selectedTask) return;

    try {
      await commentsApi.toggleReaction(commentId, emoji);
      await fetchComments(selectedTask.id);
    } catch (error: any) {
      message.error('반응 추가/제거에 실패했습니다.');
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setCommentContent(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleDeleteRelatedDoc = async (docType: 'file' | 'link', docId: string) => {
    try {
      if (docType === 'file') {
        await filesApi.deleteFile(docId);
        message.success('파일이 삭제되었습니다.');
      } else {
        await linksApi.deleteLink(docId);
        message.success('링크가 삭제되었습니다.');
      }
      if (selectedTask) {
        await loadRelatedDocuments(selectedTask.id);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || `${docType === 'file' ? '파일' : '링크'} 삭제에 실패했습니다.`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderCommentContent = (content: string) => {
    // Replace @mentions with highlighted spans (format: @[displayName](userId))
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      // Add highlighted mention
      parts.push(
        <span
          key={match.index}
          style={{
            backgroundColor: '#e6f7ff',
            color: '#1890ff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 500,
            display: 'inline-block',
            margin: '0 2px',
          }}
        >
          @{match[1]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const handleCardClick = async (task: TaskWithHierarchy) => {
    setSelectedTask(task);
    setDetailModalOpen(true);
    setCommentContent('');
    await fetchComments(task.id);
    await loadRelatedDocuments(task.id);
  };

  const handleCloseModal = () => {
    setDetailModalOpen(false);
    setSelectedTask(null);
    setComments([]);
    setCommentContent('');
    setRelatedDocs([]);
  };

  const handleEdit = () => {
    setDetailModalOpen(false);
    setEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedTask) return;

    try {
      await itemsApi.deleteItem(selectedTask.id);
      message.success('작업이 삭제되었습니다');
      setDetailModalOpen(false);
      setSelectedTask(null);
      fetchMyTasks(); // 목록 새로고침
    } catch (error: any) {
      if (error.response?.status === 403) {
        message.error('권한이 없습니다. 생성자 또는 최고관리자만 삭제할 수 있습니다.');
      } else {
        message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!selectedTask) return;

    try {
      await itemsApi.updateItem(selectedTask.id, values);
      message.success('작업이 수정되었습니다');
      setEditModalOpen(false);
      setSelectedTask(null);
      fetchMyTasks(); // 목록 새로고침
    } catch (error: any) {
      message.error('수정 실패: ' + error.message);
    }
  };

  // 현재 사용자가 해당 작업을 수정/삭제할 수 있는지 확인 (담당자 또는 ADMIN 또는 생성자)
  const canModify = (task: TaskWithHierarchy | null) => {
    if (!task || !user) return false;
    return user.role === 'ADMIN' || task.assigneeId === user.id || task.createdById === user.id;
  };

  const inProgressTasks = myTasks.filter(task => task.status === ItemStatus.IN_PROGRESS);
  const notStartedTasks = myTasks.filter(task => task.status === ItemStatus.NOT_STARTED);
  const onHoldTasks = myTasks.filter(task => task.status === ItemStatus.ON_HOLD);
  const completedTasks = myTasks.filter(task => task.status === ItemStatus.COMPLETED);

  const renderTaskCard = (task: TaskWithHierarchy) => (
    <Card
      key={task.id}
      size="small"
      style={{
        marginBottom: 12,
        borderLeft: `4px solid ${getStatusColor(task.status)}`,
        cursor: 'pointer',
      }}
      hoverable
      onClick={() => handleCardClick(task)}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Text strong style={{ fontSize: 14 }}>{task.name}</Text>

        {task.projectName && (
          <Space size="small">
            <ProjectOutlined style={{ color: '#722ed1', fontSize: 12 }} />
            <Text style={{ fontSize: 12, color: '#666' }}>{task.projectName}</Text>
          </Space>
        )}

        {task.serviceName && (
          <Space size="small">
            <AppstoreOutlined style={{ color: '#1890ff', fontSize: 12 }} />
            <Text style={{ fontSize: 12, color: '#666' }}>{task.serviceName}</Text>
          </Space>
        )}

        {task.teamName && (
          <Space size="small">
            <TeamOutlined style={{ color: '#52c41a', fontSize: 12 }} />
            <Text style={{ fontSize: 12, color: '#666' }}>{task.teamName}</Text>
          </Space>
        )}

        <div style={{ marginTop: 8 }}>
          <Progress
            percent={task.progress}
            size="small"
            strokeColor={getStatusColor(task.status)}
            showInfo={true}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          {(task.startDate || task.endDate) ? (
            <Space size="small">
              <CalendarOutlined style={{ fontSize: 12, color: '#999' }} />
              <Text style={{ fontSize: 12, color: '#999' }}>
                {formatDate(task.startDate)} ~ {formatDate(task.endDate)}
              </Text>
            </Space>
          ) : (
            <div />
          )}

          <Space size={8}>
            {/* 댓글 개수 */}
            <Space size={2}>
              <MessageOutlined style={{ fontSize: 12, color: '#1890ff' }} />
              <Text style={{ fontSize: 12, color: '#1890ff', fontWeight: 500 }}>
                {task._count?.Comment || 0}
              </Text>
            </Space>

            {/* 파일 개수 */}
            <Space size={2}>
              <FileOutlined style={{ fontSize: 12, color: '#52c41a' }} />
              <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 500 }}>
                {(task._count?.File || 0) + (task._count?.Link || 0)}
              </Text>
            </Space>
          </Space>
        </div>
      </Space>
    </Card>
  );

  const kanbanColumnStyle = {
    background: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    minHeight: 400,
  };

  const kanbanHeaderStyle = {
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  return (
    <div>
      <Title level={2}>
        <Space>
          <TeamOutlined />
          내 작업 대시보드
        </Space>
      </Title>
      <Text type="secondary" style={{ fontSize: 14 }}>
        {user?.displayName}님의 작업 현황
      </Text>

      {/* 알림 카드 */}
      {unreadCount > 0 && (
        <Card
          style={{
            marginTop: 16,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }}
          styles={{ body: { padding: '16px 24px' } }}
        >
          <Row align="middle" justify="space-between">
            <Col>
              <Space size="middle">
                <Badge count={unreadCount} style={{ backgroundColor: '#ff4d4f' }}>
                  <BellOutlined style={{ fontSize: 32, color: '#fff' }} />
                </Badge>
                <div>
                  <Title level={4} style={{ color: '#fff', margin: 0 }}>
                    새로운 알림
                  </Title>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
                    {unreadCount}개의 읽지 않은 알림이 있습니다
                  </Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Button
                type="default"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                }}
                onClick={() => {
                  // Dispatch custom event to open notification drawer in MainLayout
                  window.dispatchEvent(new Event('openNotificationDrawer'));
                }}
              >
                확인하기
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* 작업 요청 현황 - 50:50 레이아웃 (테이블 형태) */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* 내 작업 요청 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: '#1890ff' }} />
                <span>내 작업 요청 현황</span>
                <Badge count={myWorkRequests.length} style={{ backgroundColor: '#1890ff' }} />
              </Space>
            }
          >
            <Table
              columns={myWorkRequestColumns}
              dataSource={myWorkRequests}
              rowKey="id"
              loading={workRequestsLoading}
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => handleWorkRequestClick(record),
                style: { cursor: 'pointer' },
              })}
              locale={{
                emptyText: (
                  <div style={{ padding: '40px 0' }}>
                    <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                    <div>
                      <Text type="secondary">작업 요청이 없습니다</Text>
                    </div>
                  </div>
                ),
              }}
            />
          </Card>
        </Col>

        {/* 나에게 할당된 작업 요청 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <UserOutlined style={{ color: '#52c41a' }} />
                <span>나에게 할당된 작업 요청</span>
                <Badge count={assignedWorkRequests.length} style={{ backgroundColor: '#52c41a' }} />
              </Space>
            }
          >
            <Table
              columns={assignedWorkRequestColumns}
              dataSource={assignedWorkRequests}
              rowKey="id"
              loading={workRequestsLoading}
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => handleWorkRequestClick(record),
                style: { cursor: 'pointer' },
              })}
              locale={{
                emptyText: (
                  <div style={{ padding: '40px 0' }}>
                    <UserOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                    <div>
                      <Text type="secondary">할당된 작업 요청이 없습니다</Text>
                    </div>
                  </div>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <div style={kanbanColumnStyle}>
            <div style={kanbanHeaderStyle}>
              <Space>
                <ClockCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                <Title level={5} style={{ margin: 0 }}>진행중</Title>
              </Space>
              <Badge
                count={inProgressTasks.length}
                style={{ backgroundColor: '#1890ff' }}
              />
            </div>
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              {loading ? (
                <Card loading={loading} />
              ) : inProgressTasks.length > 0 ? (
                inProgressTasks.map(renderTaskCard)
              ) : (
                <Card size="small">
                  <Text type="secondary">작업이 없습니다</Text>
                </Card>
              )}
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div style={kanbanColumnStyle}>
            <div style={kanbanHeaderStyle}>
              <Space>
                <FolderOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />
                <Title level={5} style={{ margin: 0 }}>시작 전</Title>
              </Space>
              <Badge
                count={notStartedTasks.length}
                style={{ backgroundColor: '#8c8c8c' }}
              />
            </div>
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              {loading ? (
                <Card loading={loading} />
              ) : notStartedTasks.length > 0 ? (
                notStartedTasks.map(renderTaskCard)
              ) : (
                <Card size="small">
                  <Text type="secondary">작업이 없습니다</Text>
                </Card>
              )}
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div style={kanbanColumnStyle}>
            <div style={kanbanHeaderStyle}>
              <Space>
                <PauseCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
                <Title level={5} style={{ margin: 0 }}>보류</Title>
              </Space>
              <Badge
                count={onHoldTasks.length}
                style={{ backgroundColor: '#faad14' }}
              />
            </div>
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              {loading ? (
                <Card loading={loading} />
              ) : onHoldTasks.length > 0 ? (
                onHoldTasks.map(renderTaskCard)
              ) : (
                <Card size="small">
                  <Text type="secondary">작업이 없습니다</Text>
                </Card>
              )}
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div style={kanbanColumnStyle}>
            <div style={kanbanHeaderStyle}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                <Title level={5} style={{ margin: 0 }}>완료</Title>
              </Space>
              <Badge
                count={completedTasks.length}
                style={{ backgroundColor: '#52c41a' }}
              />
            </div>
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              {loading ? (
                <Card loading={loading} />
              ) : completedTasks.length > 0 ? (
                completedTasks.map(renderTaskCard)
              ) : (
                <Card size="small">
                  <Text type="secondary">작업이 없습니다</Text>
                </Card>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* 상세 정보 모달 */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: selectedTask ? getStatusColor(selectedTask.status) : '#1890ff' }} />
            <span>작업 상세 정보</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={handleCloseModal}
        footer={[
          <Button key="close" onClick={handleCloseModal}>
            닫기
          </Button>,
          ...(canModify(selectedTask) ? [
            <Popconfirm
              key="delete"
              title="작업을 삭제하시겠습니까?"
              description="삭제된 작업은 복구할 수 없습니다."
              onConfirm={handleDelete}
              okText="삭제"
              cancelText="취소"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                삭제
              </Button>
            </Popconfirm>,
            <Button key="edit" type="primary" icon={<EditOutlined />} onClick={handleEdit}>
              수정
            </Button>
          ] : [])
        ]}
        width={1000}
      >
        {selectedTask && (
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* 왼쪽 영역 (70%) - 기본 정보 */}
            <div style={{ flex: '0 0 70%' }}>
              <Divider orientation="left">기본 정보</Divider>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="작업명" span={2}>
                <Text strong style={{ fontSize: 16 }}>{selectedTask.name}</Text>
              </Descriptions.Item>

              <Descriptions.Item label="상태">
                <Tag color={getStatusColor(selectedTask.status)}>
                  {getStatusText(selectedTask.status)}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="진행률">
                <Progress
                  percent={selectedTask.progress}
                  size="small"
                  strokeColor={getStatusColor(selectedTask.status)}
                />
              </Descriptions.Item>

              <Descriptions.Item label="시작일">
                {formatFullDate(selectedTask.startDate)}
              </Descriptions.Item>

              <Descriptions.Item label="종료일">
                {formatFullDate(selectedTask.endDate)}
              </Descriptions.Item>

              {selectedTask.User_Item_assigneeIdToUser && (
                <Descriptions.Item label="담당자" span={2}>
                  <Space>
                    <UserOutlined />
                    <Text>{selectedTask.User_Item_assigneeIdToUser.displayName}</Text>
                    <Text type="secondary">({selectedTask.User_Item_assigneeIdToUser.username})</Text>
                  </Space>
                </Descriptions.Item>
              )}

              {selectedTask.timeSpent > 0 && (
                <Descriptions.Item label="소요시간" span={2}>
                  {selectedTask.timeSpent} 시간
                </Descriptions.Item>
              )}
            </Descriptions>

            {(selectedTask.projectName || selectedTask.serviceName || selectedTask.teamName) && (
              <>
                <Divider orientation="left">계층 구조</Divider>
                <Descriptions bordered column={1} size="small">
                  {selectedTask.projectName && (
                    <Descriptions.Item label={
                      <Space>
                        <ProjectOutlined style={{ color: '#722ed1' }} />
                        <span>프로젝트</span>
                      </Space>
                    }>
                      {selectedTask.projectName}
                    </Descriptions.Item>
                  )}

                  {selectedTask.serviceName && (
                    <Descriptions.Item label={
                      <Space>
                        <AppstoreOutlined style={{ color: '#1890ff' }} />
                        <span>서비스</span>
                      </Space>
                    }>
                      {selectedTask.serviceName}
                    </Descriptions.Item>
                  )}

                  {selectedTask.teamName && (
                    <Descriptions.Item label={
                      <Space>
                        <TeamOutlined style={{ color: '#52c41a' }} />
                        <span>팀</span>
                      </Space>
                    }>
                      {selectedTask.teamName}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </>
            )}

            {selectedTask.description && (
              <>
                <Divider orientation="left">설명</Divider>
                <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>{selectedTask.description}</Text>
                </Card>
              </>
            )}

            {/* 관련 문서 섹션 */}
            <Divider orientation="left">관련 문서 (하위 항목 포함) ({relatedDocs.length})</Divider>
            {relatedDocs.length > 0 ? (
              <List
                style={{
                  maxHeight: '300px',
                  overflow: 'auto',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px'
                }}
                size="small"
                dataSource={relatedDocs}
                renderItem={(doc) => {
                  const isFile = doc.type === 'file';
                  const data = doc.data as any;
                  const canDelete = user?.role === 'ADMIN' || user?.id === (isFile ? data.uploadedById : data.createdById);

                  return (
                    <List.Item
                      style={{ padding: '8px 12px' }}
                      actions={[
                        isFile ? (
                          <Button
                            type="link"
                            size="small"
                            icon={<DownloadOutlined />}
                            href={filesApi.getFileUrl(data.filename)}
                            target="_blank"
                          >
                            다운로드
                          </Button>
                        ) : (
                          <Button
                            type="link"
                            size="small"
                            icon={<LinkOutlined />}
                            href={data.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            열기
                          </Button>
                        ),
                        canDelete && (
                          <Popconfirm
                            title={isFile ? "파일 삭제" : "링크 삭제"}
                            description={`이 ${isFile ? '파일' : '링크'}을 삭제하시겠습니까?`}
                            onConfirm={() => handleDeleteRelatedDoc(doc.type, data.id)}
                            okText="삭제"
                            cancelText="취소"
                          >
                            <Button
                              type="link"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            >
                              삭제
                            </Button>
                          </Popconfirm>
                        ),
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        avatar={
                          isFile ? (
                            <FileOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                          ) : (
                            <LinkOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                          )
                        }
                        title={
                          <Space>
                            {isFile ? data.originalName : data.displayName}
                            <span style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: isFile ? '#e6f7ff' : '#f6ffed',
                              color: isFile ? '#1890ff' : '#52c41a',
                              fontWeight: 600
                            }}>
                              {isFile ? '파일' : '링크'}
                            </span>
                          </Space>
                        }
                        description={
                          <Space size="small" style={{ fontSize: 12 }}>
                            {isFile && (
                              <>
                                <span>{formatFileSize(data.filesize)}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{isFile ? data.UploadedBy?.displayName : data.CreatedBy?.displayName || '알 수 없음'}</span>
                            <span>•</span>
                            <span>{new Date(data.createdAt).toLocaleDateString('ko-KR')}</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#bfbfbf',
                fontStyle: 'italic',
                backgroundColor: '#fafafa',
                borderRadius: '4px'
              }}>
                관련된 문서가 없습니다
              </div>
            )}
            </div>

            {/* 오른쪽 영역 (30%) - 댓글 */}
            <div style={{
              flex: '0 0 30%',
              borderLeft: '1px solid #f0f0f0',
              paddingLeft: '20px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '600px'
            }}>
              <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 12, fontWeight: 600 }}>
                댓글 ({comments.length})
              </div>

              {/* 댓글 리스트 */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
                {comments.length > 0 ? (
                  <List
                    dataSource={comments}
                    renderItem={(comment) => (
                      <List.Item
                        key={comment.id}
                        style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}
                      >
                        <List.Item.Meta
                          avatar={
                            <Avatar icon={<UserOutlined />} size="small" />
                          }
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                                  {comment.User?.displayName || '알 수 없음'}
                                </span>
                                {/* 이모티콘 반응 */}
                                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                  {(() => {
                                    const emojiConfig = [
                                      { emoji: '✅', name: '확인' },
                                      { emoji: '❤️', name: '좋아' },
                                      { emoji: '👍', name: '최고' },
                                      { emoji: '😊', name: '개웃김' },
                                      { emoji: '😠', name: '빡침' },
                                    ];

                                    try {
                                      const reactions: { [key: string]: string[] } = comment.reactions ? JSON.parse(comment.reactions) : {};
                                      const reactionsWithUsers: { [key: string]: Array<{userId: string, displayName: string}> } =
                                        comment.reactionsWithUsers ? JSON.parse(comment.reactionsWithUsers) : {};

                                      return (
                                        <>
                                          {emojiConfig.map(({ emoji, name }) => {
                                            const userIds = reactions[emoji];
                                            if (!userIds || userIds.length === 0) return null;

                                            const usersWhoReacted = reactionsWithUsers[emoji] || [];
                                            const userNames = usersWhoReacted.length > 0
                                              ? usersWhoReacted.map(u => u.displayName).join(', ')
                                              : userIds.map(id => id.substring(0, 8)).join(', ');

                                            return (
                                              <Button
                                                key={emoji}
                                                type="text"
                                                size="small"
                                                onClick={() => handleReactionToggle(comment.id, emoji)}
                                                style={{
                                                  padding: 0,
                                                  minWidth: 'auto',
                                                  height: 'auto',
                                                  fontSize: '12px',
                                                  opacity: userIds.includes(user?.id || '') ? 1 : 0.6,
                                                }}
                                              >
                                                {emoji} {userIds.length}
                                              </Button>
                                            );
                                          })}

                                          {emojiConfig.map(({ emoji, name }) => {
                                            const userIds = reactions[emoji];
                                            if (userIds && userIds.length > 0) return null;

                                            return (
                                              <Button
                                                key={emoji}
                                                type="text"
                                                size="small"
                                                onClick={() => handleReactionToggle(comment.id, emoji)}
                                                style={{
                                                  padding: 0,
                                                  minWidth: 'auto',
                                                  height: 'auto',
                                                  fontSize: '12px',
                                                  opacity: 0.3,
                                                }}
                                              >
                                                {emoji}
                                              </Button>
                                            );
                                          })}
                                        </>
                                      );
                                    } catch (error) {
                                      return null;
                                    }
                                  })()}
                                </div>
                              </div>
                              {comment.userId === user?.id && (
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleDeleteComment(comment.id)}
                                  style={{ fontSize: '12px', color: '#ff4d4f' }}
                                />
                              )}
                            </div>
                          }
                          description={
                            <div style={{ fontSize: '13px' }}>
                              <div style={{ marginBottom: 4, whiteSpace: 'pre-wrap', color: '#262626', lineHeight: '1.6' }}>
                                {renderCommentContent(comment.content)}
                              </div>
                              <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
                                {new Date(comment.createdAt).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#bfbfbf',
                    fontStyle: 'italic',
                    fontSize: '12px'
                  }}>
                    댓글이 없습니다.
                  </div>
                )}
              </div>

              {/* 댓글 입력 */}
              <div>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Mentions
                    value={commentContent}
                    onChange={setCommentContent}
                    placeholder="댓글을 입력하세요... (@로 사용자 멘션)"
                    rows={3}
                    style={{ fontSize: '13px' }}
                    prefix="@"
                    options={users.map(u => ({
                      value: `[${u.displayName}](${u.id})`,
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                          <div>
                            <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>@{u.username}</div>
                          </div>
                        </div>
                      ),
                    }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <Popover
                    content={
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={300}
                        height={350}
                      />
                    }
                    trigger="click"
                    open={showEmojiPicker}
                    onOpenChange={setShowEmojiPicker}
                    placement="topRight"
                  >
                    <Button
                      icon={<SmileOutlined />}
                      size="small"
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        zIndex: 1000,
                        borderColor: '#ffd666',
                        color: '#faad14',
                        backgroundColor: '#fffbe6',
                        fontWeight: 500,
                      }}
                    >
                      이모지
                    </Button>
                  </Popover>
                </div>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleAddComment}
                  disabled={!commentContent.trim()}
                  block
                  size="small"
                >
                  댓글 추가
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 수정 모달 */}
      {selectedTask && (
        <ItemFormModal
          open={editModalOpen}
          item={selectedTask}
          onCancel={() => {
            setEditModalOpen(false);
            setSelectedTask(null);
          }}
          onSubmit={handleEditSubmit}
          clients={clients}
          users={users}
        />
      )}
    </div>
  );
};
