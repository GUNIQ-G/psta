import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Tag,
  Tree,
  Card,
  Row,
  Col,
  Descriptions,
  List,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
  BankOutlined,
  ApartmentOutlined,
  ShopOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { organizationApi, Organization } from '../api/organization';
import { useAuthStore } from '../store/authStore';
import axios from '../api/axios';

const { Option } = Select;
const { TextArea } = Input;

const ORG_TYPE_LABELS = {
  COMPANY: { label: '회사', color: 'purple', icon: <BankOutlined /> },
  DIVISION: { label: '본부', color: 'blue', icon: <ApartmentOutlined /> },
  DEPARTMENT: { label: '부서', color: 'green', icon: <ShopOutlined /> },
  TEAM: { label: '팀', color: 'orange', icon: <TeamOutlined /> },
};

export const OrganizationTab: React.FC = () => {
  const [orgTree, setOrgTree] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [memberForm] = Form.useForm();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadOrganizationTree();
    loadAllUsers();
  }, []);

  const loadOrganizationTree = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getTree();
      setOrgTree(response.data);
    } catch (error: any) {
      message.error('조직도 로드 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await axios.get('/users');
      setAllUsers(response.data);
    } catch (error: any) {
      console.error('사용자 목록 로드 실패:', error);
    }
  };

  const loadOrgDetails = async (id: string) => {
    try {
      const response = await organizationApi.getById(id);
      setSelectedOrg(response.data);
    } catch (error: any) {
      message.error('조직 상세 로드 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  // Convert organization tree to Ant Design Tree data
  const convertToTreeData = (orgs: Organization[]): DataNode[] => {
    return orgs.map(org => ({
      key: org.id,
      title: (
        <span>
          {ORG_TYPE_LABELS[org.type].icon}{' '}
          {org.name}{' '}
          <Tag color={ORG_TYPE_LABELS[org.type].color}>
            {ORG_TYPE_LABELS[org.type].label}
          </Tag>
          {org._count && (
            <>
              <Tag color="blue">{org._count.Members}명</Tag>
              {org._count.Children > 0 && (
                <Tag>{org._count.Children}개 하위</Tag>
              )}
            </>
          )}
        </span>
      ),
      children: org.children && org.children.length > 0 ? convertToTreeData(org.children) : undefined,
    }));
  };

  const handleCreate = () => {
    setEditingOrg(null);
    form.resetFields();
    if (selectedOrg) {
      form.setFieldsValue({ parentId: selectedOrg.id });
    }
    setModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedOrg) return;
    setEditingOrg(selectedOrg);
    form.setFieldsValue({
      name: selectedOrg.name,
      type: selectedOrg.type,
      description: selectedOrg.description,
      parentId: selectedOrg.parentId,
      ldapDn: selectedOrg.ldapDn,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingOrg) {
        await organizationApi.update(editingOrg.id, values);
        message.success('조직이 수정되었습니다');
      } else {
        await organizationApi.create(values);
        message.success('조직이 생성되었습니다');
      }

      setModalOpen(false);
      form.resetFields();
      await loadOrganizationTree();
      if (selectedOrg) {
        await loadOrgDetails(selectedOrg.id);
      }
    } catch (error: any) {
      message.error('처리 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async () => {
    if (!selectedOrg) return;

    try {
      await organizationApi.delete(selectedOrg.id);
      message.success('조직이 삭제되었습니다');
      setSelectedOrg(null);
      await loadOrganizationTree();
    } catch (error: any) {
      message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      loadOrgDetails(selectedKeys[0] as string);
    } else {
      setSelectedOrg(null);
    }
  };

  const handleAddMember = () => {
    if (!selectedOrg) return;
    memberForm.resetFields();
    setMemberModalOpen(true);
  };

  const handleAddMemberSubmit = async () => {
    if (!selectedOrg) return;

    try {
      const values = await memberForm.validateFields();
      await organizationApi.addMember(selectedOrg.id, values.userId);
      message.success('멤버가 추가되었습니다');
      setMemberModalOpen(false);
      memberForm.resetFields();
      await loadOrgDetails(selectedOrg.id);
      await loadAllUsers();
    } catch (error: any) {
      message.error('멤버 추가 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await organizationApi.removeMember(userId);
      message.success('멤버가 제거되었습니다');
      if (selectedOrg) {
        await loadOrgDetails(selectedOrg.id);
      }
      await loadAllUsers();
    } catch (error: any) {
      message.error('멤버 제거 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSyncFromLdap = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.syncFromLdap();
      const { stats } = response.data;
      message.success(
        `LDAP 동기화 완료: 전체 ${stats.total}개, 생성 ${stats.created}개, 수정 ${stats.updated}개, 스킵 ${stats.skipped}개`
      );
      await loadOrganizationTree();
    } catch (error: any) {
      message.error('LDAP 동기화 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Get available users (not in this organization)
  const availableUsers = allUsers.filter(
    u => !selectedOrg?.Members?.some(m => m.id === u.id)
  );

  // Get parent options (all orgs except self and descendants)
  const getParentOptions = (): Organization[] => {
    const flattenOrgs = (orgs: Organization[]): Organization[] => {
      let result: Organization[] = [];
      for (const org of orgs) {
        result.push(org);
        if (org.children && org.children.length > 0) {
          result = result.concat(flattenOrgs(org.children));
        }
      }
      return result;
    };

    const allOrgs = flattenOrgs(orgTree);

    // If editing, exclude self and descendants
    if (editingOrg) {
      const getDescendantIds = (org: Organization): string[] => {
        let ids = [org.id];
        if (org.children && org.children.length > 0) {
          for (const child of org.children) {
            ids = ids.concat(getDescendantIds(child));
          }
        }
        return ids;
      };

      const excludeIds = getDescendantIds(editingOrg);
      return allOrgs.filter(org => !excludeIds.includes(org.id));
    }

    return allOrgs;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ marginBottom: 16 }} size="middle">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          조직 추가
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadOrganizationTree}
        >
          새로고침
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleSyncFromLdap}
          loading={loading}
        >
          LDAP 동기화
        </Button>
      </Space>

      <Row gutter={16}>
        <Col span={10}>
          <Card
            title={
              <Space>
                <ApartmentOutlined />
                조직 구조
              </Space>
            }
            size="small"
          >
            {orgTree.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                조직이 없습니다. 새로운 조직을 추가해주세요.
              </div>
            ) : (
              <Tree
                showLine
                showIcon
                defaultExpandAll
                treeData={convertToTreeData(orgTree)}
                onSelect={handleTreeSelect}
              />
            )}
          </Card>
        </Col>

        <Col span={14}>
          {selectedOrg ? (
            <Card
              title={
                <Space>
                  {ORG_TYPE_LABELS[selectedOrg.type].icon}
                  {selectedOrg.name}
                  <Tag color={ORG_TYPE_LABELS[selectedOrg.type].color}>
                    {ORG_TYPE_LABELS[selectedOrg.type].label}
                  </Tag>
                </Space>
              }
              extra={
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={handleEdit}
                  >
                    수정
                  </Button>
                  <Popconfirm
                    title="조직을 삭제하시겠습니까?"
                    description="하위 조직과 멤버가 없어야 삭제할 수 있습니다."
                    onConfirm={handleDelete}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                    >
                      삭제
                    </Button>
                  </Popconfirm>
                </Space>
              }
              size="small"
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="설명">
                  {selectedOrg.description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="상위 조직">
                  {selectedOrg.Parent ? (
                    <Tag color={ORG_TYPE_LABELS[selectedOrg.Parent.type as keyof typeof ORG_TYPE_LABELS].color}>
                      {selectedOrg.Parent.name}
                    </Tag>
                  ) : (
                    '없음 (최상위)'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="LDAP DN">
                  {selectedOrg.ldapDn || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="하위 조직 수">
                  {selectedOrg.Children?.length || 0}개
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>멤버 ({selectedOrg.Members?.length || 0}명)</strong>
                  <Button
                    type="primary"
                    size="small"
                    icon={<UserAddOutlined />}
                    onClick={handleAddMember}
                  >
                    멤버 추가
                  </Button>
                </div>
                <List
                  size="small"
                  bordered
                  dataSource={selectedOrg.Members || []}
                  locale={{ emptyText: '멤버가 없습니다' }}
                  renderItem={(member: any) => (
                    <List.Item
                      actions={[
                        <Popconfirm
                          key="remove"
                          title="멤버를 제거하시겠습니까?"
                          onConfirm={() => handleRemoveMember(member.id)}
                          okText="제거"
                          cancelText="취소"
                        >
                          <Button
                            type="link"
                            size="small"
                            danger
                            icon={<UserDeleteOutlined />}
                          >
                            제거
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={`${member.displayName} (${member.username})`}
                        description={
                          <Space size={4}>
                            <Tag color="blue">{member.role}</Tag>
                            <span style={{ fontSize: 12, color: '#888' }}>{member.email}</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </Card>
          ) : (
            <Card size="small">
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                조직을 선택하면 상세 정보가 표시됩니다
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal
        title={editingOrg ? '조직 수정' : '조직 추가'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        okText={editingOrg ? '수정' : '추가'}
        cancelText="취소"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="조직명"
            rules={[{ required: true, message: '조직명을 입력해주세요' }]}
          >
            <Input placeholder="예: 솔루션개발본부" />
          </Form.Item>

          <Form.Item
            name="type"
            label="조직 유형"
            rules={[{ required: true, message: '조직 유형을 선택해주세요' }]}
          >
            <Select placeholder="조직 유형 선택">
              {Object.entries(ORG_TYPE_LABELS).map(([key, { label, color, icon }]) => (
                <Option key={key} value={key}>
                  <Space>
                    {icon}
                    <Tag color={color}>{label}</Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="parentId"
            label="상위 조직"
          >
            <Select
              placeholder="상위 조직 선택 (선택사항)"
              allowClear
            >
              {getParentOptions().map(org => (
                <Option key={org.id} value={org.id}>
                  {ORG_TYPE_LABELS[org.type].icon} {org.name} ({ORG_TYPE_LABELS[org.type].label})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
          >
            <TextArea rows={3} placeholder="조직에 대한 설명" />
          </Form.Item>

          <Form.Item
            name="ldapDn"
            label="LDAP DN"
          >
            <Input placeholder="예: ou=개발팀,ou=솔루션개발본부,dc=company,dc=com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        title="멤버 추가"
        open={memberModalOpen}
        onOk={handleAddMemberSubmit}
        onCancel={() => {
          setMemberModalOpen(false);
          memberForm.resetFields();
        }}
        okText="추가"
        cancelText="취소"
      >
        <Form
          form={memberForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="userId"
            label="사용자"
            rules={[{ required: true, message: '사용자를 선택해주세요' }]}
          >
            <Select
              placeholder="사용자 선택"
              showSearch
              optionFilterProp="children"
            >
              {availableUsers.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.displayName} ({user.username}) - {user.email}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
