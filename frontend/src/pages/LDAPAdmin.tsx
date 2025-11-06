import React, { useState, useEffect } from 'react';
import {
  Typography,
  Tabs,
  Table,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  Popconfirm,
  Card,
  Tag,
  Select,
  Descriptions,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UsergroupAddOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { ldapAdminApi } from '../api/ldap-admin';
import { OrganizationTab } from '../components/OrganizationTab';

const { Title } = Typography;
const { TabPane } = Tabs;

const LDAPAdmin: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [userForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [memberForm] = Form.useForm();

  useEffect(() => {
    loadUsers();
    loadGroups();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await ldapAdminApi.getAllUsers();
      setUsers(response.data);
    } catch (error: any) {
      message.error('사용자 목록 로드 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await ldapAdminApi.getAllGroups();
      setGroups(response.data);
    } catch (error: any) {
      message.error('그룹 목록 로드 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    userForm.resetFields();
    setUserModalOpen(true);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      uid: user.uid,
      cn: user.cn,
      sn: user.sn,
      mail: user.mail,
      displayName: user.displayName,
      telephoneNumber: user.telephoneNumber,
      title: user.title,
      departmentNumber: user.departmentNumber,
    });
    setUserModalOpen(true);
  };

  const handleUserSubmit = async () => {
    try {
      const values = await userForm.validateFields();

      if (editingUser) {
        // Update user
        await ldapAdminApi.updateUser(editingUser.dn, values);
        message.success('사용자가 수정되었습니다');
      } else {
        // Create user
        await ldapAdminApi.createUser(values);
        message.success('사용자가 생성되었습니다');
      }

      setUserModalOpen(false);
      loadUsers();
    } catch (error: any) {
      message.error('작업 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteUser = async (dn: string) => {
    try {
      await ldapAdminApi.deleteUser(dn);
      message.success('사용자가 삭제되었습니다');
      loadUsers();
    } catch (error: any) {
      message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateGroup = () => {
    setEditingGroup(null);
    groupForm.resetFields();
    setGroupModalOpen(true);
  };

  const handleEditGroup = (group: any) => {
    setEditingGroup(group);
    groupForm.setFieldsValue({
      name: group.name,
      description: group.description,
    });
    setGroupModalOpen(true);
  };

  const handleGroupSubmit = async () => {
    try {
      const values = await groupForm.validateFields();

      if (editingGroup) {
        // Update group
        await ldapAdminApi.updateGroup(editingGroup.dn, values);
        message.success('그룹이 수정되었습니다');
      } else {
        // Create group (need at least one member for groupOfNames)
        await ldapAdminApi.createGroup({
          ...values,
          members: [], // LDAP groupOfNames requires at least one member, but we'll handle this on backend
        });
        message.success('그룹이 생성되었습니다');
      }

      setGroupModalOpen(false);
      loadGroups();
    } catch (error: any) {
      message.error('작업 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteGroup = async (dn: string) => {
    try {
      await ldapAdminApi.deleteGroup(dn);
      message.success('그룹이 삭제되었습니다');
      loadGroups();
    } catch (error: any) {
      message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleManageMembers = (group: any) => {
    setSelectedGroup(group);
    memberForm.resetFields();
    setMemberModalOpen(true);
  };

  const handleAddMember = async () => {
    try {
      const values = await memberForm.validateFields();
      await ldapAdminApi.addUserToGroup(selectedGroup.dn, values.userDn);
      message.success('사용자가 그룹에 추가되었습니다');
      loadGroups();
      setMemberModalOpen(false);
    } catch (error: any) {
      message.error('추가 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRemoveMember = async (userDn: string) => {
    try {
      await ldapAdminApi.removeUserFromGroup(selectedGroup.dn, userDn);
      message.success('사용자가 그룹에서 제거되었습니다');
      loadGroups();
    } catch (error: any) {
      message.error('제거 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const userColumns = [
    {
      title: 'UID',
      dataIndex: 'uid',
      key: 'uid',
      width: 120,
    },
    {
      title: '이름',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string, record: any) => text || record.cn,
    },
    {
      title: '이메일',
      dataIndex: 'mail',
      key: 'mail',
    },
    {
      title: '전화번호',
      dataIndex: 'telephoneNumber',
      key: 'telephoneNumber',
    },
    {
      title: '직책',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '부서',
      dataIndex: 'departmentNumber',
      key: 'departmentNumber',
    },
    {
      title: '작업',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          />
          <Popconfirm
            title="사용자 삭제"
            description="이 사용자를 삭제하시겠습니까?"
            onConfirm={() => handleDeleteUser(record.dn)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const groupColumns = [
    {
      title: '그룹명',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '멤버 수',
      dataIndex: 'members',
      key: 'members',
      render: (members: string[]) => (
        <Tag color="blue">{members?.length || 0}명</Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<UsergroupAddOutlined />}
            onClick={() => handleManageMembers(record)}
          >
            멤버 관리
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditGroup(record)}
          />
          <Popconfirm
            title="그룹 삭제"
            description="이 그룹을 삭제하시겠습니까?"
            onConfirm={() => handleDeleteGroup(record.dn)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          LDAP 어드민
        </Title>
        <Button icon={<ReloadOutlined />} onClick={() => { loadUsers(); loadGroups(); }}>
          새로고침
        </Button>
      </div>

      <Tabs defaultActiveKey="users">
        <TabPane
          tab={
            <span>
              <UserOutlined />
              사용자 관리
            </span>
          }
          key="users"
        >
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateUser}
              >
                사용자 추가
              </Button>
            </div>
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="dn"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <TeamOutlined />
              그룹 관리
            </span>
          }
          key="groups"
        >
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateGroup}
              >
                그룹 추가
              </Button>
            </div>
            <Table
              columns={groupColumns}
              dataSource={groups}
              rowKey="dn"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ApartmentOutlined />
              조직도
            </span>
          }
          key="organization"
        >
          <OrganizationTab />
        </TabPane>
      </Tabs>

      {/* User Create/Edit Modal */}
      <Modal
        title={editingUser ? '사용자 수정' : '사용자 추가'}
        open={userModalOpen}
        onOk={handleUserSubmit}
        onCancel={() => setUserModalOpen(false)}
        width={700}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item
            name="uid"
            label="UID (사용자 ID)"
            rules={[{ required: true, message: 'UID를 입력해주세요' }]}
          >
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="cn"
            label="Common Name"
            rules={[{ required: true, message: 'Common Name을 입력해주세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="sn"
            label="Surname (성)"
            rules={[{ required: true, message: '성을 입력해주세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="표시 이름"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="mail"
            label="이메일"
            rules={[{ type: 'email', message: '올바른 이메일 형식이 아닙니다' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="telephoneNumber"
            label="전화번호"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="title"
            label="직책"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="departmentNumber"
            label="부서"
          >
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="password"
              label="비밀번호"
              rules={[{ required: true, message: '비밀번호를 입력해주세요' }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          {editingUser && (
            <Form.Item
              name="password"
              label="새 비밀번호 (선택사항)"
            >
              <Input.Password placeholder="변경하지 않으려면 비워두세요" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Group Create/Edit Modal */}
      <Modal
        title={editingGroup ? '그룹 수정' : '그룹 추가'}
        open={groupModalOpen}
        onOk={handleGroupSubmit}
        onCancel={() => setGroupModalOpen(false)}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="그룹명"
            rules={[{ required: true, message: '그룹명을 입력해주세요' }]}
          >
            <Input disabled={!!editingGroup} />
          </Form.Item>
          <Form.Item
            name="description"
            label="설명"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Group Member Management Modal */}
      <Modal
        title={`그룹 멤버 관리: ${selectedGroup?.name}`}
        open={memberModalOpen}
        onCancel={() => setMemberModalOpen(false)}
        footer={null}
        width={800}
      >
        {selectedGroup && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Form form={memberForm} layout="inline">
                <Form.Item
                  name="userDn"
                  label="사용자 DN"
                  rules={[{ required: true, message: '사용자 DN을 선택해주세요' }]}
                  style={{ flex: 1 }}
                >
                  <Select
                    showSearch
                    placeholder="사용자 선택"
                    optionFilterProp="children"
                  >
                    {users.map((user) => (
                      <Select.Option key={user.dn} value={user.dn}>
                        {user.displayName || user.cn} ({user.uid})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleAddMember}>
                    멤버 추가
                  </Button>
                </Form.Item>
              </Form>
            </div>

            <Descriptions title="현재 멤버" bordered column={1} size="small">
              {selectedGroup.members && selectedGroup.members.length > 0 ? (
                selectedGroup.members.map((memberDn: string) => {
                  const user = users.find((u) => u.dn === memberDn);
                  return (
                    <Descriptions.Item
                      key={memberDn}
                      label={user?.displayName || user?.cn || memberDn}
                    >
                      <Space>
                        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{memberDn}</span>
                        <Popconfirm
                          title="멤버 제거"
                          description="이 사용자를 그룹에서 제거하시겠습니까?"
                          onConfirm={() => handleRemoveMember(memberDn)}
                          okText="제거"
                          cancelText="취소"
                        >
                          <Button type="link" size="small" danger>
                            제거
                          </Button>
                        </Popconfirm>
                      </Space>
                    </Descriptions.Item>
                  );
                })
              ) : (
                <Descriptions.Item label="멤버 없음">
                  그룹에 멤버가 없습니다
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  );
};

export default LDAPAdmin;
