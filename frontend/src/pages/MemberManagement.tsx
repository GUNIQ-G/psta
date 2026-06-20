import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm,
  message, Typography, Alert, Tooltip, Tabs,
} from 'antd';
import {
  PlusOutlined, EditOutlined, LockOutlined, PoweroffOutlined,
  UserOutlined, ApiOutlined, SyncOutlined, IdcardOutlined, TeamOutlined,
} from '@ant-design/icons';
import axiosInstance from '../api/axios';
import { teamApi } from '../api/team';
import { UserRole, ROLE_DISPLAY_NAMES } from '../types/user';
import { LDAPAuth } from './LDAPAuth';
import LdapSyncManagement from './LdapSyncManagement';
import { TeamManagement } from './TeamManagement';

const { Title, Text } = Typography;
const { Option } = Select;

interface Member {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  authType: string;
  isActive: boolean;
  isVerified: boolean;
  teamId?: string;
  Team?: { id: string; name: string } | null;
}

interface Team { id: string; name: string; }

// ─── 멤버 조회 탭 ───────────────────────────────────────────────────────────
const MemberListTab: React.FC<{ ldapEnabled: boolean }> = ({ ldapEnabled }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [res, teamsData] = await Promise.all([
        axiosInstance.get('/admin/members'),
        teamApi.getAll(),
      ]);
      setMembers(res.data.users);
      setTeams(teamsData);
    } catch {
      message.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (values: any) => {
    setSaving(true);
    try {
      await axiosInstance.post('/admin/members', values);
      message.success('멤버 생성 완료');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (e: any) {
      message.error(e.response?.data?.error || '생성 실패');
    } finally { setSaving(false); }
  };

  const handleEdit = async (values: any) => {
    if (!selected) return;
    setSaving(true);
    try {
      await axiosInstance.put(`/admin/members/${selected.id}`, values);
      message.success('수정 완료');
      setEditOpen(false);
      load();
    } catch (e: any) {
      message.error(e.response?.data?.error || '수정 실패');
    } finally { setSaving(false); }
  };

  const handleResetPw = async (values: any) => {
    if (!selected) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/admin/members/${selected.id}/reset-password`, { newPassword: values.newPassword });
      message.success('비밀번호 초기화 완료');
      setResetOpen(false);
      resetForm.resetFields();
    } catch (e: any) {
      message.error(e.response?.data?.error || '초기화 실패');
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (member: Member) => {
    try {
      await axiosInstance.put(`/admin/members/${member.id}/toggle-active`);
      message.success(member.isActive ? '비활성화 완료' : '활성화 완료');
      load();
    } catch (e: any) {
      message.error(e.response?.data?.error || '변경 실패');
    }
  };

  const openEdit = (m: Member) => {
    setSelected(m);
    editForm.setFieldsValue({
      displayName: m.displayName,
      email: m.email,
      phoneNumber: m.phoneNumber,
      role: m.role,
      teamId: m.teamId || undefined,
    });
    setEditOpen(true);
  };

  const openReset = (m: Member) => {
    setSelected(m);
    resetForm.resetFields();
    setResetOpen(true);
  };

  const roleColor: Record<string, string> = {
    ADMIN: 'red', PO: 'purple', PM: 'blue', MEMBER: 'default',
  };

  const columns = [
    {
      title: '이름',
      dataIndex: 'displayName',
      render: (v: string, r: Member) => (
        <Space>
          <UserOutlined />
          <span>{v}</span>
          {!r.isActive && <Tag color="red">비활성</Tag>}
        </Space>
      ),
    },
    { title: '아이디', dataIndex: 'username' },
    { title: '이메일', dataIndex: 'email' },
    {
      title: '역할',
      dataIndex: 'role',
      render: (v: string) => <Tag color={roleColor[v]}>{ROLE_DISPLAY_NAMES[v as UserRole] || v}</Tag>,
    },
    {
      title: '인증',
      dataIndex: 'authType',
      render: (v: string) => (
        <Tag color={v === 'LOCAL' ? 'green' : 'blue'} icon={v === 'LOCAL' ? <LockOutlined /> : <ApiOutlined />}>
          {v}
        </Tag>
      ),
    },
    {
      title: '팀',
      dataIndex: 'Team',
      render: (t: any) => t?.name || '-',
    },
    {
      title: '관리',
      key: 'actions',
      render: (_: any, record: Member) => (
        <Space>
          <Tooltip title="정보 수정">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          {record.authType === 'LOCAL' && (
            <Tooltip title="비밀번호 초기화">
              <Button size="small" icon={<LockOutlined />} onClick={() => openReset(record)} />
            </Tooltip>
          )}
          <Tooltip title={record.isActive ? '비활성화' : '활성화'}>
            <Popconfirm
              title={record.isActive ? '이 계정을 비활성화하시겠습니까?' : '이 계정을 활성화하시겠습니까?'}
              onConfirm={() => handleToggleActive(record)}
              okText="확인" cancelText="취소"
            >
              <Button
                size="small"
                icon={<PoweroffOutlined />}
                danger={record.isActive}
                type={record.isActive ? 'default' : 'primary'}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      {ldapEnabled && (
        <Alert
          type="info"
          showIcon
          icon={<ApiOutlined />}
          style={{ marginBottom: 16 }}
          message="LDAP 인증 사용 중"
          description="LDAP이 활성화되어 있습니다. 로컬 계정 생성은 비활성화됩니다. 정보 수정·비활성화는 계속 가능합니다."
        />
      )}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">전체 {members.length}명</Text>
        <Tooltip title={ldapEnabled ? 'LDAP 사용 중에는 로컬 계정을 생성할 수 없습니다.' : ''}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={ldapEnabled}
            onClick={() => { createForm.resetFields(); setCreateOpen(true); }}
          >
            멤버 추가
          </Button>
        </Tooltip>
      </div>

      <Table
        dataSource={members}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="middle"
      />

      {/* 생성 모달 */}
      <Modal title="새 멤버 추가" open={createOpen} onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()} confirmLoading={saving} okText="생성" cancelText="취소">
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="아이디" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="displayName" label="이름" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="이메일"><Input /></Form.Item>
          <Form.Item name="phoneNumber" label="전화번호"><Input /></Form.Item>
          <Form.Item name="password" label="초기 비밀번호" rules={[{ required: true }, { min: 6, message: '6자 이상' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="역할" initialValue="MEMBER">
            <Select>{Object.values(UserRole).map(r => <Option key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</Option>)}</Select>
          </Form.Item>
          <Form.Item name="teamId" label="팀">
            <Select allowClear placeholder="선택">
              {teams.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 수정 모달 */}
      <Modal title={`정보 수정 — ${selected?.username}`} open={editOpen}
        onCancel={() => setEditOpen(false)} onOk={() => editForm.submit()}
        confirmLoading={saving} okText="저장" cancelText="취소">
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="displayName" label="이름" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="이메일"><Input /></Form.Item>
          <Form.Item name="phoneNumber" label="전화번호"><Input /></Form.Item>
          <Form.Item name="role" label="역할">
            <Select>{Object.values(UserRole).map(r => <Option key={r} value={r}>{ROLE_DISPLAY_NAMES[r]}</Option>)}</Select>
          </Form.Item>
          <Form.Item name="teamId" label="팀">
            <Select allowClear>{teams.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}</Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 비밀번호 초기화 모달 */}
      <Modal title={`비밀번호 초기화 — ${selected?.username}`} open={resetOpen}
        onCancel={() => setResetOpen(false)} onOk={() => resetForm.submit()}
        confirmLoading={saving} okText="초기화" cancelText="취소">
        <Form form={resetForm} layout="vertical" onFinish={handleResetPw}>
          <Form.Item name="newPassword" label="새 비밀번호" rules={[{ required: true }, { min: 6, message: '6자 이상' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm" label="비밀번호 확인" dependencies={['newPassword']}
            rules={[{ required: true }, ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject('비밀번호가 일치하지 않습니다.');
              },
            })]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── LDAP 인증 탭 ───────────────────────────────────────────────────────────
const LdapTab: React.FC = () => {
  const [syncOpen, setSyncOpen] = useState(false);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<SyncOutlined />} onClick={() => setSyncOpen(true)}>
          동기화 관리
        </Button>
      </div>

      <LDAPAuth />

      <Modal
        title={<Space><SyncOutlined />LDAP 동기화 관리</Space>}
        open={syncOpen}
        onCancel={() => setSyncOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <LdapSyncManagement />
      </Modal>
    </div>
  );
};

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export const MemberManagement: React.FC = () => {
  const [ldapEnabled, setLdapEnabled] = useState(false);

  useEffect(() => {
    axiosInstance.get('/admin/members').then(res => {
      setLdapEnabled(res.data.ldapEnabled);
    }).catch(() => {});
  }, []);

  const tabs = [
    {
      key: 'members',
      label: <Space><IdcardOutlined />멤버 조회</Space>,
      children: <MemberListTab ldapEnabled={ldapEnabled} />,
    },
    {
      key: 'teams',
      label: <Space><TeamOutlined />팀 관리</Space>,
      children: <TeamManagement ldapEnabled={ldapEnabled} />,
    },
    {
      key: 'ldap',
      label: <Space><ApiOutlined />LDAP 인증</Space>,
      children: <LdapTab />,
    },
  ];

  return (
    <div>
      <Title level={2}>멤버 관리</Title>
      <Tabs items={tabs} />
    </div>
  );
};
