import React, { useState, useEffect } from 'react';
import { Drawer, Button, Space, Select, Form, Input, InputNumber, DatePicker, App, Upload, Divider, List, Popconfirm, Card, Tag, Row, Col } from 'antd';
import { TiptapEditor } from './TiptapEditor';
import './TiptapEditor.css';
import { FolderOutlined, AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, UploadOutlined, DeleteOutlined, LinkOutlined, FileOutlined } from '@ant-design/icons';
import { LinkAddModal } from './modals/LinkAddModal';
import { itemsApi } from '../api/items';
import { userApi } from '../api/user';
import { teamApi } from '../api/team';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';
import { ItemType, ItemStatus } from '../types';
import { useAuthStore } from '../store/authStore';
import type { UploadFile } from 'antd/es/upload/interface';

interface ActionCreateDrawerProps {
  open: boolean;
  onClose: () => void;
  userTeamId?: string;
  initialValues?: {
    title?: string;
    projectId?: string;
    serviceId?: string;
    teamId?: string;
    assigneeId?: string;
    description?: string;
    dueDate?: string;
    workRequestId?: string;
  };
}

export const ActionCreateDrawer: React.FC<ActionCreateDrawerProps> = ({
  open,
  onClose,
  userTeamId,
  initialValues,
}) => {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>();
  const [selectedService, setSelectedService] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [userTeamName, setUserTeamName] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linkList, setLinkList] = useState<Array<{url: string, displayName: string}>>([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  useEffect(() => {
    if (open && userTeamId) {
      fetchUserTeam();
      fetchUsers();
    }
  }, [open, userTeamId]);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  // 초기값 설정
  useEffect(() => {
    if (open) {
      if (initialValues) {
        // 프로젝트가 지정된 경우
        if (initialValues.projectId) {
          setSelectedProject(initialValues.projectId);
        }

        // 서비스가 지정된 경우
        if (initialValues.serviceId) {
          setSelectedService(initialValues.serviceId);
        }

        // 폼 필드 초기값 설정
        setTimeout(() => {
          form.setFieldsValue({
            name: initialValues.title,
            description: initialValues.description,
            assigneeId: initialValues.assigneeId || user?.id,
            status: ItemStatus.NOT_STARTED,
            progress: 0,
          });
        }, 100);
      } else {
        // 초기값이 없으면 리셋하고 현재 사용자를 담당자로 설정
        setSelectedProject(undefined);
        setSelectedService(undefined);
        form.resetFields();
        form.setFieldsValue({
          assigneeId: user?.id,
          status: ItemStatus.NOT_STARTED,
          progress: 0,
        });
      }
    }
  }, [open, initialValues, user]);

  useEffect(() => {
    if (selectedProject) {
      fetchServices();
      setSelectedService(undefined);
    } else {
      setServices([]);
      setSelectedService(undefined);
    }
  }, [selectedProject]);

  const fetchUserTeam = async () => {
    if (!userTeamId) return;

    try {
      const team = await teamApi.getById(userTeamId);
      setUserTeamName(team.name);

      // Find the user's team ITEM (not just team entity)
      // We'll need to search for it when creating the action
    } catch (error) {
      console.error('Failed to fetch user team:', error);
      message.error('팀 정보 조회 실패');
    }
  };

  const fetchProjects = async () => {
    try {
      // 3단계 구조: 모든 프로젝트 가져오기
      const allProjects = await itemsApi.getItems({
        type: ItemType.PROJECT,
        parentId: null,
      });

      // Sort: "미정" projects first, then alphabetically
      const sortedProjects = allProjects.sort((a: any, b: any) => {
        const aIsUndecided = a.name.includes('미정');
        const bIsUndecided = b.name.includes('미정');
        if (aIsUndecided && !bIsUndecided) return -1;
        if (!aIsUndecided && bIsUndecided) return 1;
        return a.name.localeCompare(b.name);
      });

      setProjects(sortedProjects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      message.error('프로젝트 조회 실패');
    }
  };

  const fetchServices = async () => {
    if (!selectedProject) return;

    try {
      // 3단계 구조: 선택한 프로젝트의 모든 서비스 가져오기
      const allServices = await itemsApi.getItems({
        type: ItemType.SERVICE,
        parentId: selectedProject,
      });

      // Sort: "미정" services first, then alphabetically
      const sortedServices = allServices.sort((a: any, b: any) => {
        const aIsUndecided = a.name.includes('미정');
        const bIsUndecided = b.name.includes('미정');
        if (aIsUndecided && !bIsUndecided) return -1;
        if (!aIsUndecided && bIsUndecided) return 1;
        return a.name.localeCompare(b.name);
      });

      setServices(sortedServices);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      message.error('서비스 조회 실패');
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await userApi.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate project and service selection
      if (!selectedProject) {
        message.warning('프로젝트를 선택해주세요');
        return;
      }
      if (!selectedService) {
        message.warning('서비스를 선택해주세요');
        return;
      }

      setLoading(true);

      // Get selected project and service items
      const selectedProjectItem = projects.find(p => p.id === selectedProject);
      const selectedServiceItem = services.find(s => s.id === selectedService);

      // Create action item (3단계 구조: parentId에 서비스 ID 직접 전송)
      const actionData: any = {
        name: values.name,
        type: ItemType.ACTION,
        parentId: selectedService, // 서비스 ID를 parentId로 직접 전송
        clientId: selectedProjectItem?.clientId, // Add clientId from project
        assigneeId: values.assigneeId,
        status: values.status || ItemStatus.NOT_STARTED,
        progress: values.progress || 0,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        description: values.description,
      };

      // Add metadata for undecided project/service
      const isProjectUndecided = selectedProjectItem?.name.includes('미정');
      const isServiceUndecided = selectedServiceItem?.name.includes('미정');

      if (isProjectUndecided || isServiceUndecided) {
        actionData.description = `${actionData.description || ''}\n\n[미정 정보]\n프로젝트: ${
          isProjectUndecided ? '미정' : '지정됨'
        }\n서비스: ${isServiceUndecided ? '미정' : '지정됨'}`;
      }

      const createdItem = await itemsApi.createItem(actionData);

      // Link work request if provided
      if (initialValues?.workRequestId) {
        try {
          const { workRequestsApi } = await import('../api/work-requests');
          await workRequestsApi.updateWorkRequest(initialValues.workRequestId, {
            actionId: createdItem.id,
          });
        } catch (linkError) {
          console.error('Failed to link work request:', linkError);
          message.warning('액션은 생성되었지만 작업 요청 연결에 실패했습니다.');
        }
      }

      // Upload files if any
      let fileSuccessCount = 0;
      let fileFailCount = 0;
      if (fileList.length > 0) {
        setUploading(true);
        try {
          for (const file of fileList) {
            if (file.originFileObj) {
              try {
                await filesApi.uploadFile(createdItem.id, file.originFileObj);
                fileSuccessCount++;
              } catch (uploadError) {
                console.error('Failed to upload file:', file.name, uploadError);
                fileFailCount++;
              }
            }
          }
        } catch (error) {
          console.error('File upload error:', error);
        } finally {
          setUploading(false);
        }
      }

      // Upload links if any
      let linkSuccessCount = 0;
      let linkFailCount = 0;
      if (linkList.length > 0) {
        try {
          for (const link of linkList) {
            try {
              await linksApi.createLink(createdItem.id, link.url, link.displayName);
              linkSuccessCount++;
            } catch (linkError) {
              console.error('Failed to create link:', link.displayName, linkError);
              linkFailCount++;
            }
          }
        } catch (error) {
          console.error('Link creation error:', error);
        }
      }

      // Show summary message
      const messages: string[] = [];
      if (fileSuccessCount > 0) messages.push(`${fileSuccessCount}개 파일 업로드 완료`);
      if (fileFailCount > 0) messages.push(`${fileFailCount}개 파일 업로드 실패`);
      if (linkSuccessCount > 0) messages.push(`${linkSuccessCount}개 링크 추가 완료`);
      if (linkFailCount > 0) messages.push(`${linkFailCount}개 링크 추가 실패`);

      if (messages.length > 0) {
        message.success(`액션이 생성되었습니다. ${messages.join(', ')}`);
      } else {
        message.success('액션이 생성되었습니다');
      }

      // 미정 프로젝트/서비스 알림은 백엔드에서 자동 처리됨 (v1.1.23)

      handleClose();
    } catch (error: any) {
      if (error.errorFields) {
        return; // Form validation error
      }
      message.error('액션 생성 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedProject(undefined);
    setSelectedService(undefined);
    setUserTeamName(undefined);
    setFileList([]);
    setLinkList([]);
    form.resetFields();
    onClose();
  };

  const handleFileChange = (info: any) => {
    let newFileList = [...info.fileList];

    // Limit to 10 files
    newFileList = newFileList.slice(-10);

    setFileList(newFileList);
  };

  const handleFileRemove = (file: UploadFile) => {
    const newFileList = fileList.filter(f => f.uid !== file.uid);
    setFileList(newFileList);
  };

  const handleLinkAdd = () => {
    setLinkModalOpen(true);
  };

  const handleLinkSubmit = (url: string, displayName: string) => {
    setLinkList([...linkList, { url, displayName }]);
    message.success('링크가 추가되었습니다');
    setLinkModalOpen(false);
  };

  const handleLinkRemove = (index: number) => {
    const newLinkList = linkList.filter((_, i) => i !== index);
    setLinkList(newLinkList);
    message.success('링크가 제거되었습니다');
  };

  return (
    <>
      <Drawer
        title="액션 생성"
        placement="right"
        open={open}
        onClose={handleClose}
        width={expanded ? 'calc(100vw - 200px)' : '50%'}
        maskClosable={true}
        extra={
          <Space>
            <Button onClick={handleClose}>취소</Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              생성
            </Button>
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
        {/* 프로젝트 선택 */}
        <Form.Item label="프로젝트" required>
          <Select
            placeholder="프로젝트 선택"
            size="large"
            value={selectedProject}
            onChange={setSelectedProject}
            showSearch
            optionFilterProp="children"
          >
            {projects.map((project) => {
              const isUndecided = project.name.includes('미정');
              return (
                <Select.Option key={project.id} value={project.id}>
                  <Space>
                    <FolderOutlined style={{ color: isUndecided ? '#999' : '#722ed1' }} />
                    <span style={{ color: isUndecided ? '#999' : 'inherit' }}>
                      {project.name}
                    </span>
                  </Space>
                </Select.Option>
              );
            })}
          </Select>
          {projects.length === 0 && (
            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
              프로젝트를 불러오는 중입니다...
            </div>
          )}
        </Form.Item>

        {/* 서비스 선택 - 프로젝트가 선택되면 표시 */}
        {selectedProject && (
          <Form.Item label="서비스" required>
            <Select
              placeholder="서비스 선택"
              size="large"
              value={selectedService}
              onChange={setSelectedService}
              showSearch
              optionFilterProp="children"
            >
              {services.map((service) => {
                const isUndecided = service.name.includes('미정');
                return (
                  <Select.Option key={service.id} value={service.id}>
                    <Space>
                      <AppstoreOutlined style={{ color: isUndecided ? '#999' : '#1890ff' }} />
                      <span style={{ color: isUndecided ? '#999' : 'inherit' }}>
                        {service.name}
                      </span>
                    </Space>
                  </Select.Option>
                );
              })}
            </Select>
            {services.length === 0 && (
              <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                서비스를 불러오는 중입니다...
              </div>
            )}
          </Form.Item>
        )}

        {/* 액션 정보 - 서비스가 선택되면 표시 */}
        {selectedService && (
          <>
            {/* 1행: 업무명 (전체 너비) */}
            <Form.Item
              name="name"
              label="업무명"
              rules={[{ required: true, message: '업무명을 입력해주세요' }]}
            >
              <Input placeholder="업무명을 입력하세요" size="large" />
            </Form.Item>

            {/* 2행: 상태 + 진행률 (자동 연동) */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="status" label="상태">
                  <Select
                    size="large"
                    onChange={(value) => {
                      // 상태 → 진행률 자동 연동
                      if (value === ItemStatus.NOT_STARTED) {
                        form.setFieldsValue({ progress: 0 });
                      } else if (value === ItemStatus.COMPLETED) {
                        form.setFieldsValue({ progress: 100 });
                      }
                      // 진행중/보류는 기존 진행률 유지
                    }}
                  >
                    <Select.Option value={ItemStatus.NOT_STARTED}>시작 전</Select.Option>
                    <Select.Option value={ItemStatus.IN_PROGRESS}>진행중</Select.Option>
                    <Select.Option value={ItemStatus.COMPLETED}>완료</Select.Option>
                    <Select.Option value={ItemStatus.ON_HOLD}>보류</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="progress" label="진행률 (%)">
                  <InputNumber
                    min={0}
                    max={100}
                    style={{ width: '100%' }}
                    size="large"
                    onChange={(value) => {
                      // 진행률 → 상태 자동 연동
                      if (value === 0) {
                        form.setFieldsValue({ status: ItemStatus.NOT_STARTED });
                      } else if (value === 100) {
                        form.setFieldsValue({ status: ItemStatus.COMPLETED });
                      } else if (value !== null && value > 0 && value < 100) {
                        const currentStatus = form.getFieldValue('status');
                        // 보류 상태가 아닐 때만 진행중으로 변경
                        if (currentStatus !== ItemStatus.ON_HOLD) {
                          form.setFieldsValue({ status: ItemStatus.IN_PROGRESS });
                        }
                      }
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* 3행: 일정 (시작일 + 종료일) */}
            <Form.Item label="일정">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="startDate" noStyle>
                  <DatePicker placeholder="시작일" style={{ width: '50%' }} size="large" />
                </Form.Item>
                <Form.Item name="endDate" noStyle>
                  <DatePicker placeholder="종료일" style={{ width: '50%' }} size="large" />
                </Form.Item>
              </Space.Compact>
            </Form.Item>

            {/* 4행: 설명 (전체 너비) */}
            <Form.Item name="description" label="설명">
              <TiptapEditor
                users={users}
                minHeight={120}
                placeholder="설명을 입력하세요. @ 로 멘션할 수 있습니다."
                uploadUrl="/items/upload-image"
              />
            </Form.Item>

            {/* 5행: 담당자 (전체 너비) */}
            <Form.Item name="assigneeId" label="담당자">
              <Select allowClear showSearch optionFilterProp="children" size="large">
                {users.map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.displayName} ({u.username})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

          {/* 첨부 파일 & 링크 섹션 */}
          <Divider style={{ marginTop: 32, marginBottom: 24 }} />

          <Card
            title={
              <Space>
                <span style={{ fontWeight: 600 }}>첨부 파일 & 링크</span>
                <Tag color="blue">{fileList.length + linkList.length}</Tag>
              </Space>
            }
            extra={
              <Space>
                <Upload
                  fileList={fileList}
                  onChange={handleFileChange}
                  onRemove={handleFileRemove}
                  beforeUpload={() => false}
                  showUploadList={false}
                  multiple
                  maxCount={10}
                  disabled={uploading}
                >
                  <Button
                    type="primary"
                    size="small"
                    icon={<UploadOutlined />}
                    loading={uploading}
                  >
                    파일 업로드
                  </Button>
                </Upload>
                <Button
                  type="primary"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={handleLinkAdd}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                  링크 추가
                </Button>
              </Space>
            }
            size="small"
            styles={{ body: { padding: fileList.length + linkList.length > 0 ? '12px' : '24px 12px' } }}
          >
            {fileList.length + linkList.length > 0 ? (
              <List
                size="small"
                dataSource={[
                  ...fileList.map((file) => ({ type: 'file' as const, data: file })),
                  ...linkList.map((link) => ({ type: 'link' as const, data: link }))
                ]}
                renderItem={(item) => {
                  const isFile = item.type === 'file';
                  const data = item.data as any;

                  return (
                    <List.Item
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        backgroundColor: '#fafafa',
                        border: '1px solid #f0f0f0',
                      }}
                      actions={[
                        <Popconfirm
                          title={isFile ? "파일 제거" : "링크 제거"}
                          description={`이 ${isFile ? '파일' : '링크'}을 제거하시겠습니까?`}
                          onConfirm={() => isFile ? handleFileRemove(data) : handleLinkRemove(linkList.indexOf(data))}
                          okText="제거"
                          cancelText="취소"
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          isFile ? (
                            <FileOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                          ) : (
                            <LinkOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                          )
                        }
                        title={
                          <Space size={8}>
                            <Tag
                              color={isFile ? 'blue' : 'green'}
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                marginRight: 0
                              }}
                            >
                              {isFile ? '파일' : '링크'}
                            </Tag>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1
                            }}>
                              {isFile ? data.name : data.displayName}
                            </div>
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: '11px', color: '#8c8c8c', marginLeft: '48px' }}>
                            {isFile ? (
                              <>
                                {(data.size / 1024 / 1024).toFixed(2)} MB
                              </>
                            ) : (
                              <span style={{
                              color: '#1890ff',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%',
                            }}>{data.url}</span>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#bfbfbf', fontSize: '13px' }}>
                첨부 파일 또는 링크가 없습니다
              </div>
            )}
          </Card>
          </>
        )}
      </Form>
    </Drawer>

    {/* 링크 추가 모달 (공통 컴포넌트) */}
    <LinkAddModal
      open={linkModalOpen}
      onCancel={() => setLinkModalOpen(false)}
      onSubmit={handleLinkSubmit}
    />
    </>
  );
};
