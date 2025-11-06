import React, { useEffect, useState } from 'react';
import { Drawer, Form, Input, Select, DatePicker, InputNumber, Button, Space, Checkbox, Upload, message, List, Divider, Popconfirm, Modal, Tag, Row, Col, Card } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, UploadOutlined, DeleteOutlined, DownloadOutlined, FileOutlined, LinkOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { Item, ItemType, ItemStatus, FileAttachment, Link } from '../types';
import { itemsApi } from '../api/items';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

interface ItemFormModalProps {
  open: boolean;
  item?: Item | null;
  parentItem?: Item | null;
  onCancel: () => void;
  onSubmit: (values: any) => void;
  onRefresh?: () => void;
  clients: any[];
  users: any[];
  fixedType?: ItemType;
  hideTypeField?: boolean;
  hideTimeSpentField?: boolean;
  hideClientField?: boolean;
  selectedClientId?: string;
  nameLabel?: string;
  projects?: any[];
  services?: any[];
  teams?: any[];
  showParentSelection?: boolean;
  enableActionHierarchyEdit?: boolean;
}

const getStatusText = (status: ItemStatus): string => {
  switch (status) {
    case ItemStatus.NOT_STARTED:
      return '시작 전';
    case ItemStatus.IN_PROGRESS:
      return '진행중';
    case ItemStatus.COMPLETED:
      return '완료';
    case ItemStatus.ON_HOLD:
      return '보류';
    default:
      return status;
  }
};

const getTypeInfo = (type: ItemType): { text: string; color: string } => {
  switch (type) {
    case ItemType.PROJECT:
      return { text: '프로젝트', color: '#722ed1' }; // 보라색
    case ItemType.SERVICE:
      return { text: '서비스', color: '#1890ff' }; // 파란색
    case ItemType.TEAM:
      return { text: '팀', color: '#52c41a' }; // 녹색
    case ItemType.ACTION:
      return { text: '액션', color: '#fa8c16' }; // 주황색
    default:
      return { text: type, color: '#d9d9d9' };
  }
};

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  open,
  item,
  parentItem,
  onCancel,
  onSubmit,
  onRefresh,
  clients,
  users,
  fixedType,
  hideTypeField = false,
  hideTimeSpentField = false,
  hideClientField = false,
  selectedClientId,
  nameLabel = '업무명',
  projects = [],
  services = [],
  teams = [],
  showParentSelection = false,
  enableActionHierarchyEdit = false,
}) => {
  const [form] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [expanded, setExpanded] = useState(false);
  const [currentType, setCurrentType] = useState<ItemType | undefined>(fixedType || item?.type);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [relatedDocs, setRelatedDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveForm] = Form.useForm();
  const [moveTargetProjects, setMoveTargetProjects] = useState<Item[]>([]);
  const [moveTargetServices, setMoveTargetServices] = useState<Item[]>([]);
  const [moveTargetTeams, setMoveTargetTeams] = useState<Item[]>([]);
  const [moveSelectedProjectId, setMoveSelectedProjectId] = useState<string | undefined>();
  const [moveSelectedServiceId, setMoveSelectedServiceId] = useState<string | undefined>();
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>();
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<any[]>([]);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeForm = async () => {
      if (open) {
        if (item) {
          setCurrentType(item.type);

          // Load projects first if this is a SERVICE type
          if (item.type === ItemType.SERVICE && item.clientId) {
            await loadProjects(item.clientId);
          }

          // For ACTION type with enableActionHierarchyEdit, find parent hierarchy
          if (item.type === ItemType.ACTION && enableActionHierarchyEdit) {
            // Find team (direct parent)
            const team = teams.find(t => t.id === item.parentId);
            if (team) {
              // Find service (team's parent)
              const service = services.find(s => s.id === team.parentId);
              if (service) {
                setSelectedServiceId(service.id);
                setFilteredTeams(teams.filter(t => t.parentId === service.id));

                // Find project (service's parent)
                const project = projects.find(p => p.id === service.parentId);
                if (project) {
                  setSelectedProjectId(project.id);
                  setFilteredServices(services.filter(s => s.parentId === project.id));
                }
              }
            }
          }

          // Then set form values
          form.setFieldsValue({
            ...item,
            startDate: item.startDate ? dayjs(item.startDate) : null,
            endDate: item.endDate ? dayjs(item.endDate) : null,
          });

          // Load files and links for existing item
          loadFiles(item.id);
          loadLinks(item.id);
          loadRelatedDocuments(item.id);
        } else {
          setCurrentType(fixedType);
          form.resetFields();
          setFiles([]);
          setLinks([]);
          setSelectedProjectId(undefined);
          setSelectedServiceId(undefined);
          setFilteredServices([]);
          setFilteredTeams([]);
          if (parentItem) {
            form.setFieldsValue({
              parentId: parentItem.id,
              clientId: parentItem.clientId,
            });
          }
          if (fixedType) {
            form.setFieldsValue({
              type: fixedType,
            });
          }
          if (selectedClientId) {
            form.setFieldsValue({
              clientId: selectedClientId,
            });
          }
        }
      }
    };

    initializeForm();
  }, [open]); // item 의존성 제거 - open될 때만 초기화

  const loadProjects = async (clientId?: string) => {
    if (!clientId) {
      setAvailableProjects([]);
      return;
    }
    try {
      const allItems = await itemsApi.getItemTree(clientId);
      // Filter only PROJECT type items
      const projects = allItems.filter((item: Item) => item.type === ItemType.PROJECT);
      setAvailableProjects(projects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setAvailableProjects([]);
    }
  };

  const loadFiles = async (itemId: string) => {
    try {
      const fileList = await filesApi.getItemFiles(itemId);
      setFiles(fileList);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const loadLinks = async (itemId: string) => {
    try {
      const linkList = await linksApi.getItemLinks(itemId);
      setLinks(linkList);
    } catch (error) {
      console.error('Failed to load links:', error);
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

  const handleFileUpload = async (file: File) => {
    if (!item) {
      message.error('항목을 먼저 저장한 후 파일을 업로드할 수 있습니다.');
      return false;
    }

    setUploading(true);
    try {
      const uploadedFile = await filesApi.uploadFile(item.id, file);
      setFiles([...files, uploadedFile]);
      loadRelatedDocuments(item.id); // Reload related documents
      message.success('파일이 업로드되었습니다.');
    } catch (error: any) {
      message.error(error.response?.data?.message || '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
    return false; // Prevent default upload behavior
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      await filesApi.deleteFile(fileId);
      setFiles(files.filter((f) => f.id !== fileId));
      if (item) loadRelatedDocuments(item.id); // Reload related documents
      message.success('파일이 삭제되었습니다.');
    } catch (error: any) {
      message.error(error.response?.data?.message || '파일 삭제에 실패했습니다.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleLinkAdd = () => {
    if (!item) {
      message.error('항목을 먼저 저장한 후 링크를 추가할 수 있습니다.');
      return;
    }
    linkForm.resetFields();
    setLinkModalOpen(true);
  };

  const handleLinkSubmit = async () => {
    try {
      const values = await linkForm.validateFields();
      const newLink = await linksApi.createLink(item!.id, values.url, values.displayName);
      setLinks([...links, newLink]);
      if (item) loadRelatedDocuments(item.id); // Reload related documents
      message.success('링크가 추가되었습니다.');
      setLinkModalOpen(false);
    } catch (error: any) {
      if (!error.errorFields) {
        message.error(error.response?.data?.message || '링크 추가에 실패했습니다.');
      }
    }
  };

  const handleLinkDelete = async (linkId: string) => {
    try {
      await linksApi.deleteLink(linkId);
      setLinks(links.filter((l) => l.id !== linkId));
      if (item) loadRelatedDocuments(item.id); // Reload related documents
      message.success('링크가 삭제되었습니다.');
    } catch (error: any) {
      message.error(error.response?.data?.message || '링크 삭제에 실패했습니다.');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSubmit({
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      });
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleGoToProject = async () => {
    if (!item) return;

    try {
      // 사용자의 팀에 속한 모든 아이템 가져오기
      const allItems = await itemsApi.getItems();
      console.log('All items:', allItems);
      console.log('Current item:', item);
      console.log('User team ID:', user?.teamId);

      // 사용자 팀 ID 확인
      const userTeamId = user?.teamId;

      // 아이템 타입에 따라 이동 가능한 대상 필터링
      if (item.type === ItemType.ACTION) {
        // 액션은 팀으로 이동 가능
        // 모든 프로젝트 가져오기 (관리자가 아니면 필터링 필요할 수 있음)
        const allProjects = allItems.filter((i: Item) => i.type === ItemType.PROJECT);

        // 모든 서비스 가져오기
        const allServices = allItems.filter((i: Item) => i.type === ItemType.SERVICE);

        // 모든 팀 가져오기 (현재 부모 제외)
        const allTeams = allItems.filter((i: Item) => {
          if (i.type !== ItemType.TEAM) return false;
          if (i.id === item.parentId) return false; // 현재 부모는 제외
          return true;
        });

        console.log('ACTION - All Projects:', allProjects);
        console.log('ACTION - All Services:', allServices);
        console.log('ACTION - All Teams:', allTeams);

        setMoveTargetProjects(allProjects);
        setMoveTargetServices(allServices);
        setMoveTargetTeams(allTeams);
      } else if (item.type === ItemType.TEAM) {
        // 팀은 서비스로 이동 가능
        // 모든 서비스 가져오기 (현재 부모 제외)
        const services = allItems.filter((i: Item) => {
          if (i.type !== ItemType.SERVICE) return false;
          if (i.id === item.parentId) return false; // 현재 부모는 제외
          return true;
        });

        console.log('TEAM - Services:', services);

        setMoveTargetServices(services);
      } else if (item.type === ItemType.SERVICE) {
        // 서비스는 프로젝트로 이동 가능
        // 모든 프로젝트 가져오기 (현재 부모 제외)
        const projects = allItems.filter((i: Item) => {
          if (i.type !== ItemType.PROJECT) return false;
          if (i.id === item.parentId) return false; // 현재 부모는 제외
          return true;
        });

        console.log('SERVICE - Projects:', projects);

        setMoveTargetProjects(projects);
      }

      setMoveModalOpen(true);
      moveForm.resetFields();
    } catch (error) {
      console.error('Failed to load move targets:', error);
      message.error('이동 가능한 항목을 불러오는데 실패했습니다.');
    }
  };

  return (
    <>
      <Drawer
        title={item ? '항목 수정' : '새 항목 추가'}
        placement="right"
        open={open}
        onClose={onCancel}
        width={expanded ? 'calc(100vw - 200px)' : '50%'}
        extra={
        <Space>
          {item && currentType === ItemType.ACTION && (
            <Button
              icon={<FolderOutlined />}
              onClick={handleGoToProject}
            >
              프로젝트 이동
            </Button>
          )}
          <Button onClick={onCancel}>취소</Button>
          <Button type="primary" onClick={handleOk}>
            {item ? '수정' : '추가'}
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
        {!showParentSelection && (
          <Form.Item name="parentId" hidden>
            <Input />
          </Form.Item>
        )}

        {showParentSelection && (
          <Form.Item
            name="parentId"
            label="프로젝트"
            rules={[{ required: true, message: '프로젝트를 선택해주세요' }]}
          >
            <Select size="large" placeholder="프로젝트를 선택해주세요">
              {projects.map((project) => (
                <Select.Option key={project.id} value={project.id}>
                  {project.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {/* 1행: 상위필드 (전체 너비) */}
        {/* ACTION 타입이면 계층 선택 필드 표시 */}
        {currentType === ItemType.ACTION && enableActionHierarchyEdit && (
          <>
            <Form.Item
              label="프로젝트"
              rules={[{ required: true, message: '프로젝트를 선택해주세요' }]}
            >
              <Select
                size="large"
                placeholder="프로젝트를 선택해주세요"
                value={selectedProjectId}
                onChange={(value) => {
                  setSelectedProjectId(value);
                  setSelectedServiceId(undefined);
                  setFilteredServices(services.filter(s => s.parentId === value));
                  setFilteredTeams([]);
                  form.setFieldsValue({ parentId: undefined });
                }}
              >
                {projects.map((project) => (
                  <Select.Option key={project.id} value={project.id}>
                    {project.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="서비스"
              rules={[{ required: true, message: '서비스를 선택해주세요' }]}
            >
              <Select
                size="large"
                placeholder="서비스를 선택해주세요"
                value={selectedServiceId}
                onChange={(value) => {
                  setSelectedServiceId(value);
                  setFilteredTeams(teams.filter(t => t.parentId === value));
                  form.setFieldsValue({ parentId: undefined });
                }}
                disabled={!selectedProjectId}
              >
                {filteredServices.map((service) => (
                  <Select.Option key={service.id} value={service.id}>
                    {service.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="parentId"
              label="팀"
              rules={[{ required: true, message: '팀을 선택해주세요' }]}
            >
              <Select
                size="large"
                placeholder="팀을 선택해주세요"
                disabled={true}
                style={{
                  backgroundColor: '#f5f5f5',
                }}
              >
                {filteredTeams.map((team) => (
                  <Select.Option key={team.id} value={team.id}>
                    {team.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}

        {/* ACTION 타입이면서 enableActionHierarchyEdit가 false일 때 팀 필드 표시 (비활성화) */}
        {currentType === ItemType.ACTION && !enableActionHierarchyEdit && item?.Item && (
          <Form.Item label="팀">
            <Input
              size="large"
              disabled
              value={item.Item.name}
              style={{
                backgroundColor: '#f5f5f5',
                color: '#000',
                cursor: 'not-allowed',
              }}
            />
          </Form.Item>
        )}

        {/* 서비스 타입이면 프로젝트 필드 표시 */}
        {currentType === ItemType.SERVICE && (
          <>
            {/* 고객 선택 (수정 모드가 아니거나 고객이 없을 때만 표시) */}
            {(!item || !item.clientId) && (
              <Form.Item
                name="clientId"
                label="고객"
                rules={[{ required: true, message: '고객을 선택해주세요' }]}
              >
                <Select
                  size="large"
                  placeholder="고객을 선택해주세요"
                  onChange={(value) => {
                    loadProjects(value);
                    form.setFieldsValue({ parentId: undefined });
                  }}
                >
                  {clients.map((client) => (
                    <Select.Option key={client.id} value={client.id}>
                      {client.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {item && item.clientId && (
              <Form.Item name="clientId" hidden>
                <Input />
              </Form.Item>
            )}

            <Form.Item
              name="parentId"
              label="프로젝트"
              rules={[{ required: true, message: '프로젝트를 선택해주세요' }]}
            >
              <Select
                size="large"
                placeholder="프로젝트를 선택해주세요"
                onChange={(value) => {
                  const selectedProject = availableProjects.find(p => p.id === value);
                  if (selectedProject) {
                    form.setFieldsValue({ clientId: selectedProject.clientId });
                  }
                }}
              >
                {availableProjects.map((project) => (
                  <Select.Option key={project.id} value={project.id}>
                    {project.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}

        {/* 프로젝트, 팀 타입이면 고객 필드 표시 */}
        {!hideClientField && currentType !== ItemType.SERVICE && currentType !== ItemType.ACTION && (
          <Form.Item name="clientId" label="고객">
            <Select
              allowClear
              size="large"
              onChange={(value) => {
                if (currentType === ItemType.SERVICE && value) {
                  loadProjects(value);
                }
              }}
            >
              {clients.map((client) => (
                <Select.Option key={client.id} value={client.id}>
                  {client.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {/* 2행: 업무명 (라벨에 구분 태그 포함) */}
        <Form.Item
          name="name"
          label={
            <Space size={8}>
              <span>{nameLabel}</span>
              {!hideTypeField && (
                <>
                  {item ? (
                    <Tag
                      color={getTypeInfo(currentType || item.type).color}
                      style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {getTypeInfo(currentType || item.type).text}
                    </Tag>
                  ) : (
                    <Tag
                      color="#d9d9d9"
                      style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      구분 선택 필요
                    </Tag>
                  )}
                </>
              )}
            </Space>
          }
          rules={[{ required: true, message: `${nameLabel}을 입력해주세요` }]}
        >
          <Input size="large" />
        </Form.Item>

        {/* 구분 선택 필드 (생성 모드에서만 표시) */}
        {!item && !hideTypeField && (
          <Form.Item
            name="type"
            label="구분"
            rules={[{ required: true, message: '구분을 선택해주세요' }]}
          >
            <Select
              size="large"
              onChange={(value: ItemType) => {
                setCurrentType(value);
                if (value === ItemType.SERVICE) {
                  const clientId = form.getFieldValue('clientId');
                  if (clientId) {
                    loadProjects(clientId);
                  }
                }
              }}
            >
              <Select.Option value={ItemType.PROJECT}>
                <Tag color={getTypeInfo(ItemType.PROJECT).color} style={{ marginRight: 8 }}>
                  {getTypeInfo(ItemType.PROJECT).text}
                </Tag>
              </Select.Option>
              <Select.Option value={ItemType.SERVICE}>
                <Tag color={getTypeInfo(ItemType.SERVICE).color} style={{ marginRight: 8 }}>
                  {getTypeInfo(ItemType.SERVICE).text}
                </Tag>
              </Select.Option>
              <Select.Option value={ItemType.TEAM}>
                <Tag color={getTypeInfo(ItemType.TEAM).color} style={{ marginRight: 8 }}>
                  {getTypeInfo(ItemType.TEAM).text}
                </Tag>
              </Select.Option>
              <Select.Option value={ItemType.ACTION}>
                <Tag color={getTypeInfo(ItemType.ACTION).color} style={{ marginRight: 8 }}>
                  {getTypeInfo(ItemType.ACTION).text}
                </Tag>
              </Select.Option>
            </Select>
          </Form.Item>
        )}

        {/* hidden type field for edit mode */}
        {item && (
          <Form.Item name="type" hidden>
            <Input />
          </Form.Item>
        )}

        {hideTypeField && (
          <Form.Item name="type" hidden>
            <Input />
          </Form.Item>
        )}

        {/* 3행: 상태 + 진행률 */}
        <Row gutter={16}>
          <Col span={12}>
            {/* ACTION만 수동 입력 가능 */}
            {currentType === ItemType.ACTION && (
              <Form.Item name="status" label="상태">
                <Select size="large">
                  <Select.Option value={ItemStatus.NOT_STARTED}>시작 전</Select.Option>
                  <Select.Option value={ItemStatus.IN_PROGRESS}>진행중</Select.Option>
                  <Select.Option value={ItemStatus.COMPLETED}>완료</Select.Option>
                  <Select.Option value={ItemStatus.ON_HOLD}>보류</Select.Option>
                </Select>
              </Form.Item>
            )}

            {/* TEAM, SERVICE, PROJECT는 자동 산정 */}
            {currentType && currentType !== ItemType.ACTION && (
              <Form.Item label="상태">
                <Input
                  size="large"
                  disabled
                  value={item ? getStatusText(item.status) : '하위 항목 생성 후 자동 계산됨'}
                  style={{
                    backgroundColor: '#f5f5f5',
                    color: '#000',
                    cursor: 'not-allowed',
                  }}
                />
              </Form.Item>
            )}
          </Col>

          <Col span={12}>
            {/* ACTION만 수동 입력 가능 */}
            {currentType === ItemType.ACTION && (
              <Form.Item name="progress" label="진행률 (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} size="large" />
              </Form.Item>
            )}

            {/* TEAM, SERVICE, PROJECT는 자동 산정 */}
            {currentType && currentType !== ItemType.ACTION && (
              <Form.Item label="진행률 (%)">
                <Input
                  size="large"
                  disabled
                  value={item ? `${item.progress}%` : '하위 항목 생성 후 자동 계산됨'}
                  style={{
                    backgroundColor: '#f5f5f5',
                    color: '#000',
                    cursor: 'not-allowed',
                  }}
                />
              </Form.Item>
            )}
          </Col>
        </Row>

        {/* 보류 체크박스 - TEAM, SERVICE, PROJECT만 표시 (수정 모드일 때만) */}
        {currentType && currentType !== ItemType.ACTION && item && (
          <Form.Item name="isOnHold" valuePropName="checked" style={{ marginBottom: 16 }}>
            <Checkbox>
              보류 (체크하면 상태가 자동으로 '보류'로 설정됩니다)
            </Checkbox>
          </Form.Item>
        )}

        {/* 4행: 일정 (시작일 + 종료일) */}
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

        {/* 5행: 설명 (전체 너비) */}
        <Form.Item name="description" label="설명">
          <Input.TextArea rows={4} />
        </Form.Item>

        {/* 6행: 담당자 (전체 너비) */}
        <Form.Item name="assigneeId" label="담당자">
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            size="large"
            disabled={
              // ACTION 수정 모드일 때만 권한 체크
              item && currentType === ItemType.ACTION && (() => {
                // 담당자 본인인지 확인
                const isAssignee = item.assigneeId === user?.id;
                // PM 이상 역할인지 확인 (ADMIN, PO, PM)
                const isPMOrAbove = user?.role === 'ADMIN' || user?.role === 'PO' || user?.role === 'PM';
                // 담당자 본인이거나 PM 이상이면 수정 가능 (disabled = false)
                // 그 외에는 수정 불가 (disabled = true)
                return !isAssignee && !isPMOrAbove;
              })()
            }
          >
            {users.map((user) => (
              <Select.Option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* 첨부 파일 & 링크 섹션 - 수정 모드이고 팀 또는 액션일 때만 표시 */}
        {item && currentType && (currentType === ItemType.TEAM || currentType === ItemType.ACTION) && (
          <>
            <Divider style={{ marginTop: 32, marginBottom: 24 }} />

            <Card
              title={
                <Space>
                  <span style={{ fontWeight: 600 }}>첨부 파일 & 링크</span>
                  <Tag color="blue">{files.length + links.length}</Tag>
                </Space>
              }
              extra={
                <Space>
                  <Upload
                    beforeUpload={handleFileUpload}
                    showUploadList={false}
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
              styles={{ body: { padding: files.length + links.length > 0 ? '12px' : '24px 12px' } }}
            >
              {files.length + links.length > 0 ? (
                <List
                  size="small"
                  dataSource={[
                    ...files.map((file) => ({ type: 'file' as const, data: file })),
                    ...links.map((link) => ({ type: 'link' as const, data: link }))
                  ]}
                  renderItem={(item) => {
                    const isFile = item.type === 'file';
                    const data = item.data as any;
                    const canDelete = user?.role === 'ADMIN' || user?.id === (isFile ? data.uploadedById : data.createdById);

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
                          isFile ? (
                            <Button
                              type="text"
                              size="small"
                              icon={<DownloadOutlined />}
                              href={filesApi.getFileUrl(data.filename)}
                              target="_blank"
                              style={{ color: '#1890ff' }}
                            />
                          ) : (
                            <Button
                              type="text"
                              size="small"
                              icon={<LinkOutlined />}
                              href={data.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#52c41a' }}
                            />
                          ),
                          canDelete && (
                            <Popconfirm
                              title={isFile ? "파일 삭제" : "링크 삭제"}
                              description={`이 ${isFile ? '파일' : '링크'}을 삭제하시겠습니까?`}
                              onConfirm={() => isFile ? handleFileDelete(data.id) : handleLinkDelete(data.id)}
                              okText="삭제"
                              cancelText="취소"
                            >
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                              />
                            </Popconfirm>
                          ),
                        ].filter(Boolean)}
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
                                {isFile ? data.originalName : data.displayName}
                              </div>
                            </Space>
                          }
                          description={
                            <div style={{ fontSize: '11px', color: '#8c8c8c', marginLeft: '48px' }}>
                              {isFile ? (
                                <>
                                  {formatFileSize(data.filesize)} • {data.UploadedBy?.displayName || '알 수 없음'}
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#1890ff' }}>{data.url}</span> • {data.CreatedBy?.displayName || '알 수 없음'}
                                </>
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
            <Input placeholder="예: 프로젝트 문서" />
          </Form.Item>
          <Form.Item
            name="url"
            label="URL"
            rules={[
              { required: true, message: 'URL을 입력해주세요' },
              { type: 'url', message: '올바른 URL을 입력해주세요' }
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 프로젝트 이동 모달 */}
      <Modal
        title={`${getTypeInfo(item?.type || ItemType.ACTION).text} 이동`}
        open={moveModalOpen}
        onOk={async () => {
          try {
            const values = await moveForm.validateFields();

            // 이동할 부모 ID 결정
            let newParentId: string | undefined;
            if (item?.type === ItemType.ACTION) {
              newParentId = values.teamId;
            } else if (item?.type === ItemType.TEAM) {
              newParentId = values.serviceId;
            } else if (item?.type === ItemType.SERVICE) {
              newParentId = values.projectId;
            }

            if (!newParentId || !item) {
              message.error('이동할 위치를 선택해주세요.');
              return;
            }

            // 아이템 이동 API 호출
            await itemsApi.moveItem(item.id, newParentId);

            message.success('성공적으로 이동되었습니다.');
            setMoveModalOpen(false);
            moveForm.resetFields();

            // 부모 컴포넌트에 변경사항 알림
            onCancel(); // 모달 닫기
            if (onRefresh) {
              onRefresh(); // ItemTree 새로고침
            }
          } catch (error: any) {
            console.error('Failed to move item:', error);
            if (error.errorFields) {
              // 폼 검증 에러
              return;
            }
            message.error('이동에 실패했습니다.');
          }
        }}
        onCancel={() => {
          setMoveModalOpen(false);
          moveForm.resetFields();
          setMoveSelectedProjectId(undefined);
          setMoveSelectedServiceId(undefined);
        }}
        okText="이동"
        cancelText="취소"
      >
        <Form form={moveForm} layout="vertical">
          {item?.type === ItemType.SERVICE && (
            <Form.Item
              name="projectId"
              label="이동할 프로젝트 선택"
              rules={[{ required: true, message: '프로젝트를 선택해주세요' }]}
            >
              <Select
                placeholder="프로젝트 선택"
                options={moveTargetProjects.map((p) => ({
                  label: p.name,
                  value: p.id,
                }))}
              />
            </Form.Item>
          )}

          {item?.type === ItemType.TEAM && (
            <>
              <Form.Item
                name="serviceId"
                label="이동할 서비스 선택"
                rules={[{ required: true, message: '서비스를 선택해주세요' }]}
              >
                <Select
                  placeholder="서비스 선택"
                  options={moveTargetServices.map((s) => ({
                    label: s.name,
                    value: s.id,
                  }))}
                />
              </Form.Item>
            </>
          )}

          {item?.type === ItemType.ACTION && (
            <>
              <Form.Item
                name="projectId"
                label="프로젝트 선택"
                rules={[{ required: true, message: '프로젝트를 선택해주세요' }]}
              >
                <Select
                  placeholder="프로젝트 선택"
                  value={moveSelectedProjectId}
                  onChange={(value) => {
                    setMoveSelectedProjectId(value);
                    setMoveSelectedServiceId(undefined);
                    moveForm.setFieldValue('serviceId', undefined);
                    moveForm.setFieldValue('teamId', undefined);

                    // 선택된 프로젝트의 서비스들 필터링
                    const services = moveTargetServices.filter((s) => s.parentId === value);
                    setMoveTargetServices(services);
                  }}
                  options={moveTargetProjects.map((p) => ({
                    label: p.name,
                    value: p.id,
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="serviceId"
                label="서비스 선택"
                rules={[{ required: true, message: '서비스를 선택해주세요' }]}
              >
                <Select
                  placeholder="서비스 선택"
                  disabled={!moveSelectedProjectId}
                  value={moveSelectedServiceId}
                  onChange={(value) => {
                    setMoveSelectedServiceId(value);
                    moveForm.setFieldValue('teamId', undefined);

                    // 선택된 서비스의 팀들 필터링
                    const teams = moveTargetTeams.filter((t) => t.parentId === value);
                    setMoveTargetTeams(teams);
                  }}
                  options={moveTargetServices
                    .filter((s) => s.parentId === moveSelectedProjectId)
                    .map((s) => ({
                      label: s.name,
                      value: s.id,
                    }))}
                />
              </Form.Item>

              <Form.Item
                name="teamId"
                label="이동할 팀 선택"
                rules={[{ required: true, message: '팀을 선택해주세요' }]}
              >
                <Select
                  placeholder="팀 선택"
                  disabled={!moveSelectedServiceId}
                  options={moveTargetTeams
                    .filter((t) => t.parentId === moveSelectedServiceId)
                    .map((t) => ({
                      label: t.name,
                      value: t.id,
                    }))}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Drawer>
    </>
  );
};