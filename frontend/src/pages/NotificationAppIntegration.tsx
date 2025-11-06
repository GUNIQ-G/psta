import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Popconfirm,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Tabs,
  Typography,
  Divider,
} from 'antd';
import {
  ApiOutlined,
  PlusOutlined,
  SyncOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  notificationAppApi,
  NotificationApp,
  NotificationAppType,
  PLATFORM_NAMES,
  PLATFORM_ICONS,
} from '../api/notification-app';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const NotificationAppIntegration: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<NotificationApp[]>([]);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<NotificationApp | null>(null);
  const [form] = Form.useForm();

  // Test panels
  const [testEmailModalOpen, setTestEmailModalOpen] = useState(false);
  const [testDmModalOpen, setTestDmModalOpen] = useState(false);
  const [testForm] = Form.useForm();
  const [dmForm] = Form.useForm();
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingDm, setTestingDm] = useState(false);

  const [selectedPlatform, setSelectedPlatform] = useState<NotificationAppType>('SLACK');

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const response = await notificationAppApi.getAll();
      setApps(response.data);
    } catch (error: any) {
      message.error('알림앱 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id: string, name: string) => {
    setTestingIds((prev) => new Set(prev).add(id));
    try {
      // Fetch the full config with actual tokens (not masked)
      const fullAppResponse = await notificationAppApi.getById(id);
      const fullApp = fullAppResponse.data;

      const response = await notificationAppApi.testConnection(fullApp.type, fullApp.config);
      if (response.data.success) {
        const details: string[] = [];
        if (response.data.workspace) details.push(`워크스페이스: ${response.data.workspace}`);
        if (response.data.botUser) details.push(`봇: ${response.data.botUser}`);
        if (response.data.botUsername) details.push(`봇 사용자명: @${response.data.botUsername}`);
        if (response.data.botName) details.push(`봇 이름: ${response.data.botName}`);
        if (response.data.method) details.push(`방식: ${response.data.method}`);

        message.success({
          content: (
            <div>
              <strong>{name}</strong>
              <br />
              {response.data.platform} 연결 테스트 성공
              {details.length > 0 && (
                <>
                  <br />
                  {details.join(' / ')}
                </>
              )}
            </div>
          ),
          duration: 5,
        });
      } else {
        message.error({
          content: (
            <div>
              <strong>{name}</strong>
              <br />
              연결 테스트 실패
            </div>
          ),
          duration: 5,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || '알 수 없는 오류';
      message.error({
        content: (
          <div>
            <strong>{name}</strong>
            <br />
            연결 실패: {errorMsg}
          </div>
        ),
        duration: 8,
      });
    } finally {
      setTestingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await notificationAppApi.delete(id);
      message.success(`"${name}" 알림앱이 삭제되었습니다`);
      fetchApps();
    } catch (error: any) {
      message.error('삭제 실패: ' + error.message);
    }
  };

  const handleEdit = async (app: NotificationApp) => {
    setEditingApp(app);
    try {
      const response = await notificationAppApi.getById(app.id);
      const fullApp = response.data;
      form.setFieldsValue({
        name: fullApp.name,
        type: fullApp.type,
        config: fullApp.config,
        isActive: fullApp.isActive,
      });
      setSelectedPlatform(fullApp.type);
    } catch (error) {
      message.error('설정을 불러오는데 실패했습니다');
    }
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingApp(null);
    form.resetFields();
    form.setFieldsValue({ isActive: false, type: 'SLACK' });
    setSelectedPlatform('SLACK');
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (editingApp) {
        await notificationAppApi.update(editingApp.id, values);
        message.success('알림앱 설정이 수정되었습니다');
      } else {
        await notificationAppApi.create(values);
        message.success('알림앱이 추가되었습니다');
      }

      setModalOpen(false);
      form.resetFields();
      fetchApps();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error('저장 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    form.resetFields();
    setEditingApp(null);
  };

  // Test DM sending
  const handleTestDm = async () => {
    try {
      const values = await dmForm.validateFields();
      setTestingDm(true);

      const response = await notificationAppApi.sendMessageByEmail(values.email, values.message);
      message.success({
        content: (
          <div>
            <strong>메시지 발송 성공</strong>
            <br />
            플랫폼: {response.data.platform}
            <br />
            사용자 ID: {response.data.userId}
            <br />
            타임스탬프: {response.data.timestamp}
          </div>
        ),
        duration: 5,
      });
      dmForm.resetFields();
    } catch (error: any) {
      message.error('발송 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setTestingDm(false);
    }
  };

  const getPlatformColor = (type: NotificationAppType): string => {
    const colors: Record<NotificationAppType, string> = {
      SLACK: 'purple',
      TELEGRAM: 'blue',
      DISCORD: 'geekblue',
      LINE: 'green',
      KAKAOTALK: 'gold',
    };
    return colors[type];
  };

  const columns: ColumnsType<NotificationApp> = [
    {
      title: '플랫폼',
      dataIndex: 'type',
      key: 'type',
      render: (type: NotificationAppType) => (
        <Tag color={getPlatformColor(type)}>
          {PLATFORM_ICONS[type]} {PLATFORM_NAMES[type]}
        </Tag>
      ),
    },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '활성' : '비활성'}
        </Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleTest(record.id, record.name)}
            loading={testingIds.has(record.id)}
          >
            테스트
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Popconfirm
            title="알림앱 삭제"
            description={`"${record.name}" 설정을 삭제하시겠습니까?`}
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Platform-specific config templates
  const getConfigTemplate = (type: NotificationAppType): string => {
    const templates: Record<NotificationAppType, object> = {
      SLACK: {
        botToken: 'xoxb-...',
        userToken: 'xapp-...',
        appId: 'A09MJJ70Y4C',
        clientId: '7493581335524.9732619032148',
        clientSecret: '',
        signingSecret: '',
        verificationToken: '',
      },
      TELEGRAM: {
        botToken: '',
        chatId: '',
      },
      DISCORD: {
        webhookUrl: '',
        botToken: '',
        channelId: '',
      },
      LINE: {
        channelAccessToken: '',
        channelSecret: '',
      },
      KAKAOTALK: {
        apiKey: '',
        adminKey: '',
      },
    };

    return JSON.stringify(templates[type], null, 2);
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <ApiOutlined />
            <span>알림앱 연동</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            새 알림앱
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={apps}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `전체 ${total}개`,
          }}
        />

        <Divider />

        <Title level={5}>테스트 기능</Title>
        <Space size="middle">
          <Button
            icon={<SendOutlined />}
            onClick={() => setTestDmModalOpen(true)}
          >
            테스트 메시지 발송
          </Button>
        </Space>
      </Card>

      {/* Add/Edit App Modal */}
      <Modal
        title={editingApp ? '알림앱 수정' : '알림앱 추가'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={800}
        okText="저장"
        cancelText="취소"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="name"
            label="설정 이름"
            rules={[{ required: true, message: '설정 이름을 입력하세요' }]}
          >
            <Input placeholder="예: 메인 Slack 워크스페이스" />
          </Form.Item>

          <Form.Item
            name="type"
            label="플랫폼"
            rules={[{ required: true, message: '플랫폼을 선택하세요' }]}
          >
            <Select
              onChange={(value) => {
                setSelectedPlatform(value);
                // Auto-fill template when platform changes
                const currentConfig = form.getFieldValue('config');
                if (!currentConfig || currentConfig.trim() === '') {
                  form.setFieldValue('config', getConfigTemplate(value));
                }
              }}
            >
              <Select.Option value="SLACK">
                {PLATFORM_ICONS.SLACK} Slack
              </Select.Option>
              <Select.Option value="TELEGRAM">
                {PLATFORM_ICONS.TELEGRAM} Telegram
              </Select.Option>
              <Select.Option value="DISCORD">
                {PLATFORM_ICONS.DISCORD} Discord
              </Select.Option>
              <Select.Option value="LINE">
                {PLATFORM_ICONS.LINE} LINE
              </Select.Option>
              <Select.Option value="KAKAOTALK">
                {PLATFORM_ICONS.KAKAOTALK} 카카오톡
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="config"
            label="설정 (JSON)"
            rules={[
              { required: true, message: '설정을 입력하세요' },
              {
                validator: (_, value) => {
                  try {
                    if (value) JSON.parse(value);
                    return Promise.resolve();
                  } catch (e) {
                    return Promise.reject(new Error('올바른 JSON 형식이 아닙니다'));
                  }
                },
              },
            ]}
            tooltip="플랫폼별 인증 정보를 JSON 형식으로 입력하세요"
          >
            <TextArea
              rows={12}
              placeholder={getConfigTemplate(selectedPlatform)}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="활성 상태"
            tooltip="활성화하면 같은 플랫폼의 다른 설정은 자동으로 비활성화됩니다"
          >
            <Select>
              <Select.Option value={true}>활성</Select.Option>
              <Select.Option value={false}>비활성</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Test DM Sending Modal */}
      <Modal
        title="테스트 메시지 발송"
        open={testDmModalOpen}
        onOk={handleTestDm}
        onCancel={() => {
          setTestDmModalOpen(false);
          dmForm.resetFields();
        }}
        okText="발송"
        cancelText="취소"
        confirmLoading={testingDm}
      >
        <Form
          form={dmForm}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="email"
            label="수신자 이메일"
            rules={[
              { required: true, message: '이메일을 입력하세요' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다' },
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item
            name="message"
            label="메시지"
            rules={[{ required: true, message: '메시지를 입력하세요' }]}
          >
            <TextArea
              rows={4}
              placeholder="테스트 메시지 ✅"
            />
          </Form.Item>

          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            활성화된 알림앱으로 메시지가 발송됩니다.
          </Paragraph>
        </Form>
      </Modal>
    </div>
  );
};

export default NotificationAppIntegration;
