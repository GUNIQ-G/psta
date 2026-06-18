import React, { useState } from 'react';
import { Typography, Card, Descriptions, Avatar, Space, Form, Input, Button, message } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, TeamOutlined, LockOutlined, EditOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import axiosInstance from '../api/axios';

const { Title } = Typography;

export const Profile: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const fetchUser = useAuthStore((state) => state.fetchUser);

  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [infoLoading, setInfoLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const isLocal = user?.authType === 'LOCAL';

  const handleEditInfo = () => {
    infoForm.setFieldsValue({
      displayName: user?.displayName,
      email: user?.email,
      phoneNumber: user?.phoneNumber || '',
    });
    setEditingInfo(true);
  };

  const handleSaveInfo = async (values: any) => {
    setInfoLoading(true);
    try {
      await axiosInstance.put('/admin/members/profile', values);
      await fetchUser();
      message.success('정보가 수정되었습니다.');
      setEditingInfo(false);
    } catch (err: any) {
      message.error(err.response?.data?.error || '수정 실패');
    } finally {
      setInfoLoading(false);
    }
  };

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setPwLoading(true);
    try {
      await axiosInstance.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('비밀번호가 변경되었습니다.');
      pwForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.error || '비밀번호 변경 실패');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div>
      <Title level={2}>프로필</Title>

      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 24 }}>
          <Avatar size={100} icon={<UserOutlined />} />
          <Title level={4} style={{ margin: 0 }}>{user?.displayName || user?.username}</Title>
        </Space>

        {!editingInfo ? (
          <>
            <Descriptions bordered column={1}>
              <Descriptions.Item label={<><UserOutlined /> 사용자명</>}>{user?.username}</Descriptions.Item>
              <Descriptions.Item label={<><MailOutlined /> 이메일</>}>{user?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label={<><PhoneOutlined /> 전화번호</>}>{user?.phoneNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label={<><TeamOutlined /> 팀</>}>{(user as any)?.Team?.name || '-'}</Descriptions.Item>
            </Descriptions>
            {isLocal && (
              <div style={{ marginTop: 16 }}>
                <Button icon={<EditOutlined />} onClick={handleEditInfo}>정보 수정</Button>
              </div>
            )}
          </>
        ) : (
          <Form form={infoForm} layout="vertical" onFinish={handleSaveInfo} style={{ maxWidth: 400 }}>
            <Form.Item name="displayName" label="이름" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="이메일">
              <Input />
            </Form.Item>
            <Form.Item name="phoneNumber" label="전화번호">
              <Input />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={infoLoading}>저장</Button>
              <Button onClick={() => setEditingInfo(false)}>취소</Button>
            </Space>
          </Form>
        )}
      </Card>

      {isLocal && (
        <Card style={{ marginTop: 24 }} title={<><LockOutlined /> 비밀번호 변경</>}>
          <Form form={pwForm} layout="vertical" onFinish={handleChangePassword} style={{ maxWidth: 400 }}>
            <Form.Item name="currentPassword" label="현재 비밀번호" rules={[{ required: true }]}>
              <Input.Password placeholder="현재 비밀번호" />
            </Form.Item>
            <Form.Item name="newPassword" label="새 비밀번호" rules={[{ required: true }, { min: 6, message: '6자 이상' }]}>
              <Input.Password placeholder="새 비밀번호 (6자 이상)" />
            </Form.Item>
            <Form.Item name="confirmPassword" label="새 비밀번호 확인" rules={[{ required: true }]}>
              <Input.Password placeholder="새 비밀번호 재입력" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={pwLoading}>비밀번호 변경</Button>
          </Form>
        </Card>
      )}
    </div>
  );
};
