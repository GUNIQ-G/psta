import React from 'react';
import { Typography, Card, Descriptions, Avatar, Space } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;

export const Profile: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <Title level={2}>프로필</Title>
      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 24 }}>
          <Avatar size={100} icon={<UserOutlined />} />
          <Title level={4} style={{ margin: 0 }}>{user?.displayName || user?.username}</Title>
        </Space>
        <Descriptions bordered column={1}>
          <Descriptions.Item label={<><UserOutlined /> 사용자명</>}>
            {user?.username}
          </Descriptions.Item>
          <Descriptions.Item label={<><MailOutlined /> 이메일</>}>
            {user?.email || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={<><PhoneOutlined /> 전화번호</>}>
            {'-'}
          </Descriptions.Item>
          <Descriptions.Item label={<><TeamOutlined /> 팀</>}>
            {user?.Team?.name || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};
