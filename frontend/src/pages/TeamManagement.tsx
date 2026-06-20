import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tag,
  Popconfirm,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { teamApi } from '../api/team';
import { Team } from '../types/user';

export const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const data = await teamApi.getAll();
      setTeams(data);
    } catch (error: any) {
      message.error('팀 목록 조회 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await teamApi.syncFromLDAP();
      message.success(
        `LDAP 동기화 완료: ${result.created}개 생성, ${result.updated}개 업데이트`
      );
      if (result.errors.length > 0) {
        message.warning(`${result.errors.length}개 오류 발생`);
      }
      fetchTeams();
    } catch (error: any) {
      message.error('LDAP 동기화 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTeam(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    form.setFieldsValue({
      name: team.name,
      ldapDn: team.ldapDn,
      description: team.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await teamApi.delete(id);
      message.success('팀이 삭제되었습니다');
      fetchTeams();
    } catch (error: any) {
      message.error('팀 삭제 실패: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingTeam) {
        await teamApi.update(editingTeam.id, values);
        message.success('팀이 수정되었습니다');
      } else {
        await teamApi.create(values);
        message.success('팀이 생성되었습니다');
      }
      setModalVisible(false);
      fetchTeams();
    } catch (error: any) {
      message.error('저장 실패: ' + error.message);
    }
  };

  const columns = [
    {
      title: '팀명',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Team) => (
        <Space>
          <TeamOutlined />
          <strong>{text}</strong>
          {record.ldapDn && <Tag color="blue">LDAP</Tag>}
        </Space>
      ),
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '구성원 수',
      key: 'memberCount',
      render: (_: any, record: Team) => (
        <Tag color="green">{record.User?.length || 0}명</Tag>
      ),
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success">활성</Tag>
        ) : (
          <Tag color="default">비활성</Tag>
        ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: Team) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#888' }}>전체 {teams.length}개 팀</span>
        <Space>
          <Button icon={<SyncOutlined />} onClick={handleSync} loading={loading}>
            LDAP 동기화
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            팀 추가
          </Button>
        </Space>
      </div>
      <Table
          columns={columns}
          dataSource={teams}
          rowKey="id"
          loading={loading}
          expandable={{
            expandedRowRender: (record: Team) => (
              <Descriptions bordered size="small">
                <Descriptions.Item label="팀 ID" span={3}>
                  {record.id}
                </Descriptions.Item>
                {record.ldapDn && (
                  <Descriptions.Item label="LDAP DN" span={3}>
                    {record.ldapDn}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="생성일" span={1.5}>
                  {new Date(record.createdAt).toLocaleString('ko-KR')}
                </Descriptions.Item>
                <Descriptions.Item label="수정일" span={1.5}>
                  {new Date(record.updatedAt).toLocaleString('ko-KR')}
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
        />

      <Modal
        title={editingTeam ? '팀 수정' : '팀 추가'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="저장"
        cancelText="취소"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="팀명"
            rules={[{ required: true, message: '팀명을 입력하세요' }]}
          >
            <Input placeholder="예: 개발팀" />
          </Form.Item>
          <Form.Item name="ldapDn" label="LDAP DN (선택)">
            <Input placeholder="cn=developers,ou=groups,dc=example,dc=com" />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} placeholder="팀 설명을 입력하세요" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
