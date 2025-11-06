import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Space,
  Alert,
  Divider,
  Tag,
  Card,
  Radio,
  message,
} from 'antd';
import {
  InfoCircleOutlined,
  UserOutlined,
  TeamOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { WorkRequest, Item, ItemType, WorkRequestPriority } from '../types';
import { workRequestsApi } from '../api/work-requests';
import { userApi } from '../api/user';
import { itemsApi } from '../api/items';
import { useAuthStore } from '../store/authStore';

const { TextArea } = Input;
const { Option } = Select;

interface HierarchyRequestModalProps {
  open: boolean;
  onClose: () => void;
  workRequest: WorkRequest;
  validationResult: {
    canCreateAction: boolean;
    missingHierarchy: string[];
    suggestions: Array<{
      level: string;
      action: 'SELECT_EXISTING' | 'REQUEST_CREATION';
      existingItems?: Item[];
      targetManagerId?: string;
    }>;
  };
  onSuccess: () => void;
}

export const HierarchyRequestModal: React.FC<HierarchyRequestModalProps> = ({
  open,
  onClose,
  workRequest,
  validationResult,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [managers, setManagers] = useState<any[]>([]);
  const [selectedAction, setSelectedAction] = useState<'SELECT' | 'REQUEST'>('REQUEST');
  const { user } = useAuthStore();

  const currentSuggestion = validationResult.suggestions[currentStep];
  const isLastStep = currentStep === validationResult.suggestions.length - 1;

  useEffect(() => {
    if (open && currentSuggestion) {
      loadManagers();
      // 기존 항목이 있으면 SELECT, 없으면 REQUEST 기본 선택
      if (currentSuggestion.existingItems && currentSuggestion.existingItems.length > 0) {
        setSelectedAction('SELECT');
      } else {
        setSelectedAction('REQUEST');
      }
    }
  }, [open, currentStep]);

  const loadManagers = async () => {
    if (!user) return;
    try {
      const data = await userApi.getUserManagers(user.id);
      setManagers(data);

      // 기본 관리자 선택
      if (data.length > 0 && currentSuggestion.targetManagerId) {
        form.setFieldsValue({
          assigneeId: currentSuggestion.targetManagerId,
        });
      } else if (data.length > 0) {
        form.setFieldsValue({
          assigneeId: data[0].id,
        });
      }
    } catch (error) {
      console.error('Failed to load managers:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      setLoading(true);

      if (selectedAction === 'SELECT') {
        // 기존 항목 선택
        const selectedItemId = values.selectedItemId;

        // 작업 요청 업데이트
        const updateData: any = {};
        if (currentSuggestion.level === 'SERVICE') {
          updateData.serviceId = selectedItemId;
        } else if (currentSuggestion.level === 'TEAM') {
          updateData.teamId = selectedItemId;
        }

        await workRequestsApi.updateWorkRequest(workRequest.id, updateData);

        message.success(`${currentSuggestion.level} 선택 완료`);
      } else {
        // 새 항목 생성 요청
        const requestType = currentSuggestion.level === 'SERVICE'
          ? 'SERVICE_CREATE'
          : 'TEAM_CREATE';

        const targetItemType = currentSuggestion.level === 'SERVICE'
          ? 'SERVICE'
          : 'TEAM';

        await workRequestsApi.createHierarchyRequest({
          parentWorkRequestId: workRequest.id,
          requestType: requestType as 'SERVICE_CREATE' | 'TEAM_CREATE',
          targetItemType: targetItemType as 'SERVICE' | 'TEAM',
          projectId: workRequest.projectId,
          serviceId: workRequest.serviceId,
          assigneeId: values.assigneeId,
          title: values.title || `[자동] ${currentSuggestion.level} 생성 요청`,
          description: values.description ||
            `작업 요청 "${workRequest.title}"을 처리하기 위해 ${currentSuggestion.level} 생성이 필요합니다.`,
          priority: 'HIGH',
        });

        message.success(`${currentSuggestion.level} 생성 요청이 전송되었습니다`);
      }

      // 다음 단계로 또는 완료
      if (isLastStep) {
        onSuccess();
        onClose();
        setCurrentStep(0);
        form.resetFields();
      } else {
        setCurrentStep(currentStep + 1);
        form.resetFields();
      }
    } catch (error: any) {
      console.error('Hierarchy request error:', error);
      message.error(error.response?.data?.error || '요청 처리 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
    setCurrentStep(0);
    form.resetFields();
  };

  if (!currentSuggestion) return null;

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'SERVICE':
        return <ApartmentOutlined />;
      case 'TEAM':
        return <TeamOutlined />;
      default:
        return <InfoCircleOutlined />;
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'SERVICE':
        return '서비스';
      case 'TEAM':
        return '팀';
      default:
        return level;
    }
  };

  return (
    <Modal
      title={
        <Space>
          {getLevelIcon(currentSuggestion.level)}
          <span>{getLevelLabel(currentSuggestion.level)} 선택 필요</span>
          <Tag color="orange">
            {currentStep + 1} / {validationResult.suggestions.length}
          </Tag>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={
        <Space>
          <Button onClick={handleCancel}>취소</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            {isLastStep ? '완료' : '다음'}
          </Button>
        </Space>
      }
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="계층 구조 불완전"
          description={`작업 요청 "${workRequest.title}"에서 액션을 생성하려면 ${getLevelLabel(currentSuggestion.level)}이(가) 필요합니다.`}
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
        />

        <Card size="small" title="선택 옵션">
          <Radio.Group
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {currentSuggestion.existingItems && currentSuggestion.existingItems.length > 0 && (
                <Radio value="SELECT">
                  기존 {getLevelLabel(currentSuggestion.level)} 선택
                </Radio>
              )}
              <Radio value="REQUEST">
                새 {getLevelLabel(currentSuggestion.level)} 생성 요청
              </Radio>
            </Space>
          </Radio.Group>
        </Card>

        <Form form={form} layout="vertical">
          {selectedAction === 'SELECT' ? (
            // 기존 항목 선택
            <Form.Item
              name="selectedItemId"
              label={`${getLevelLabel(currentSuggestion.level)} 선택`}
              rules={[{ required: true, message: '항목을 선택해주세요' }]}
            >
              <Select
                placeholder={`${getLevelLabel(currentSuggestion.level)}을(를) 선택하세요`}
                showSearch
                optionFilterProp="children"
              >
                {currentSuggestion.existingItems?.map((item) => (
                  <Option key={item.id} value={item.id}>
                    {item.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            // 생성 요청
            <>
              <Form.Item
                name="assigneeId"
                label="요청 대상 (관리자)"
                rules={[{ required: true, message: '요청 대상을 선택해주세요' }]}
                extra="우선순위: 팀 PO/PM → 전체 PO → 전체 PM"
              >
                <Select
                  placeholder="관리자를 선택하세요"
                  showSearch
                  optionFilterProp="label"
                >
                  {managers.map((manager) => (
                    <Option
                      key={manager.id}
                      value={manager.id}
                      label={`${manager.displayName} (${manager.username})`}
                    >
                      <Space>
                        <UserOutlined />
                        <span>{manager.displayName}</span>
                        <Tag color="blue">{manager.role}</Tag>
                        <Tag color="green">{manager.reason}</Tag>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="title"
                label="요청 제목"
                rules={[{ required: false }]}
              >
                <Input
                  placeholder={`[자동] ${getLevelLabel(currentSuggestion.level)} 생성 요청`}
                />
              </Form.Item>

              <Form.Item
                name="description"
                label="요청 설명"
                rules={[{ required: false }]}
              >
                <TextArea
                  rows={3}
                  placeholder={`작업 요청 "${workRequest.title}"을 처리하기 위해 ${getLevelLabel(currentSuggestion.level)} 생성이 필요합니다.`}
                />
              </Form.Item>
            </>
          )}
        </Form>

        {!isLastStep && (
          <Alert
            message={`다음: ${getLevelLabel(validationResult.suggestions[currentStep + 1].level)} 선택`}
            type="info"
            showIcon
          />
        )}
      </Space>
    </Modal>
  );
};
