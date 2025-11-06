import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  message,
  Radio,
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { WorkRequest, WorkRequestPriority, WorkRequestStatus, Item, ItemType } from '../types';
import { Team } from '../types/user';
import { workRequestsApi } from '../api/work-requests';
import { userApi } from '../api/user';
import { itemsApi } from '../api/items';
import { teamApi } from '../api/team';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

interface WorkRequestDrawerProps {
  open: boolean;
  onClose: () => void;
  workRequest?: WorkRequest | null;
  onSuccess: () => void;
}

export const WorkRequestDrawer: React.FC<WorkRequestDrawerProps> = ({
  open,
  onClose,
  workRequest,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [teams, setTeams] = useState<Item[]>([]);
  const [organizationTeams, setOrganizationTeams] = useState<Team[]>([]);
  const [assignmentType, setAssignmentType] = useState<'individual' | 'team'>('individual');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      loadUsers();
      loadProjects();
      loadOrganizationTeams();
      if (workRequest) {
        // 수정 모드
        setSelectedProjectId(workRequest.projectId);
        setSelectedServiceId(workRequest.serviceId);

        // 할당 타입 결정
        if (workRequest.assigneeTeamId) {
          setAssignmentType('team');
        } else {
          setAssignmentType('individual');
        }

        if (workRequest.projectId) {
          loadServices(workRequest.projectId);
        }
        if (workRequest.serviceId) {
          loadTeams(workRequest.serviceId);
        }
        form.setFieldsValue({
          title: workRequest.title,
          description: workRequest.description,
          priority: workRequest.priority,
          status: workRequest.status,
          projectId: workRequest.projectId,
          serviceId: workRequest.serviceId,
          teamId: workRequest.teamId,
          dueDate: workRequest.dueDate ? dayjs(workRequest.dueDate) : null,
          assigneeId: workRequest.assigneeId,
          assigneeTeamId: workRequest.assigneeTeamId,
        });
      } else {
        // 신규 모드
        form.resetFields();
        setSelectedProjectId(undefined);
        setSelectedServiceId(undefined);
        setServices([]);
        setTeams([]);
        setAssignmentType('individual');
        form.setFieldsValue({
          priority: WorkRequestPriority.MEDIUM,
        });
      }
    }
  }, [open, workRequest, form]);

  const loadUsers = async () => {
    try {
      const response = await userApi.getAll();
      setUsers(response || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadOrganizationTeams = async () => {
    try {
      const response = await teamApi.getAll();
      setOrganizationTeams(response || []);
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const allItems = await itemsApi.getItems();
      const projectItems = allItems.filter((item: Item) => item.type === ItemType.PROJECT);
      setProjects(projectItems);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadServices = async (projectId: string) => {
    try {
      const allItems = await itemsApi.getItems();
      const serviceItems = allItems.filter(
        (item: Item) => item.type === ItemType.SERVICE && item.parentId === projectId
      );
      setServices(serviceItems);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const loadTeams = async (serviceId: string) => {
    try {
      const allItems = await itemsApi.getItems();
      const teamItems = allItems.filter(
        (item: Item) => item.type === ItemType.TEAM && item.parentId === serviceId
      );
      setTeams(teamItems);
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedServiceId(undefined);
    form.setFieldsValue({ serviceId: undefined, teamId: undefined });
    setServices([]);
    setTeams([]);
    if (projectId) {
      loadServices(projectId);
    }
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    form.setFieldsValue({ teamId: undefined });
    setTeams([]);
    if (serviceId) {
      loadTeams(serviceId);
    }
  };

  const handleAssignmentTypeChange = (type: 'individual' | 'team') => {
    setAssignmentType(type);
    // 선택한 타입이 아닌 필드는 초기화
    if (type === 'individual') {
      form.setFieldsValue({ assigneeTeamId: undefined });
    } else {
      form.setFieldsValue({ assigneeId: undefined });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const data = {
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: values.status,
        projectId: values.projectId,
        serviceId: values.serviceId,
        teamId: values.teamId,
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
        assigneeId: assignmentType === 'individual' ? values.assigneeId : undefined,
        assigneeTeamId: assignmentType === 'team' ? values.assigneeTeamId : undefined,
      };

      if (workRequest) {
        // 수정
        await workRequestsApi.updateWorkRequest(workRequest.id, data);
        message.success('작업 요청이 수정되었습니다.');
      } else {
        // 신규 생성
        await workRequestsApi.createWorkRequest(data);
        message.success('작업 요청이 생성되었습니다.');
      }

      onSuccess();
      onClose();
      form.resetFields();
    } catch (error: any) {
      console.error('Submit error:', error);
      message.error(
        error.response?.data?.error || '작업 요청 처리에 실패했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const priorityOptions = [
    { value: WorkRequestPriority.LOW, label: '낮음', color: '#52c41a' },
    { value: WorkRequestPriority.MEDIUM, label: '보통', color: '#1890ff' },
    { value: WorkRequestPriority.HIGH, label: '높음', color: '#fa8c16' },
    { value: WorkRequestPriority.URGENT, label: '긴급', color: '#f5222d' },
  ];

  const statusOptions = [
    { value: WorkRequestStatus.PENDING, label: '대기', color: '#d9d9d9' },
    { value: WorkRequestStatus.IN_PROGRESS, label: '진행중', color: '#1890ff' },
    { value: WorkRequestStatus.COMPLETED, label: '완료', color: '#52c41a' },
    { value: WorkRequestStatus.CANCELLED, label: '취소', color: '#f5222d' },
  ];

  return (
    <>
      <Drawer
        title={workRequest ? '작업 요청 수정' : '새 작업 요청'}
        placement="right"
        width={expanded ? 'calc(100vw - 200px)' : '50%'}
        onClose={handleClose}
        open={open}
        extra={
          <Space>
            <Button
              type="default"
              icon={<CloseOutlined />}
              onClick={handleClose}
            >
              취소
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSubmit}
              loading={loading}
            >
              {workRequest ? '수정' : '생성'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="제목"
            rules={[{ required: true, message: '제목을 입력해주세요' }]}
          >
            <Input placeholder="작업 요청 제목" size="large" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
            rules={[{ required: true, message: '설명을 입력해주세요' }]}
          >
            <TextArea
              rows={6}
              placeholder="작업 요청에 대한 상세한 설명을 입력해주세요"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="우선순위"
                rules={[{ required: true, message: '우선순위를 선택해주세요' }]}
              >
                <Select placeholder="우선순위 선택">
                  {priorityOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      <span style={{ color: option.color }}>● </span>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dueDate" label="마감일">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          {workRequest && (
            <Form.Item name="status" label="상태">
              <Select placeholder="상태 선택">
                {statusOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    <span style={{ color: option.color }}>● </span>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="projectId" label="프로젝트">
            <Select
              placeholder="프로젝트 선택"
              allowClear
              showSearch
              onChange={handleProjectChange}
              filterOption={(input, option) =>
                String(option?.children || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {projects.map((project) => (
                <Option key={project.id} value={project.id}>
                  {project.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="serviceId" label="서비스">
            <Select
              placeholder="서비스 선택 (프로젝트 선택 후)"
              allowClear
              showSearch
              disabled={!selectedProjectId}
              onChange={handleServiceChange}
              filterOption={(input, option) =>
                String(option?.children || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {services.map((service) => (
                <Option key={service.id} value={service.id}>
                  {service.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="teamId" label="팀">
            <Select
              placeholder="팀 선택 (서비스 선택 후)"
              allowClear
              showSearch
              disabled={!selectedServiceId}
              filterOption={(input, option) =>
                String(option?.children || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {teams.map((team) => (
                <Option key={team.id} value={team.id}>
                  {team.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="담당 할당 방식">
            <Radio.Group
              value={assignmentType}
              onChange={(e) => handleAssignmentTypeChange(e.target.value)}
            >
              <Radio value="individual">개인 담당자</Radio>
              <Radio value="team">팀 담당</Radio>
            </Radio.Group>
          </Form.Item>

          {assignmentType === 'individual' ? (
            <Form.Item
              name="assigneeId"
              label="개인 담당자"
              rules={[{ required: true, message: '담당자를 선택해주세요' }]}
            >
              <Select
                placeholder="담당자 선택"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  String(option?.children || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {users.map((user) => (
                  <Option key={user.id} value={user.id}>
                    {user.displayName} ({user.username})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              name="assigneeTeamId"
              label="담당 팀"
              rules={[{ required: true, message: '담당 팀을 선택해주세요' }]}
            >
              <Select
                placeholder="팀 선택"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  String(option?.children || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {organizationTeams.map((team) => (
                  <Option key={team.id} value={team.id}>
                    {team.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* Expand/Collapse Button */}
      {open && (
        <Button
          icon={expanded ? <ArrowRightOutlined /> : <ArrowLeftOutlined />}
          onClick={() => setExpanded(!expanded)}
          style={{
            position: 'fixed',
            left: expanded ? '200px' : '50vw',
            top: '50%',
            transform: 'translate(-100%, -50%)',
            zIndex: 1001,
            borderRadius: '4px 0 0 4px',
            height: 48,
            boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
          }}
        />
      )}
    </>
  );
};
