import React, { useState, useEffect } from 'react';
import { Drawer, Button, Space, Select, Form, Input, InputNumber, DatePicker, message, Upload, Divider, Modal, List, Popconfirm, Card, Tag, Row, Col } from 'antd';
import { FolderOutlined, AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, UploadOutlined, DeleteOutlined, LinkOutlined, FileOutlined } from '@ant-design/icons';
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
  const [linkForm] = Form.useForm();

  useEffect(() => {
    if (open && userTeamId) {
      fetchUserTeam();
      fetchUsers();
    }
  }, [open, userTeamId]);

  useEffect(() => {
    if (userTeamName) {
      fetchProjects();
    }
  }, [userTeamName]);

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
    if (selectedProject === 'undecided') {
      // If project is undecided, set service to undecided automatically
      setServices([]);
      setSelectedService('undecided');
    } else if (selectedProject) {
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
    if (!userTeamName) return;

    try {
      // Fetch all projects
      const allProjects = await itemsApi.getItems({
        type: ItemType.PROJECT,
        parentId: null,
      });

      // For each project, check if it has services with the user's team
      const projectsWithUserTeam = [];
      for (const project of allProjects) {
        const projectServices = await itemsApi.getItems({
          type: ItemType.SERVICE,
          parentId: project.id,
        });

        for (const service of projectServices) {
          const serviceTeams = await itemsApi.getItems({
            type: ItemType.TEAM,
            parentId: service.id,
          });

          // Check if user's team is in this service
          const hasUserTeam = serviceTeams.some((team: any) => team.name === userTeamName);
          if (hasUserTeam) {
            projectsWithUserTeam.push(project);
            break; // Found user's team in this project, no need to check other services
          }
        }
      }

      setProjects(projectsWithUserTeam);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      message.error('프로젝트 조회 실패');
    }
  };

  const fetchServices = async () => {
    if (!selectedProject || !userTeamName) return;

    try {
      const allServices = await itemsApi.getItems({
        type: ItemType.SERVICE,
        parentId: selectedProject,
      });

      // Filter services that have the user's team
      const servicesWithUserTeam = [];
      for (const service of allServices) {
        const serviceTeams = await itemsApi.getItems({
          type: ItemType.TEAM,
          parentId: service.id,
        });

        const hasUserTeam = serviceTeams.some((team: any) => team.name === userTeamName);
        if (hasUserTeam) {
          servicesWithUserTeam.push(service);
        }
      }

      setServices(servicesWithUserTeam);
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

  const findOrCreateUndecidedHierarchy = async (): Promise<string | null> => {
    if (!userTeamName) return null;

    try {
      // Find or create "미정" project
      let undecidedProject = await itemsApi.getItems({
        type: ItemType.PROJECT,
        parentId: null,
      });
      let projectItem = undecidedProject.find((p: any) => p.name === '미정 프로젝트');

      if (!projectItem) {
        projectItem = await itemsApi.createItem({
          name: '미정 프로젝트',
          type: ItemType.PROJECT,
          status: ItemStatus.NOT_STARTED,
          progress: 0,
          description: '프로젝트가 미정인 액션들을 위한 임시 프로젝트',
        });
      }

      // Find or create "미정" service under the project
      let undecidedServices = await itemsApi.getItems({
        type: ItemType.SERVICE,
        parentId: projectItem.id,
      });
      let serviceItem = undecidedServices.find((s: any) => s.name === '미정 서비스');

      if (!serviceItem) {
        serviceItem = await itemsApi.createItem({
          name: '미정 서비스',
          type: ItemType.SERVICE,
          parentId: projectItem.id,
          status: ItemStatus.NOT_STARTED,
          progress: 0,
          description: '서비스가 미정인 액션들을 위한 임시 서비스',
        });
      }

      // Find or create user's team under the service
      let serviceTeams = await itemsApi.getItems({
        type: ItemType.TEAM,
        parentId: serviceItem.id,
      });
      let teamItem = serviceTeams.find((t: any) => t.name === userTeamName);

      if (!teamItem) {
        teamItem = await itemsApi.createItem({
          name: userTeamName,
          type: ItemType.TEAM,
          parentId: serviceItem.id,
          status: ItemStatus.NOT_STARTED,
          progress: 0,
        });
      }

      return teamItem.id;
    } catch (error) {
      console.error('Failed to find/create undecided hierarchy:', error);
      return null;
    }
  };

  const findUserTeamItem = async (): Promise<string | null> => {
    if (!userTeamName) return null;

    // If service is undecided, use/create undecided hierarchy
    if (selectedService === 'undecided') {
      return await findOrCreateUndecidedHierarchy();
    }

    try {
      const serviceTeams = await itemsApi.getItems({
        type: ItemType.TEAM,
        parentId: selectedService,
      });

      const userTeam = serviceTeams.find((team: any) => team.name === userTeamName);
      return userTeam?.id || null;
    } catch (error) {
      console.error('Failed to find user team:', error);
      return null;
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

      // Find user's team item
      const teamItemId = await findUserTeamItem();

      if (!teamItemId) {
        message.error('소속 팀을 찾을 수 없습니다. 관리자에게 문의하세요.');
        setLoading(false);
        return;
      }

      // Create action item
      const actionData: any = {
        name: values.name,
        type: ItemType.ACTION,
        parentId: teamItemId,
        assigneeId: values.assigneeId,
        status: values.status || ItemStatus.NOT_STARTED,
        progress: values.progress || 0,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        description: values.description,
      };

      // Add metadata for undecided project/service
      if (selectedProject === 'undecided' || selectedService === 'undecided') {
        actionData.description = `${actionData.description || ''}\n\n[미정 정보]\n프로젝트: ${
          selectedProject === 'undecided' ? '미정' : '지정됨'
        }\n서비스: ${selectedService === 'undecided' ? '미정' : '지정됨'}`;
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

      // If project or service is undecided, notify team leader
      if (selectedProject === 'undecided' || selectedService === 'undecided') {
        try {
          // TODO: Send notification to team leader
          // This could be implemented as a separate API call
          console.log('Notify team leader: Action created with undecided project/service');
          message.info('팀장에게 알림이 전송되었습니다');
        } catch (notifyError) {
          console.error('Failed to notify team leader:', notifyError);
        }
      }

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
    linkForm.resetFields();
    setLinkModalOpen(true);
  };

  const handleLinkSubmit = async () => {
    try {
      const values = await linkForm.validateFields();
      setLinkList([...linkList, { url: values.url, displayName: values.displayName }]);
      message.success('링크가 추가되었습니다');
      setLinkModalOpen(false);
    } catch (error) {
      // Form validation error
    }
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
            <Select.Option value="undecided">
              <Space>
                <FolderOutlined style={{ color: '#999' }} />
                <span style={{ color: '#999' }}>프로젝트 미정</span>
              </Space>
            </Select.Option>
            {projects.map((project) => (
              <Select.Option key={project.id} value={project.id}>
                <Space>
                  <FolderOutlined style={{ color: '#722ed1' }} />
                  {project.name}
                </Space>
              </Select.Option>
            ))}
          </Select>
          {projects.length === 0 && (
            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
              소속 팀이 할당된 프로젝트가 없습니다. "프로젝트 미정"을 선택하세요.
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
              disabled={selectedProject === 'undecided'}
            >
              <Select.Option value="undecided">
                <Space>
                  <AppstoreOutlined style={{ color: '#999' }} />
                  <span style={{ color: '#999' }}>서비스 미정</span>
                </Space>
              </Select.Option>
              {services.map((service) => (
                <Select.Option key={service.id} value={service.id}>
                  <Space>
                    <AppstoreOutlined style={{ color: '#1890ff' }} />
                    {service.name}
                  </Space>
                </Select.Option>
              ))}
            </Select>
            {services.length === 0 && selectedProject !== 'undecided' && (
              <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                소속 팀이 할당된 서비스가 없습니다. "서비스 미정"을 선택하세요.
              </div>
            )}
            {selectedProject === 'undecided' && (
              <div style={{ marginTop: 8, color: '#ffa940', fontSize: 12 }}>
                ⚠️ 프로젝트가 미정으로 설정되어 서비스도 자동으로 "미정"으로 설정됩니다.
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

            {/* 2행: 상태 + 진행률 */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="status" label="상태">
                  <Select size="large">
                    <Select.Option value={ItemStatus.NOT_STARTED}>시작 전</Select.Option>
                    <Select.Option value={ItemStatus.IN_PROGRESS}>진행중</Select.Option>
                    <Select.Option value={ItemStatus.COMPLETED}>완료</Select.Option>
                    <Select.Option value={ItemStatus.ON_HOLD}>보류</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="progress" label="진행률 (%)">
                  <InputNumber min={0} max={100} style={{ width: '100%' }} size="large" />
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
              <Input.TextArea rows={4} placeholder="설명을 입력하세요" />
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
                              <span style={{ color: '#1890ff' }}>{data.url}</span>
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

    {/* 링크 추가 모달 */}
    <Modal
      title="링크 추가"
      open={linkModalOpen}
      onOk={handleLinkSubmit}
      onCancel={() => setLinkModalOpen(false)}
      okText="추가"
      cancelText="취소"
    >
      <Form form={linkForm} layout="vertical">
        <Form.Item
          name="displayName"
          label="표시명"
          rules={[{ required: true, message: '표시명을 입력해주세요' }]}
        >
          <Input placeholder="예: 프로젝트 문서, API 명세서" />
        </Form.Item>
        <Form.Item
          name="url"
          label="URL"
          rules={[
            { required: true, message: 'URL을 입력해주세요' },
            { type: 'url', message: '올바른 URL 형식이 아닙니다' }
          ]}
        >
          <Input placeholder="https://example.com" />
        </Form.Item>
      </Form>
    </Modal>
    </>
  );
};
