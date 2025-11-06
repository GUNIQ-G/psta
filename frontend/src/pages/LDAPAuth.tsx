import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Popconfirm,
  Tag,
} from 'antd';
import {
  SafetyOutlined,
  PlusOutlined,
  SyncOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import type { ColumnsType } from 'antd/es/table';

interface LdapConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  userCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const LDAPAuth: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<LdapConfig[]>([]);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/ldap-configs');
      setConfigs(response.data);
    } catch (error: any) {
      message.error('LDAP 설정 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id: string, name: string) => {
    setTestingIds((prev) => new Set(prev).add(id));
    try {
      const response = await axiosInstance.post(`/ldap-configs/${id}/test`);
      if (response.data.success) {
        message.success({
          content: (
            <div>
              <strong>{name}</strong>
              <br />
              LDAP 연결 테스트 성공
            </div>
          ),
          duration: 3,
        });
      } else {
        message.error({
          content: (
            <div>
              <strong>{name}</strong>
              <br />
              LDAP 연결 테스트 실패
            </div>
          ),
          duration: 5,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '알 수 없는 오류';
      message.error({
        content: (
          <div>
            <strong>{name}</strong>
            <br />
            연결 실패: {errorMsg}
          </div>
        ),
        duration: 8,
      });
    } finally {
      setTestingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await axiosInstance.delete(`/ldap-configs/${id}`);
      message.success(`"${name}" LDAP 설정이 삭제되었습니다`);
      fetchConfigs();
    } catch (error: any) {
      message.error('삭제 실패: ' + error.message);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/ldap-settings/${id}`);
  };

  const columns: ColumnsType<LdapConfig> = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: '방식',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (protocol: string) => (
        <Tag color={protocol === 'LDAPS' ? 'green' : 'blue'}>
          {protocol}
        </Tag>
      ),
    },
    {
      title: '호스트',
      key: 'host',
      render: (_, record) => `${record.host}:${record.port}`,
    },
    {
      title: '사용자',
      dataIndex: 'userCount',
      key: 'userCount',
      render: (count: number) => <span>{count}명</span>,
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '활성' : '비활성'}
        </Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleTest(record.id, record.name)}
            loading={testingIds.has(record.id)}
          >
            테스트
          </Button>
          <Button
            size="small"
            onClick={() => handleEdit(record.id)}
          >
            수정
          </Button>
          <Popconfirm
            title="LDAP 설정 삭제"
            description={`"${record.name}" 설정을 삭제하시겠습니까?`}
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>LDAP 인증</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/ldap-settings/new')}
          >
            새 인증
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `전체 ${total}개`,
          }}
        />
      </Card>
    </div>
  );
};
