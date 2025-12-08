import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Radio,
  App,
  Typography,
  Divider,
  Popconfirm,
  Tooltip,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  BugOutlined,
  BulbOutlined,
  ToolOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { feedbackApi, Feedback, FeedbackType, FeedbackStatus, FeedbackStats } from '../api/feedback';
import { useAuthStore } from '../store/authStore';
import { TiptapEditor } from '../components/TiptapEditor';
import '../components/TiptapEditor.css';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

const typeConfig = {
  [FeedbackType.BUG]: { label: '버그', color: '#f5222d', icon: <BugOutlined /> },
  [FeedbackType.FEATURE]: { label: '기능요청', color: '#1890ff', icon: <BulbOutlined /> },
  [FeedbackType.IMPROVEMENT]: { label: '개선사항', color: '#52c41a', icon: <ToolOutlined /> },
};

const statusConfig = {
  [FeedbackStatus.PENDING]: { label: '대기중', color: 'default', icon: <ClockCircleOutlined /> },
  [FeedbackStatus.IN_PROGRESS]: { label: '진행중', color: 'processing', icon: <SyncOutlined spin /> },
  [FeedbackStatus.RESOLVED]: { label: '해결됨', color: 'success', icon: <CheckCircleOutlined /> },
  [FeedbackStatus.REJECTED]: { label: '반려', color: 'error', icon: <CloseCircleOutlined /> },
};

export const FeedbackList: React.FC = () => {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [filterType, setFilterType] = useState<FeedbackType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'ALL'>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [form] = Form.useForm();
  const [adminForm] = Form.useForm();
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    fetchFeedbacks();
    fetchStats();
  }, [pagination.page, filterType, filterStatus]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const response = await feedbackApi.getAll({
        type: filterType,
        status: filterStatus,
        page: pagination.page,
        limit: pagination.limit,
      });
      setFeedbacks(response.data);
      setPagination((prev) => ({ ...prev, total: response.pagination.total }));
    } catch (error: any) {
      message.error('피드백 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await feedbackApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleCreate = () => {
    setSelectedFeedback(null);
    form.resetFields();
    setEditorContent('');
    setModalOpen(true);
  };

  const handleRowClick = (record: Feedback) => {
    setSelectedFeedback(record);
    adminForm.setFieldsValue({
      status: record.status,
      adminComment: record.adminComment || '',
    });
    setDetailModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate editor content
      const cleanContent = editorContent.replace(/<[^>]*>/g, '').trim();
      if (!cleanContent) {
        message.error('내용을 입력해주세요.');
        return;
      }

      const submitData = { ...values, content: editorContent };

      if (selectedFeedback) {
        await feedbackApi.update(selectedFeedback.id, submitData);
        message.success('피드백이 수정되었습니다.');
      } else {
        await feedbackApi.create(submitData);
        message.success('피드백이 등록되었습니다.');
      }

      setModalOpen(false);
      form.resetFields();
      setEditorContent('');
      fetchFeedbacks();
      fetchStats();
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      }
    }
  };

  const handleAdminUpdate = async () => {
    if (!selectedFeedback) return;

    try {
      const values = await adminForm.validateFields();
      await feedbackApi.update(selectedFeedback.id, values);
      message.success('상태가 업데이트되었습니다.');
      setDetailModalOpen(false);
      fetchFeedbacks();
      fetchStats();
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await feedbackApi.delete(id);
      message.success('피드백이 삭제되었습니다.');
      fetchFeedbacks();
      fetchStats();
    } catch (error: any) {
      message.error(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  const handleEdit = (record: Feedback, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFeedback(record);
    form.setFieldsValue({
      type: record.type,
      title: record.title,
    });
    setEditorContent(record.content);
    setModalOpen(true);
  };

  const columns = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: FeedbackType) => {
        const config = typeConfig[type];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: FeedbackStatus) => {
        const config = statusConfig[status];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: Feedback) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }}>{title}</Text>
          {record.adminComment && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MessageOutlined style={{ marginRight: 4 }} />
              관리자 답변 있음
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '작성자',
      dataIndex: 'CreatedBy',
      key: 'createdBy',
      width: 150,
      render: (createdBy: Feedback['CreatedBy']) => (
        <Space direction="vertical" size={0}>
          <Text>{createdBy.displayName}</Text>
          {createdBy.Team && (
            <Text type="secondary" style={{ fontSize: 11 }}>{createdBy.Team.name}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '작성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, record: Feedback) => {
        const canEdit = record.createdById === user?.id && record.status === FeedbackStatus.PENDING;
        const canDelete = isAdmin || (record.createdById === user?.id && record.status === FeedbackStatus.PENDING);

        return (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <Tooltip title="수정">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => handleEdit(record, e)}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="삭제하시겠습니까?"
                onConfirm={() => handleDelete(record.id)}
                okText="삭제"
                cancelText="취소"
              >
                <Tooltip title="삭제">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 통계 카드 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="전체"
                value={stats.total}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="대기중"
                value={stats.byStatus.pending}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="진행중"
                value={stats.byStatus.inProgress}
                valueStyle={{ color: '#1890ff' }}
                prefix={<SyncOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="해결됨"
                value={stats.byStatus.resolved}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 필터 및 액션 버튼 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="middle">
            <Radio.Group
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="ALL">전체</Radio.Button>
              <Radio.Button value={FeedbackType.BUG}>
                <BugOutlined /> 버그
              </Radio.Button>
              <Radio.Button value={FeedbackType.FEATURE}>
                <BulbOutlined /> 기능요청
              </Radio.Button>
              <Radio.Button value={FeedbackType.IMPROVEMENT}>
                <ToolOutlined /> 개선사항
              </Radio.Button>
            </Radio.Group>

            <Select
              value={filterStatus}
              onChange={(value) => {
                setFilterStatus(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{ width: 120 }}
            >
              <Select.Option value="ALL">모든 상태</Select.Option>
              <Select.Option value={FeedbackStatus.PENDING}>대기중</Select.Option>
              <Select.Option value={FeedbackStatus.IN_PROGRESS}>진행중</Select.Option>
              <Select.Option value={FeedbackStatus.RESOLVED}>해결됨</Select.Option>
              <Select.Option value={FeedbackStatus.REJECTED}>반려</Select.Option>
            </Select>
          </Space>

          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            피드백 작성
          </Button>
        </div>
      </Card>

      {/* 피드백 목록 */}
      <Card>
        <Table
          columns={columns}
          dataSource={feedbacks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `총 ${total}개`,
            onChange: (page) => setPagination((prev) => ({ ...prev, page })),
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* 작성/수정 모달 */}
      <Modal
        title={selectedFeedback ? '피드백 수정' : '피드백 작성'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setEditorContent('');
        }}
        okText={selectedFeedback ? '수정' : '등록'}
        cancelText="취소"
        width="80%"
        style={{ maxWidth: 1200 }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="type"
            label="구분"
            rules={[{ required: true, message: '구분을 선택해주세요' }]}
          >
            <Radio.Group>
              <Radio.Button value={FeedbackType.BUG}>
                <BugOutlined style={{ color: '#f5222d' }} /> 버그
              </Radio.Button>
              <Radio.Button value={FeedbackType.FEATURE}>
                <BulbOutlined style={{ color: '#1890ff' }} /> 기능요청
              </Radio.Button>
              <Radio.Button value={FeedbackType.IMPROVEMENT}>
                <ToolOutlined style={{ color: '#52c41a' }} /> 개선사항
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="title"
            label="제목"
            rules={[{ required: true, message: '제목을 입력해주세요' }]}
          >
            <Input placeholder="피드백 제목을 입력하세요" />
          </Form.Item>

          <Form.Item label="내용" required>
            <TiptapEditor
              value={editorContent}
              onChange={setEditorContent}
              placeholder="상세 내용을 입력하세요. 이미지는 Ctrl+V로 붙여넣기 가능합니다."
              minHeight={350}
            />
            <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <BulbOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                <strong>Tip:</strong> 문제가 발생한 위치를 경로로 알려주시면 더 빠르게 해결할 수 있어요!
                <br />
                <span style={{ marginLeft: 20, color: '#8c8c8c' }}>
                  예시: "일정관리 &gt; 서비스 트리에서 항목 클릭 &gt; 상세정보 모달의 관련문서 탭"
                </span>
              </Text>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 상세 보기 모달 */}
      <Modal
        title={
          selectedFeedback && (
            <Space>
              <Tag color={typeConfig[selectedFeedback.type].color} icon={typeConfig[selectedFeedback.type].icon}>
                {typeConfig[selectedFeedback.type].label}
              </Tag>
              <Tag color={statusConfig[selectedFeedback.status].color} icon={statusConfig[selectedFeedback.status].icon}>
                {statusConfig[selectedFeedback.status].label}
              </Tag>
            </Space>
          )
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={
          isAdmin
            ? [
                <Button key="cancel" onClick={() => setDetailModalOpen(false)}>
                  닫기
                </Button>,
                <Button key="save" type="primary" onClick={handleAdminUpdate}>
                  저장
                </Button>,
              ]
            : [
                <Button key="close" onClick={() => setDetailModalOpen(false)}>
                  닫기
                </Button>,
              ]
        }
        width="80%"
        style={{ maxWidth: 1200 }}
      >
        {selectedFeedback && (
          <div>
            <Typography.Title level={4} style={{ marginBottom: 8 }}>
              {selectedFeedback.title}
            </Typography.Title>

            <Space style={{ marginBottom: 16 }}>
              <Text type="secondary">
                {selectedFeedback.CreatedBy.displayName}
                {selectedFeedback.CreatedBy.Team && ` (${selectedFeedback.CreatedBy.Team.name})`}
              </Text>
              <Text type="secondary">•</Text>
              <Text type="secondary">
                {dayjs(selectedFeedback.createdAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            </Space>

            <div
              className="feedback-content-view"
              style={{
                padding: 16,
                backgroundColor: '#fafafa',
                borderRadius: 8,
                marginBottom: 24,
              }}
              dangerouslySetInnerHTML={{ __html: selectedFeedback.content }}
            />

            {/* 관리자 답변 표시 */}
            {selectedFeedback.adminComment && !isAdmin && (
              <>
                <Divider />
                <div>
                  <Text strong style={{ color: '#1890ff' }}>
                    <MessageOutlined style={{ marginRight: 8 }} />
                    관리자 답변
                  </Text>
                  {selectedFeedback.ResolvedBy && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      ({selectedFeedback.ResolvedBy.displayName})
                    </Text>
                  )}
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: '#e6f7ff',
                      borderRadius: 8,
                      marginTop: 8,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedFeedback.adminComment}
                  </div>
                </div>
              </>
            )}

            {/* 관리자 영역 */}
            {isAdmin && (
              <>
                <Divider />
                <Typography.Title level={5}>관리자 영역</Typography.Title>
                <Form form={adminForm} layout="vertical">
                  <Form.Item name="status" label="상태 변경">
                    <Radio.Group>
                      <Radio.Button value={FeedbackStatus.PENDING}>대기중</Radio.Button>
                      <Radio.Button value={FeedbackStatus.IN_PROGRESS}>진행중</Radio.Button>
                      <Radio.Button value={FeedbackStatus.RESOLVED}>해결됨</Radio.Button>
                      <Radio.Button value={FeedbackStatus.REJECTED}>반려</Radio.Button>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item name="adminComment" label="관리자 답변">
                    <TextArea rows={4} placeholder="답변을 입력하세요" />
                  </Form.Item>
                </Form>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackList;
