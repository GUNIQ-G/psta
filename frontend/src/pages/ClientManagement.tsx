import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Table,
  Space,
  Modal,
  Drawer,
  Form,
  Input,
  message,
  Upload,
  Image,
  Row,
  Col,
  Divider,
  Card,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  LoadingOutlined,
  PictureOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Client } from '../types';
import { clientsApi } from '../api/clients';
import { PermissionButton } from '../components/PermissionButton';

const { Title } = Typography;
const { TextArea } = Input;

export const ClientManagement: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [form] = Form.useForm();
  const [detailForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await clientsApi.getClients();
      setClients(data);
    } catch (error: any) {
      message.error('클라이언트 조회 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setLogoUrl(null);
    setAddDrawerOpen(true);
  };

  const handleRowClick = (client: Client) => {
    setSelectedClient(client);
    setEditMode(false);
    detailForm.setFieldsValue(client);
    setLogoUrl(client.logoUrl || null);
    setDetailModalOpen(true);
  };

  const handleEnterEditMode = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    if (selectedClient) {
      detailForm.setFieldsValue(selectedClient);
      setLogoUrl(selectedClient.logoUrl || null);
    }
    setEditMode(false);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '클라이언트를 삭제하시겠습니까?',
      content: '관련된 모든 프로젝트 데이터도 함께 영향을 받을 수 있습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await clientsApi.deleteClient(id);
          message.success('삭제되었습니다');
          setDetailModalOpen(false);
          setSelectedClient(null);
          fetchClients();
        } catch (error: any) {
          message.error('삭제 실패: ' + error.message);
        }
      },
    });
  };

  const handleAddSubmit = async () => {
    try {
      const values = await form.validateFields();
      const dataWithLogo = {
        ...values,
        logoUrl: logoUrl,
      };

      await clientsApi.createClient(dataWithLogo);
      message.success('생성되었습니다');

      setAddDrawerOpen(false);
      form.resetFields();
      setLogoUrl(null);
      fetchClients();
    } catch (error: any) {
      if (error.errorFields) {
        return; // Form validation error
      }
      message.error(error.response?.data?.error || '작업 실패');
    }
  };

  const handleUpdateSubmit = async () => {
    if (!selectedClient) return;

    try {
      const values = await detailForm.validateFields();
      const dataWithLogo = {
        ...values,
        logoUrl: logoUrl,
      };

      await clientsApi.updateClient(selectedClient.id, dataWithLogo);
      message.success('수정되었습니다');

      setEditMode(false);
      setDetailModalOpen(false);
      setSelectedClient(null);
      detailForm.resetFields();
      setLogoUrl(null);
      fetchClients();
    } catch (error: any) {
      if (error.errorFields) {
        return; // Form validation error
      }
      message.error(error.response?.data?.error || '작업 실패');
    }
  };

  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    try {
      setUploading(true);
      const uploadedFile = file as File;
      const result = await clientsApi.uploadLogo(uploadedFile);
      setLogoUrl(result.url);
      message.success('이미지가 업로드되었습니다');
      onSuccess?.(result);
    } catch (error: any) {
      message.error('업로드 실패: ' + error.message);
      onError?.(error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    message.success('이미지가 제거되었습니다');
  };

  const columns = [
    {
      title: '고객명',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Client) => {
        return (
          <Space align="center">
            {record.logoUrl ? (
              <Image
                src={record.logoUrl}
                alt={text}
                style={{
                  width: 40,
                  height: 40,
                  objectFit: 'contain',
                  borderRadius: 4,
                  border: '1px solid #f0f0f0',
                }}
                preview={false}
              />
            ) : (
              <ShopOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            )}
            <span style={{ fontWeight: 'bold' }}>{text}</span>
          </Space>
        );
      },
    },
    {
      title: '대표자',
      dataIndex: 'representative',
      key: 'representative',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '사업자번호',
      dataIndex: 'businessNumber',
      key: 'businessNumber',
      width: 180,
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          클라이언트 관리
        </Title>
        <PermissionButton resource="clients" action="canCreate">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            클라이언트 추가
          </Button>
        </PermissionButton>
      </div>

      <Table
        columns={columns}
        dataSource={clients}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* 클라이언트 추가 Drawer */}
      <Drawer
        title="클라이언트 추가"
        placement="right"
        open={addDrawerOpen}
        onClose={() => {
          setAddDrawerOpen(false);
          form.resetFields();
          setLogoUrl(null);
        }}
        width={expanded ? 'calc(100vw - 200px)' : '50%'}
        extra={
          <Space>
            <Button
              onClick={() => {
                setAddDrawerOpen(false);
                form.resetFields();
                setLogoUrl(null);
              }}
            >
              취소
            </Button>
            <Button type="primary" onClick={handleAddSubmit}>
              추가
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
          <Form.Item
            name="name"
            label="고객명"
            rules={[{ required: true, message: '고객명을 입력해주세요' }]}
          >
            <Input placeholder="예: 더존테크윌" size="large" />
          </Form.Item>

          <Form.Item
            name="code"
            label="코드"
            rules={[{ required: true, message: '코드를 입력해주세요' }]}
          >
            <Input placeholder="예: DZ_TECHWILL" size="large" />
          </Form.Item>

          <Form.Item
            name="representative"
            label="대표자"
          >
            <Input placeholder="예: 홍길동" size="large" />
          </Form.Item>

          <Form.Item
            name="businessNumber"
            label="사업자번호"
          >
            <Input placeholder="예: 123-45-67890" size="large" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="전화번호"
          >
            <Input placeholder="예: 02-1234-5678" size="large" />
          </Form.Item>

          <Form.Item
            name="email"
            label="이메일"
            rules={[{ type: 'email', message: '올바른 이메일 형식을 입력해주세요' }]}
          >
            <Input placeholder="예: contact@company.com" size="large" />
          </Form.Item>

          <Form.Item
            name="address"
            label="주소"
          >
            <Input placeholder="예: 서울시 강남구 테헤란로 123" size="large" />
          </Form.Item>

          <Form.Item label="로고 이미지">
            <Upload
              name="logo"
              listType="picture-card"
              showUploadList={false}
              customRequest={handleUpload}
              beforeUpload={(file) => {
                const isImage = file.type.startsWith('image/');
                if (!isImage) {
                  message.error('이미지 파일만 업로드할 수 있습니다!');
                }
                const isLt5M = file.size / 1024 / 1024 < 5;
                if (!isLt5M) {
                  message.error('이미지는 5MB보다 작아야 합니다!');
                }
                return isImage && isLt5M;
              }}
            >
              {logoUrl ? (
                <div style={{ position: 'relative' }}>
                  <Image
                    src={logoUrl}
                    alt="logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    preview={false}
                  />
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLogo();
                    }}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: 'rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    삭제
                  </Button>
                </div>
              ) : (
                <div>
                  {uploading ? <LoadingOutlined /> : <PictureOutlined />}
                  <div style={{ marginTop: 8 }}>로고 업로드</div>
                </div>
              )}
            </Upload>
            <div style={{ color: '#999', fontSize: '12px', marginTop: 8 }}>
              권장 크기: 200x200px, 최대 5MB (JPG, PNG, GIF, WebP)
            </div>
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
          >
            <TextArea rows={4} placeholder="클라이언트에 대한 추가 정보를 입력해주세요" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 클라이언트 상세보기 모달 */}
      <Modal
        title={
          <Space>
            <ShopOutlined style={{ color: '#1890ff' }} />
            <span>클라이언트 상세 정보</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedClient(null);
          setEditMode(false);
          detailForm.resetFields();
          setLogoUrl(null);
        }}
        width={950}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
          },
        }}
        footer={
          editMode ? (
            <Space>
              <Button onClick={handleCancelEdit}>취소</Button>
              <Button type="primary" onClick={handleUpdateSubmit}>
                저장
              </Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => {
                setDetailModalOpen(false);
                setSelectedClient(null);
                detailForm.resetFields();
                setLogoUrl(null);
              }}>
                닫기
              </Button>
              <PermissionButton resource="clients" action="canDelete">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => selectedClient && handleDelete(selectedClient.id)}
                >
                  삭제
                </Button>
              </PermissionButton>
              <PermissionButton resource="clients" action="canUpdate">
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleEnterEditMode}
                >
                  수정
                </Button>
              </PermissionButton>
            </Space>
          )
        }
      >
        {selectedClient && (
          <Form form={detailForm} layout="vertical">
            {/* 로고 이미지 */}
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item label="로고 이미지" style={{ marginBottom: 16 }}>
                  {editMode ? (
                    <Upload
                      name="logo"
                      listType="picture-card"
                      showUploadList={false}
                      customRequest={handleUpload}
                      beforeUpload={(file) => {
                        const isImage = file.type.startsWith('image/');
                        if (!isImage) {
                          message.error('이미지 파일만 업로드할 수 있습니다!');
                        }
                        const isLt5M = file.size / 1024 / 1024 < 5;
                        if (!isLt5M) {
                          message.error('이미지는 5MB보다 작아야 합니다!');
                        }
                        return isImage && isLt5M;
                      }}
                    >
                      {logoUrl ? (
                        <div style={{ position: 'relative' }}>
                          <Image
                            src={logoUrl}
                            alt="logo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            preview={false}
                          />
                          <Button
                            type="text"
                            danger
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveLogo();
                            }}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: 'rgba(255, 255, 255, 0.9)',
                            }}
                          >
                            삭제
                          </Button>
                        </div>
                      ) : (
                        <div>
                          {uploading ? <LoadingOutlined /> : <PictureOutlined />}
                          <div style={{ marginTop: 8 }}>로고 업로드</div>
                        </div>
                      )}
                    </Upload>
                  ) : (
                    <div>
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt="logo"
                          style={{
                            maxWidth: 150,
                            maxHeight: 150,
                            objectFit: 'contain',
                            border: '1px solid #f0f0f0',
                            borderRadius: 4,
                          }}
                        />
                      ) : (
                        <div style={{ color: '#999' }}>로고가 없습니다</div>
                      )}
                    </div>
                  )}
                </Form.Item>
              </Col>
            </Row>

            {/* 기본 정보 - 2열 */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="고객명"
                  rules={[{ required: true, message: '고객명을 입력해주세요' }]}
                  style={{ marginBottom: 16 }}
                >
                  <Input disabled={!editMode} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="코드"
                  rules={[{ required: true, message: '코드를 입력해주세요' }]}
                  style={{ marginBottom: 16 }}
                >
                  <Input disabled={!editMode} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="representative" label="대표자" style={{ marginBottom: 16 }}>
                  <Input disabled={!editMode} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="businessNumber" label="사업자번호" style={{ marginBottom: 16 }}>
                  <Input disabled={!editMode} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="phone" label="전화번호" style={{ marginBottom: 16 }}>
                  <Input disabled={!editMode} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="email"
                  label="이메일"
                  rules={[{ type: 'email', message: '올바른 이메일 형식을 입력해주세요' }]}
                  style={{ marginBottom: 16 }}
                >
                  <Input disabled={!editMode} />
                </Form.Item>
              </Col>
            </Row>

            {/* 주소 - 전체 너비 */}
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="address" label="주소" style={{ marginBottom: 16 }}>
                  <Input disabled={!editMode} />
                </Form.Item>
              </Col>
            </Row>

            {/* 설명 - 전체 너비 */}
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="description" label="설명" style={{ marginBottom: 0 }}>
                  <TextArea rows={3} disabled={!editMode} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}

        {/* 클라이언트 프로젝트 정보 */}
        {selectedClient && (
          <>
            <Divider orientation="left" style={{ marginTop: 24, marginBottom: 16 }}>
              <Space>
                <FolderOutlined style={{ color: '#722ed1' }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>클라이언트 프로젝트 정보</span>
              </Space>
            </Divider>

            {(selectedClient as any).Item && (selectedClient as any).Item.length > 0 ? (
              <Row gutter={[16, 16]}>
                {(selectedClient as any).Item.map((project: any) => (
                  <Col span={12} key={project.id}>
                    <Card
                      size="small"
                      hoverable
                      style={{
                        borderLeft: '3px solid #722ed1',
                      }}
                    >
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space>
                            <FolderOutlined style={{ color: '#722ed1', fontSize: 16 }} />
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{project.name}</span>
                          </Space>
                          <Tag color="purple">프로젝트</Tag>
                        </div>

                        {project.description && (
                          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            {project.description}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                          {project.startDate && project.endDate && (
                            <span style={{ color: '#999' }}>
                              {new Date(project.startDate).toLocaleDateString('ko-KR')} ~ {new Date(project.endDate).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                          {project.User_Item_assigneeIdToUser && (
                            <span style={{ color: '#666' }}>
                              담당: {project.User_Item_assigneeIdToUser.displayName}
                            </span>
                          )}
                        </div>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <Card size="small" style={{ textAlign: 'center', color: '#999' }}>
                등록된 프로젝트가 없습니다
              </Card>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};
