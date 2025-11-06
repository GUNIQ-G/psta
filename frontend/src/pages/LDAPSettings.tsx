import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Space,
  Divider,
  Select,
  Checkbox,
  InputNumber,
  Row,
  Col,
} from 'antd';
import {
  SafetyOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  DeleteOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';

const { TextArea } = Input;

interface LDAPConfig {
  name: string;
  host: string;
  port: number;
  protocol: 'LDAP' | 'LDAPS';
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  searchFilter: string;
  timeout: number;
  enableDynamicUserCreation: boolean;
  attributeLoginId: string;
  attributeName: string;
  attributeSurname: string;
  attributeEmail: string;
}

export const LDAPSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<LDAPConfig | null>(null);
  const isNewConfig = id === 'new';

  useEffect(() => {
    if (!isNewConfig && id) {
      fetchConfig();
    } else {
      // Set default values for new config
      form.setFieldsValue({
        name: '',
        host: '',
        port: 389,
        protocol: 'LDAP',
        bindDn: '',
        bindPassword: '',
        searchBase: '',
        searchFilter: '',
        timeout: 30,
        enableDynamicUserCreation: true,
        attributeLoginId: 'uid',
        attributeName: 'cn',
        attributeSurname: 'sn',
        attributeEmail: 'Email',
      });
    }
  }, [id]);

  const fetchConfig = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/ldap-configs/${id}`);
      const config = response.data;
      setCurrentConfig(config);
      form.setFieldsValue({
        name: config.name || '',
        host: config.host || '',
        port: config.port || 389,
        protocol: config.protocol || 'LDAP',
        bindDn: config.bindDn || '',
        bindPassword: '', // Don't populate password for security
        searchBase: config.searchBase || '',
        searchFilter: config.searchFilter || '',
        timeout: config.timeout || 30,
        enableDynamicUserCreation: config.enableDynamicUserCreation !== false,
        attributeLoginId: config.attributeLoginId || 'uid',
        attributeName: config.attributeName || 'cn',
        attributeSurname: config.attributeSurname || 'sn',
        attributeEmail: config.attributeEmail || 'Email',
      });
    } catch (error: any) {
      message.error('LDAP 설정을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (isNewConfig) {
      message.warning('설정을 먼저 저장한 후 테스트하세요');
      return;
    }

    setTestLoading(true);
    try {
      const response = await axiosInstance.post(`/ldap-configs/${id}/test`);
      if (response.data.success) {
        message.success('LDAP 연결 테스트 성공');
      } else {
        message.error('LDAP 연결 테스트 실패');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '알 수 없는 오류';
      message.error(`연결 실패: ${errorMsg}`);
    } finally {
      setTestLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isNewConfig) return;

    try {
      await axiosInstance.delete(`/ldap-configs/${id}`);
      message.success('LDAP 설정이 삭제되었습니다');
      navigate('/ldap-auth');
    } catch (error: any) {
      message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isNewConfig) {
        // Create new config
        await axiosInstance.post('/ldap-configs', values);
        message.success('LDAP 설정이 생성되었습니다');
        navigate('/ldap-auth');
      } else {
        // Update existing config
        await axiosInstance.put(`/ldap-configs/${id}`, values);
        message.success('LDAP 설정이 업데이트되었습니다');
        navigate('/ldap-auth');
      }
    } catch (error: any) {
      message.error('저장 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/ldap-auth')}
            >
              목록으로
            </Button>
            <SafetyOutlined />
            <span>{isNewConfig ? '새 LDAP 설정' : `LDAP 설정 - ${currentConfig?.name || ''}`}</span>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="이름"
              rules={[{ required: true, message: '이름을 입력하세요' }]}
            >
              <Input placeholder="dtw-ldap" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="host"
                  label="호스트"
                  rules={[{ required: true, message: '호스트를 입력하세요' }]}
                >
                  <Input placeholder="10.0.31.122" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="port"
                  label="포트"
                  rules={[{ required: true, message: '포트를 입력하세요' }]}
                >
                  <InputNumber
                    placeholder="389"
                    style={{ width: '100%' }}
                    min={1}
                    max={65535}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="protocol"
              label="프로토콜"
              rules={[{ required: true, message: '프로토콜을 선택하세요' }]}
              tooltip="인증처리 중 공격을 방지하기 위해 암호화된 LDAPS를 사용할 것을 추천합니다."
            >
              <Select placeholder="LDAP 선택">
                <Select.Option value="LDAP">LDAP</Select.Option>
                <Select.Option value="LDAPS">LDAPS</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="bindDn"
              label="계정"
              rules={[{ required: true, message: '계정을 입력하세요' }]}
            >
              <Input placeholder="cn=admin,dc=auth,dc=team" />
            </Form.Item>

            <Form.Item
              name="bindPassword"
              label="비밀번호"
              rules={[{ required: true, message: '비밀번호를 입력하세요' }]}
            >
              <Input.Password placeholder="••••••••••••" />
            </Form.Item>

            <Form.Item
              name="searchBase"
              label="기본 DN"
              rules={[{ required: true, message: '기본 DN을 입력하세요' }]}
            >
              <Input placeholder="dc=auth,dc=teamdtw,dc=com" />
            </Form.Item>

            <Form.Item name="searchFilter" label="LDAP 필터">
              <TextArea
                rows={4}
                placeholder="LDAP 필터를 입력하세요"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>

            <Form.Item name="timeout" label="타임아웃 (초)">
              <InputNumber
                placeholder="30"
                style={{ width: '100%' }}
                min={1}
                max={300}
              />
            </Form.Item>

            <Form.Item
              name="enableDynamicUserCreation"
              valuePropName="checked"
            >
              <Checkbox>동적 사용자 생성</Checkbox>
            </Form.Item>

            <Card title="속성" size="small" style={{ marginBottom: 16 }}>
              <Form.Item
                name="attributeLoginId"
                label="로그인 속성"
                rules={[{ required: true, message: '로그인 속성을 입력하세요' }]}
              >
                <Input placeholder="uid" />
              </Form.Item>

              <Form.Item name="attributeName" label="이름 속성">
                <Input placeholder="cn" />
              </Form.Item>

              <Form.Item name="attributeSurname" label="성 속성">
                <Input placeholder="sn" />
              </Form.Item>

              <Form.Item name="attributeEmail" label="메일 속성">
                <Input placeholder="Email" />
              </Form.Item>
            </Card>

          <Space style={{ marginTop: 16 }}>
            {!isNewConfig && (
              <>
                <Button
                  icon={<SyncOutlined />}
                  onClick={handleTest}
                  loading={testLoading}
                >
                  연결 테스트
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                >
                  삭제
                </Button>
              </>
            )}
            <Button onClick={() => form.resetFields()}>초기화</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
            >
              저장
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};
