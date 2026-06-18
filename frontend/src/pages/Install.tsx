import React, { useEffect, useState } from 'react';
import {
  Steps, Button, Card, Form, Input, Alert, Typography, Space, Spin, Result, Tag,
} from 'antd';
import {
  CheckCircleOutlined, LoadingOutlined, DatabaseOutlined,
  GlobalOutlined, UserOutlined, RocketOutlined,
} from '@ant-design/icons';
import { getInstallStatus, runInstall, InstallStatus } from '../api/install';

const { Title, Text, Paragraph } = Typography;

const STEPS = ['시스템 확인', '서버 설정', '관리자 계정', '설치 실행'];

const Install: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [frontendUrl, setFrontendUrl] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    getInstallStatus().then(s => {
      setStatus(s);
      setLoading(false);
      if (s.installed) setDone(true);
    }).catch(() => setLoading(false));

    // 현재 접속 URL을 기본값으로
    setFrontendUrl(`${window.location.protocol}//${window.location.hostname}:${window.location.port || 3000}`);
  }, []);

  const handleInstall = async () => {
    if (adminPassword.length < 6) {
      setError('관리자 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (adminPassword !== adminPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setInstalling(true);
    setError('');
    try {
      await runInstall({ frontendUrl, adminPassword });
      setDone(true);
    } catch (e: any) {
      setError(e.response?.data?.error || '설치 중 오류가 발생했습니다.');
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <Spin size="large" />
      </div>
    );
  }

  if (done) {
    return (
      <div style={styles.center}>
        <Result
          status="success"
          title="PSTA 설치 완료!"
          subTitle="설치가 완료되었습니다. 아래 계정으로 로그인하세요."
          extra={[
            <Card key="cred" size="small" style={{ textAlign: 'left', marginBottom: 16 }}>
              <Space direction="vertical">
                <Text><strong>아이디:</strong> admin</Text>
                <Text><strong>비밀번호:</strong> 설치 시 설정한 비밀번호</Text>
              </Space>
            </Card>,
            <Button type="primary" key="login" size="large" onClick={() => window.location.href = '/login'}>
              로그인 페이지로 이동
            </Button>,
          ]}
        />
      </div>
    );
  }

  const stepContents = [
    // Step 0: 시스템 확인
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Title level={4}><DatabaseOutlined /> 데이터베이스 연결 상태</Title>
        {status?.dbConnected ? (
          <Alert type="success" showIcon message="데이터베이스에 성공적으로 연결되었습니다." />
        ) : (
          <Alert type="error" showIcon message="데이터베이스에 연결할 수 없습니다. Docker Compose가 정상 실행 중인지 확인하세요." />
        )}
      </div>
      <div>
        <Title level={4}>PSTA 버전</Title>
        <Tag color="blue">v1.1.31</Tag>
      </div>
      <Paragraph type="secondary">
        데이터베이스 연결이 확인되면 다음 단계로 진행할 수 있습니다.
      </Paragraph>
    </Space>,

    // Step 1: 서버 설정
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={4}><GlobalOutlined /> 서버 접속 URL 설정</Title>
      <Paragraph type="secondary">
        사용자가 PSTA에 접속할 URL을 입력하세요. 알림 링크 생성 등에 사용됩니다.
      </Paragraph>
      <Form layout="vertical">
        <Form.Item label="프론트엔드 URL" required>
          <Input
            value={frontendUrl}
            onChange={e => setFrontendUrl(e.target.value)}
            placeholder="http://192.168.1.100:3000"
            size="large"
          />
        </Form.Item>
      </Form>
    </Space>,

    // Step 2: 관리자 계정
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={4}><UserOutlined /> 관리자 계정 설정</Title>
      <Paragraph type="secondary">
        최초 로그인에 사용할 관리자 비밀번호를 설정하세요. 아이디는 <strong>admin</strong>으로 고정됩니다.
      </Paragraph>
      <Form layout="vertical">
        <Form.Item label="관리자 아이디">
          <Input value="admin" disabled size="large" />
        </Form.Item>
        <Form.Item
          label="관리자 비밀번호"
          required
          validateStatus={passwordError ? 'error' : ''}
          help={passwordError || '6자 이상 입력하세요.'}
        >
          <Input.Password
            value={adminPassword}
            onChange={e => { setAdminPassword(e.target.value); setPasswordError(''); }}
            placeholder="비밀번호 (6자 이상)"
            size="large"
          />
        </Form.Item>
        <Form.Item
          label="비밀번호 확인"
          required
          validateStatus={adminPasswordConfirm && adminPassword !== adminPasswordConfirm ? 'error' : ''}
          help={adminPasswordConfirm && adminPassword !== adminPasswordConfirm ? '비밀번호가 일치하지 않습니다.' : ''}
        >
          <Input.Password
            value={adminPasswordConfirm}
            onChange={e => setAdminPasswordConfirm(e.target.value)}
            placeholder="비밀번호 재입력"
            size="large"
          />
        </Form.Item>
      </Form>
    </Space>,

    // Step 3: 설치 실행
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Title level={4}><RocketOutlined /> 설치 준비 완료</Title>
      <Card size="small">
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text><CheckCircleOutlined style={{ color: '#52c41a' }} /> 데이터베이스 연결 확인</Text>
          <Text><CheckCircleOutlined style={{ color: '#52c41a' }} /> 서버 URL: <strong>{frontendUrl}</strong></Text>
          <Text><CheckCircleOutlined style={{ color: '#52c41a' }} /> 관리자 계정: admin / (설정한 비밀번호)</Text>
        </Space>
      </Card>
      {error && <Alert type="error" showIcon message={error} />}
      <Paragraph type="secondary">
        설치 버튼을 누르면 데이터베이스 테이블 생성 및 초기 설정이 진행됩니다.
      </Paragraph>
    </Space>,
  ];

  return (
    <div style={styles.page}>
      <Card style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 4 }}>PSTA 설치</Title>
          <Text type="secondary">Project-Service-Team-Action 설치 마법사</Text>
        </div>

        <Steps current={current} items={STEPS.map(t => ({ title: t }))} style={{ marginBottom: 32 }} />

        <div style={{ minHeight: 200 }}>
          {stepContents[current]}
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={current === 0}
            onClick={() => setCurrent(c => c - 1)}
            size="large"
          >
            이전
          </Button>

          {current < STEPS.length - 1 ? (
            <Button
              type="primary"
              size="large"
              disabled={current === 0 && !status?.dbConnected}
              onClick={() => {
                if (current === 2) {
                  if (adminPassword.length < 6) {
                    setPasswordError('비밀번호는 6자 이상이어야 합니다.');
                    return;
                  }
                  if (adminPassword !== adminPasswordConfirm) {
                    setPasswordError('비밀번호가 일치하지 않습니다.');
                    return;
                  }
                }
                setCurrent(c => c + 1);
              }}
            >
              다음
            </Button>
          ) : (
            <Button
              type="primary"
              size="large"
              loading={installing}
              icon={installing ? <LoadingOutlined /> : <RocketOutlined />}
              onClick={handleInstall}
            >
              설치 시작
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default Install;
