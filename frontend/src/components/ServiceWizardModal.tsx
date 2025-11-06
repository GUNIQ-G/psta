import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Steps,
  Form,
  Select,
  Input,
  DatePicker,
  Button,
  Space,
  Typography,
  Card,
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  FolderOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Item } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ServiceWizardModalProps {
  open: boolean;
  item?: Item | null;
  onCancel: () => void;
  onSubmit: (values: any) => void;
  clients: any[];
  users: any[];
  projects: Item[];
  currentUserId?: string;
  currentUser?: any;
}

export const ServiceWizardModal: React.FC<ServiceWizardModalProps> = ({
  open,
  item,
  onCancel,
  onSubmit,
  clients,
  users,
  projects,
  currentUserId,
  currentUser,
}) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // users 목록에 현재 사용자가 없으면 추가 (ADMIN인 경우)
  const allUsers = React.useMemo(() => {
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      return [currentUser, ...users];
    }
    return users;
  }, [users, currentUser]);

  useEffect(() => {
    if (open) {
      if (item) {
        // 수정 모드: 기존 데이터 로드
        form.setFieldsValue({
          parentId: item.parentId,
          assigneeId: item.assigneeId,
          name: item.name,
          startDate: item.startDate ? dayjs(item.startDate) : null,
          endDate: item.endDate ? dayjs(item.endDate) : null,
          description: item.description,
        });
        setCurrentStep(0);
      } else {
        // 생성 모드: 폼 초기화
        form.resetFields();
        setCurrentStep(0);
      }
    }
  }, [open, item, form]);

  // currentUserId가 준비되면 담당자 자동 설정
  useEffect(() => {
    if (open && !item && currentUserId) {
      form.setFieldsValue({
        assigneeId: currentUserId,
      });
    }
  }, [open, item, currentUserId, form]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['parentId']);
      } else if (currentStep === 1) {
        await form.validateFields(['assigneeId']);
      }
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFinish = async () => {
    try {
      // Validate only the current step fields
      await form.validateFields(['name']);

      // Get ALL form values (including values from previous steps)
      const allValues = form.getFieldsValue(true);

      console.log('=== ServiceWizardModal handleFinish ===');
      console.log('All form values:', allValues);
      console.log('======================================');

      // 수정 모드일 때: 기존 parentId와 clientId 유지 (변경되지 않았을 경우)
      // 생성 모드일 때: 선택한 프로젝트의 clientId 가져오기
      let parentId = allValues.parentId;
      let clientId;

      if (item) {
        // 수정 모드: parentId가 변경되지 않았으면 기존 값 유지
        parentId = allValues.parentId || item.parentId;

        // clientId는 변경된 프로젝트의 clientId 또는 기존 clientId
        if (allValues.parentId && allValues.parentId !== item.parentId) {
          const selectedProject = projects.find(p => p.id === allValues.parentId);
          clientId = selectedProject?.clientId;
        } else {
          clientId = item.clientId;
        }
      } else {
        // 생성 모드: 선택한 프로젝트의 clientId 가져오기
        const selectedProject = projects.find(p => p.id === allValues.parentId);
        clientId = selectedProject?.clientId;
      }

      onSubmit({
        name: allValues.name,
        parentId,
        clientId,
        assigneeId: allValues.assigneeId,
        startDate: allValues.startDate?.toISOString(),
        endDate: allValues.endDate?.toISOString(),
        description: allValues.description,
      });
      form.resetFields();
      setCurrentStep(0);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancelModal = () => {
    form.resetFields();
    setCurrentStep(0);
    onCancel();
  };

  const steps = [
    {
      title: '프로젝트 선택',
      icon: <FolderOutlined />,
    },
    {
      title: '담당자 선택',
      icon: <UserOutlined />,
    },
    {
      title: '서비스 정보',
      icon: <FileTextOutlined />,
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card>
            <Title level={4}>프로젝트를 선택해주세요</Title>
            <Text type="secondary">서비스가 속할 프로젝트를 선택합니다.</Text>
            <Form.Item
              name="parentId"
              rules={[{ required: true, message: '프로젝트를 선택해주세요' }]}
              style={{ marginTop: 24 }}
            >
              <Select
                size="large"
                placeholder="프로젝트 선택"
                showSearch
                filterOption={(input, option) => {
                  const project = projects.find(p => p.id === option?.value);
                  if (!project) return false;
                  return project.name.toLowerCase().includes(input.toLowerCase());
                }}
              >
                {projects.map((project) => (
                  <Select.Option key={project.id} value={project.id}>
                    {project.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Card>
        );
      case 1:
        const currentAssigneeId = form.getFieldValue('assigneeId');
        const currentAssignee = allUsers.find((u) => u.id === currentAssigneeId);

        return (
          <Card>
            <Title level={4}>담당자를 선택해주세요</Title>
            <Text type="secondary">
              서비스 담당자가 자동으로 선택되어 있습니다. 필요시 변경할 수 있습니다.
            </Text>

            {currentAssignee ? (
              <div
                style={{
                  marginTop: 16,
                  marginBottom: 8,
                  padding: 12,
                  background: '#e6f7ff',
                  border: '1px solid #91d5ff',
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 13 }}>
                  현재 담당자: <Text strong>{currentAssignee.displayName} ({currentAssignee.username})</Text>
                </Text>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 16,
                  marginBottom: 8,
                  padding: 12,
                  background: '#fffbe6',
                  border: '1px solid #ffe58f',
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: '#faad14' }}>
                  담당자가 자동 선택되지 않았습니다. 아래에서 선택해주세요.
                </Text>
              </div>
            )}

            <Form.Item
              name="assigneeId"
              rules={[{ required: true, message: '담당자를 선택해주세요' }]}
              style={{ marginTop: 24 }}
            >
              <Select
                size="large"
                placeholder="담당자 선택"
                showSearch
                value={currentAssigneeId}
                onChange={(value) => form.setFieldsValue({ assigneeId: value })}
                filterOption={(input, option) => {
                  const user = allUsers.find(u => u.id === option?.value);
                  if (!user) return false;
                  const searchText = `${user.displayName} ${user.username}`.toLowerCase();
                  return searchText.includes(input.toLowerCase());
                }}
              >
                {allUsers.map((user) => (
                  <Select.Option key={user.id} value={user.id}>
                    {user.displayName} ({user.username})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Card>
        );
      case 2:
        const selProjectId = form.getFieldValue('parentId');
        const selAssigneeId = form.getFieldValue('assigneeId');
        const selProject = projects.find((p) => p.id === selProjectId);
        const selAssignee = allUsers.find((u) => u.id === selAssigneeId);
        const selClient = selProject?.Client;

        return (
          <Card>
            <Title level={4}>서비스 정보를 입력해주세요</Title>

            {/* 선택된 프로젝트, 담당자 표시 */}
            <div
              style={{
                marginBottom: 24,
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 6,
              }}
            >
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  고객: <Text strong>{selClient?.name || '-'}</Text>
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  프로젝트: <Text strong>{selProject?.name || '-'}</Text>
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  담당자:{' '}
                  <Text strong>
                    {selAssignee
                      ? `${selAssignee.displayName} (${selAssignee.username})`
                      : '-'}
                  </Text>
                </Text>
              </Space>
            </div>

            <Form.Item
              name="name"
              label="서비스명"
              rules={[{ required: true, message: '서비스명을 입력해주세요' }]}
            >
              <Input size="large" placeholder="서비스명 입력" />
            </Form.Item>

            <Form.Item label="일정">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="startDate" noStyle>
                  <DatePicker
                    placeholder="시작일"
                    style={{ width: '50%' }}
                    size="large"
                  />
                </Form.Item>
                <Form.Item name="endDate" noStyle>
                  <DatePicker
                    placeholder="종료일"
                    style={{ width: '50%' }}
                    size="large"
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>

            <Form.Item name="description" label="설명">
              <TextArea rows={4} placeholder="서비스 설명 (선택사항)" />
            </Form.Item>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Drawer
      title={item ? '서비스 수정' : '서비스 등록'}
      placement="right"
      open={open}
      onClose={handleCancelModal}
      width={expanded ? 'calc(100vw - 200px)' : '50%'}
      extra={
        <Space>
          <Button onClick={handleCancelModal}>취소</Button>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>이전</Button>
          )}
          {currentStep < steps.length - 1 && (
            <Button type="primary" onClick={handleNext}>
              다음
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button type="primary" onClick={handleFinish}>
              {item ? '수정' : '완료'}
            </Button>
          )}
        </Space>
      }
    >
      <Button
        icon={expanded ? <ArrowRightOutlined /> : <ArrowLeftOutlined />}
        onClick={() => setExpanded(!expanded)}
        style={{
          position: 'fixed',
          left: expanded ? '200px' : '50vw',
          top: '50%',
          transform: 'translate(-100%, -50%)',
          zIndex: 1001,
          width: 40,
          height: 60,
          borderRadius: '8px 0 0 8px',
          border: '1px solid #d9d9d9',
          borderRight: 'none',
          background: '#fff',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
      <Form form={form} layout="vertical">
        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

        <div style={{ minHeight: 300 }}>{renderStepContent()}</div>
      </Form>
    </Drawer>
  );
};
