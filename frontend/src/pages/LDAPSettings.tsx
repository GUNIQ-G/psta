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
  Collapse,
  Tag,
  Tooltip,
  Statistic,
  Spin,
  Alert,
} from 'antd';
import {
  SafetyOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  DeleteOutlined,
  SyncOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  CloudServerOutlined,
  FolderOpenOutlined,
  UserOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  TeamOutlined,
  ApiOutlined,
  DatabaseOutlined,
  FilterOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { ldapSyncApi } from '../api/ldap-sync';

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
  rootOu?: string;
  description?: string;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
  // v1.1.19: 확장된 설정 필드
  userBaseDn?: string;
  orgBaseDn?: string;
  searchScope?: string;
  filterActiveOnly?: boolean;
  filterEmailRequired?: boolean;
  hiddenOrgs?: string;
  maxDepth?: number;
  showRootOu?: boolean;
  sortOrder?: string;
  displayNameFormat?: string;
  attributeTitle?: string;
  attributeDepartment?: string;
  attributeDeptNumber?: string;
}

interface ConnectionStatus {
  tested: boolean;
  success: boolean;
  message: string;
  responseTime?: number;
  ldapUsers?: number;
  ldapGroups?: number;
}

// LDAP Templates
const LDAP_TEMPLATES = {
  openldap: {
    name: 'OpenLDAP',
    description: 'OpenLDAP 표준 설정',
    icon: '🐧',
    config: {
      port: 389,
      protocol: 'LDAP' as const,
      bindDn: 'cn=admin,dc=example,dc=com',
      searchBase: 'dc=example,dc=com',
      searchFilter: '(&(objectClass=inetOrgPerson)(uid={username}))',
      timeout: 30,
      enableDynamicUserCreation: true,
      attributeLoginId: 'uid',
      attributeName: 'cn',
      attributeSurname: 'sn',
      attributeEmail: 'mail',
      rootOu: 'Organizations',
    },
  },
  activedirectory: {
    name: 'Active Directory',
    description: 'Microsoft AD 설정',
    icon: '🪟',
    config: {
      port: 389,
      protocol: 'LDAP' as const,
      bindDn: 'cn=Administrator,cn=Users,dc=example,dc=com',
      searchBase: 'dc=example,dc=com',
      searchFilter: '(&(objectClass=user)(sAMAccountName={username}))',
      timeout: 30,
      enableDynamicUserCreation: true,
      attributeLoginId: 'sAMAccountName',
      attributeName: 'givenName',
      attributeSurname: 'sn',
      attributeEmail: 'mail',
      rootOu: 'Organizations',
    },
  },
  dztechwill: {
    name: '더존테크윌',
    description: '더존테크윌 LDAP 서버',
    icon: '🏢',
    config: {
      host: '192.168.1.212',
      port: 10389,
      protocol: 'LDAP' as const,
      bindDn: 'cn=admin,dc=ldap,dc=dztechwill,dc=com',
      searchBase: 'dc=ldap,dc=dztechwill,dc=com',
      searchFilter: '',
      timeout: 30,
      enableDynamicUserCreation: true,
      attributeLoginId: 'uid',
      attributeName: 'cn',
      attributeSurname: 'sn',
      attributeEmail: 'mail',
      rootOu: 'people',
      userBaseDn: 'ou=people,dc=ldap,dc=dztechwill,dc=com',
      orgBaseDn: 'ou=organization,dc=ldap,dc=dztechwill,dc=com',
      searchScope: 'sub',
      filterActiveOnly: true,
      filterEmailRequired: false,
      hiddenOrgs: '퇴사자',
      maxDepth: 10,
      showRootOu: false,
      sortOrder: 'name',
      displayNameFormat: '{sn}{cn}',
      attributeTitle: 'title',
      attributeDepartment: 'ou',
      attributeDeptNumber: 'departmentNumber',
    },
  },
};

export const LDAPSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<LDAPConfig | null>(null);
  const isNewConfig = id === 'new';

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    tested: false,
    success: false,
    message: '',
  });

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
        attributeEmail: 'mail',
        rootOu: 'people',
        description: '',
        userBaseDn: '',
        orgBaseDn: '',
        searchScope: 'sub',
        filterActiveOnly: true,
        filterEmailRequired: false,
        hiddenOrgs: '퇴사자',
        maxDepth: 10,
        showRootOu: false,
        sortOrder: 'name',
        displayNameFormat: '{sn}{cn}',
        attributeTitle: 'title',
        attributeDepartment: 'ou',
        attributeDeptNumber: 'departmentNumber',
      });
    }
  }, [id]);

  const fetchConfig = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/ldap/configs/${id}`);
      const config = response.data;
      setCurrentConfig(config);
      form.setFieldsValue({
        name: config.name || '',
        host: config.host || '',
        port: config.port || 389,
        protocol: config.protocol || 'LDAP',
        bindDn: config.bindDn || '',
        bindPassword: '',
        searchBase: config.searchBase || '',
        searchFilter: config.searchFilter || '',
        timeout: config.timeout || 30,
        enableDynamicUserCreation: config.enableDynamicUserCreation !== false,
        attributeLoginId: config.attributeLoginId || 'uid',
        attributeName: config.attributeName || 'cn',
        attributeSurname: config.attributeSurname || 'sn',
        attributeEmail: config.attributeEmail || 'mail',
        rootOu: config.rootOu || 'people',
        description: config.description || '',
        userBaseDn: config.userBaseDn || '',
        orgBaseDn: config.orgBaseDn || '',
        searchScope: config.searchScope || 'sub',
        filterActiveOnly: config.filterActiveOnly !== false,
        filterEmailRequired: config.filterEmailRequired === true,
        hiddenOrgs: config.hiddenOrgs || '',
        maxDepth: config.maxDepth || 10,
        showRootOu: config.showRootOu === true,
        sortOrder: config.sortOrder || 'name',
        displayNameFormat: config.displayNameFormat || '{sn}{cn}',
        attributeTitle: config.attributeTitle || 'title',
        attributeDepartment: config.attributeDepartment || 'ou',
        attributeDeptNumber: config.attributeDeptNumber || 'departmentNumber',
      });

      if (config.lastTestedAt) {
        setConnectionStatus({
          tested: true,
          success: config.lastTestSuccess,
          message: config.lastTestSuccess ? '연결 성공' : '연결 실패',
        });
      }
    } catch (error: any) {
      message.error('LDAP 설정을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTestLoading(true);
    const startTime = Date.now();

    try {
      const values = form.getFieldsValue(['host', 'port', 'protocol', 'bindDn', 'bindPassword', 'searchBase']);

      // Validate required fields
      if (!values.host || !values.bindDn || !values.searchBase) {
        message.warning('서버 주소, 관리자 DN, Base DN을 입력하세요');
        setTestLoading(false);
        return;
      }

      if (isNewConfig && !values.bindPassword) {
        message.warning('비밀번호를 입력하세요');
        setTestLoading(false);
        return;
      }

      let response;
      if (isNewConfig) {
        response = await axiosInstance.post('/ldap/configs/test-connection', values);
      } else {
        response = await axiosInstance.post(`/ldap/configs/${id}/test`);
      }

      const responseTime = Date.now() - startTime;

      if (response.data.success) {
        try {
          const statsResponse = await ldapSyncApi.getSyncStats();
          setConnectionStatus({
            tested: true,
            success: true,
            message: 'LDAP 연결 성공',
            responseTime,
            ldapUsers: statsResponse.stats.ldapUsers,
            ldapGroups: statsResponse.stats.ldapGroups,
          });
        } catch {
          setConnectionStatus({
            tested: true,
            success: true,
            message: 'LDAP 연결 성공',
            responseTime,
          });
        }
        message.success('LDAP 연결 테스트 성공');
      } else {
        setConnectionStatus({
          tested: true,
          success: false,
          message: response.data.message || 'LDAP 연결 실패',
          responseTime,
        });
        message.error(response.data.message || 'LDAP 연결 테스트 실패');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '알 수 없는 오류';
      setConnectionStatus({
        tested: true,
        success: false,
        message: errorMsg,
      });
      message.error(`연결 실패: ${errorMsg}`);
    } finally {
      setTestLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isNewConfig) return;

    try {
      await axiosInstance.delete(`/ldap/configs/${id}`);
      message.success('LDAP 설정이 삭제되었습니다');
      navigate('/ldap-auth');
    } catch (error: any) {
      message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue(true);

      // Required field validation
      const requiredFields = ['name', 'host', 'bindDn', 'searchBase'];
      if (isNewConfig) requiredFields.push('bindPassword');

      const missingFields = requiredFields.filter(field => !values[field]);
      if (missingFields.length > 0) {
        message.error(`필수 필드를 입력하세요: ${missingFields.join(', ')}`);
        return;
      }

      setLoading(true);

      if (isNewConfig) {
        await axiosInstance.post('/ldap/configs', values);
        message.success('LDAP 설정이 생성되었습니다');
      } else {
        await axiosInstance.put(`/ldap/configs/${id}`, values);
        message.success('LDAP 설정이 업데이트되었습니다');
      }
      navigate('/ldap-auth');
    } catch (error: any) {
      message.error('저장 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (templateKey: keyof typeof LDAP_TEMPLATES) => {
    const template = LDAP_TEMPLATES[templateKey];
    form.setFieldsValue({
      ...template.config,
      name: '',
      bindPassword: '',
      description: template.description,
    });
    setConnectionStatus({ tested: false, success: false, message: '' });
    message.success(`${template.name} 템플릿이 적용되었습니다`);
  };

  const validateDN = (_: any, value: string) => {
    if (!value) return Promise.resolve();
    const dnPattern = /^[a-zA-Z]+=.+(,[a-zA-Z]+=.+)*$/;
    if (!dnPattern.test(value.trim())) {
      return Promise.reject(new Error('DN 형식이 올바르지 않습니다'));
    }
    return Promise.resolve();
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
            <span>{isNewConfig ? '새 LDAP 설정' : `LDAP 설정 수정`}</span>
            {!isNewConfig && currentConfig?.lastTestSuccess && (
              <Tag icon={<CheckCircleOutlined />} color="success">연결됨</Tag>
            )}
          </Space>
        }
      >
        <Spin spinning={loading && !isNewConfig}>
          <Form form={form} layout="vertical">
            {/* Templates (only for new config) */}
            {isNewConfig && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 12, fontWeight: 500, color: '#595959' }}>
                  <AppstoreOutlined /> 빠른 시작: 템플릿 선택
                </div>
                <Space wrap>
                  {Object.entries(LDAP_TEMPLATES).map(([key, template]) => (
                    <Button
                      key={key}
                      onClick={() => applyTemplate(key as keyof typeof LDAP_TEMPLATES)}
                      style={{ height: 'auto', padding: '8px 16px' }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 500 }}>{template.icon} {template.name}</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{template.description}</div>
                      </div>
                    </Button>
                  ))}
                </Space>
                <Divider />
              </div>
            )}

            {/* Connection Status Card */}
            <Card
              size="small"
              style={{
                marginBottom: 24,
                borderColor: connectionStatus.tested
                  ? connectionStatus.success ? '#52c41a' : '#ff4d4f'
                  : '#d9d9d9',
                backgroundColor: connectionStatus.tested
                  ? connectionStatus.success ? '#f6ffed' : '#fff2f0'
                  : '#fafafa',
              }}
            >
              <Row align="middle" gutter={16}>
                <Col flex="auto">
                  <Space>
                    {testLoading ? (
                      <LoadingOutlined style={{ fontSize: 20, color: '#1890ff' }} spin />
                    ) : connectionStatus.tested ? (
                      connectionStatus.success ? (
                        <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                      ) : (
                        <CloseCircleOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
                      )
                    ) : (
                      <ApiOutlined style={{ fontSize: 20, color: '#8c8c8c' }} />
                    )}
                    <span style={{ fontWeight: 500 }}>
                      {testLoading
                        ? '연결 테스트 중...'
                        : connectionStatus.tested
                        ? connectionStatus.message
                        : '연결 테스트를 실행하세요'}
                    </span>
                    {connectionStatus.responseTime && (
                      <Tag>{connectionStatus.responseTime}ms</Tag>
                    )}
                  </Space>
                </Col>
                <Col>
                  <Space>
                    {connectionStatus.tested && connectionStatus.success && (
                      <>
                        {connectionStatus.ldapUsers !== undefined && (
                          <Statistic
                            title={<span style={{ fontSize: 11 }}><UserOutlined /> 사용자</span>}
                            value={connectionStatus.ldapUsers}
                            suffix="명"
                            valueStyle={{ fontSize: 14 }}
                          />
                        )}
                        {connectionStatus.ldapGroups !== undefined && (
                          <Statistic
                            title={<span style={{ fontSize: 11 }}><TeamOutlined /> 그룹</span>}
                            value={connectionStatus.ldapGroups}
                            suffix="개"
                            valueStyle={{ fontSize: 14 }}
                          />
                        )}
                      </>
                    )}
                    <Button
                      type="primary"
                      icon={testLoading ? <LoadingOutlined /> : <SyncOutlined />}
                      onClick={handleTest}
                      loading={testLoading}
                    >
                      연결 테스트
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* Basic Info */}
            <Card
              title={<span><SettingOutlined /> 기본 정보</span>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="설정 이름"
                    rules={[{ required: true, message: '설정 이름을 입력하세요' }]}
                  >
                    <Input placeholder="더존테크윌 LDAP" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="description" label="설명">
                    <Input placeholder="운영 환경 LDAP 서버" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Server Connection */}
            <Card
              title={<span><CloudServerOutlined /> 서버 연결</span>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={10}>
                  <Form.Item
                    name="host"
                    label="서버 주소"
                    rules={[{ required: true, message: '서버 주소를 입력하세요' }]}
                    extra="예: ldap.company.com 또는 192.168.1.212"
                  >
                    <Input placeholder="192.168.1.212" />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item
                    name="port"
                    label="포트"
                    rules={[{ required: true }]}
                  >
                    <InputNumber placeholder="389" style={{ width: '100%' }} min={1} max={65535} />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="protocol" label="프로토콜">
                    <Select>
                      <Select.Option value="LDAP">LDAP</Select.Option>
                      <Select.Option value="LDAPS">LDAPS (암호화)</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="timeout" label="타임아웃">
                    <InputNumber addonAfter="초" style={{ width: '100%' }} min={5} max={300} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="bindDn"
                    label="관리자 계정 (Bind DN)"
                    rules={[
                      { required: true, message: '관리자 DN을 입력하세요' },
                      { validator: validateDN },
                    ]}
                    extra="예: cn=admin,dc=ldap,dc=example,dc=com"
                    hasFeedback
                  >
                    <Input placeholder="cn=admin,dc=ldap,dc=dztechwill,dc=com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="bindPassword"
                    label={
                      <span>
                        관리자 비밀번호
                        {!isNewConfig && (
                          <Tooltip title="수정하지 않으려면 비워두세요">
                            <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                          </Tooltip>
                        )}
                      </span>
                    }
                    rules={isNewConfig ? [{ required: true, message: '비밀번호를 입력하세요' }] : []}
                  >
                    <Input.Password placeholder={isNewConfig ? '비밀번호 입력' : '변경시에만 입력'} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Search Path Settings */}
            <Card
              title={<span><FolderOpenOutlined /> 검색 경로 설정</span>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                name="searchBase"
                label="Base DN (전체 검색 경로)"
                rules={[
                  { required: true, message: 'Base DN을 입력하세요' },
                  { validator: validateDN },
                ]}
                extra="LDAP 전체 구조의 루트 경로"
                hasFeedback
              >
                <Input placeholder="dc=ldap,dc=dztechwill,dc=com" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="userBaseDn"
                    label={
                      <span>
                        사용자 Base DN
                        <Tooltip title="사용자가 저장된 위치 (예: ou=people,dc=...)">
                          <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                        </Tooltip>
                      </span>
                    }
                    extra="비워두면 Base DN 사용"
                  >
                    <Input placeholder="ou=people,dc=ldap,dc=dztechwill,dc=com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="orgBaseDn"
                    label={
                      <span>
                        조직 Base DN
                        <Tooltip title="조직 구조가 저장된 위치 (예: ou=organization,dc=...)">
                          <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                        </Tooltip>
                      </span>
                    }
                    extra="비워두면 Base DN 사용"
                  >
                    <Input placeholder="ou=organization,dc=ldap,dc=dztechwill,dc=com" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="rootOu" label="루트 OU 이름">
                    <Input placeholder="people" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="searchScope" label="검색 범위">
                    <Select>
                      <Select.Option value="sub">하위 전체 (sub)</Select.Option>
                      <Select.Option value="one">직접 하위만 (one)</Select.Option>
                      <Select.Option value="base">현재만 (base)</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="maxDepth" label="최대 계층 깊이">
                    <InputNumber style={{ width: '100%' }} min={1} max={20} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Filter Settings */}
            <Card
              title={<span><FilterOutlined /> 필터 조건</span>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item name="filterActiveOnly" valuePropName="checked">
                    <Checkbox>재직자만 조회</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="filterEmailRequired" valuePropName="checked">
                    <Checkbox>이메일 필수</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="showRootOu" valuePropName="checked">
                    <Checkbox>루트 OU 표시</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="enableDynamicUserCreation" valuePropName="checked">
                    <Checkbox>자동 사용자 생성</Checkbox>
                  </Form.Item>
                </Col>
              </Row>

              <Alert
                type="info"
                showIcon
                icon={<EyeInvisibleOutlined />}
                message="숨길 조직 설정"
                description="아래에 숨기고 싶은 조직명을 쉼표로 구분하여 입력하세요. 해당 조직은 조직도와 미리보기에서 제외됩니다."
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name="hiddenOrgs"
                label="숨길 조직"
                extra="예: 퇴사자, 휴직자, 테스트팀"
              >
                <Input placeholder="퇴사자, 휴직자" />
              </Form.Item>
            </Card>

            {/* Advanced Settings (Collapsible) */}
            <Collapse
              ghost
              style={{ marginBottom: 24 }}
              items={[
                {
                  key: 'filter',
                  label: (
                    <span style={{ fontWeight: 500 }}>
                      <SettingOutlined /> LDAP 검색 필터 (고급)
                    </span>
                  ),
                  children: (
                    <Form.Item
                      name="searchFilter"
                      extra="사용자 검색 시 사용할 커스텀 LDAP 필터 (비워두면 기본값 사용)"
                    >
                      <TextArea
                        rows={3}
                        placeholder="(&(objectClass=inetOrgPerson)(!(ou=퇴사자)))"
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Form.Item>
                  ),
                },
                {
                  key: 'attributes',
                  label: (
                    <span style={{ fontWeight: 500 }}>
                      <DatabaseOutlined /> 속성 매핑
                    </span>
                  ),
                  children: (
                    <>
                      <Row gutter={16}>
                        <Col span={6}>
                          <Form.Item name="attributeLoginId" label="로그인 ID">
                            <Input placeholder="uid" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item name="attributeName" label="이름">
                            <Input placeholder="cn" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item name="attributeSurname" label="성">
                            <Input placeholder="sn" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item name="attributeEmail" label="이메일">
                            <Input placeholder="mail" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={6}>
                          <Form.Item name="attributeTitle" label="직위">
                            <Input placeholder="title" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item name="attributeDepartment" label="부서">
                            <Input placeholder="ou" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item name="attributeDeptNumber" label="부서 코드">
                            <Input placeholder="departmentNumber" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  ),
                },
                {
                  key: 'display',
                  label: (
                    <span style={{ fontWeight: 500 }}>
                      <UserOutlined /> 표시 설정
                    </span>
                  ),
                  children: (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="displayNameFormat"
                          label="이름 표시 형식"
                          extra="{sn}=성, {cn}=이름"
                        >
                          <Select>
                            <Select.Option value="{sn}{cn}">성+이름 (김철수)</Select.Option>
                            <Select.Option value="{cn} {sn}">이름 성 (철수 김)</Select.Option>
                            <Select.Option value="{cn}">이름만 (철수)</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="sortOrder" label="정렬 방식">
                          <Select>
                            <Select.Option value="name">이름순</Select.Option>
                            <Select.Option value="department">부서순</Select.Option>
                            <Select.Option value="title">직급순</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />

            {/* Action Buttons */}
            <Divider />
            <Space size="middle">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={loading}
                size="large"
              >
                {isNewConfig ? '설정 생성' : '변경사항 저장'}
              </Button>
              <Button onClick={() => form.resetFields()} size="large">
                초기화
              </Button>
              {!isNewConfig && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                  size="large"
                >
                  삭제
                </Button>
              )}
            </Space>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};
