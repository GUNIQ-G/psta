import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { systemSettingsApi } from '../api/system-settings';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [copyrightText, setCopyrightText] = useState('PSTA System. All rights reserved.');
  const [systemName, setSystemName] = useState('PSTA 프로젝트 일정 관리');
  const [systemDescription, setSystemDescription] = useState('더존테크윌');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    loadSystemSettings();
  }, []);

  const loadSystemSettings = async () => {
    try {
      const settings = await systemSettingsApi.getSettings();
      if (settings.copyrightText) {
        setCopyrightText(settings.copyrightText);
      }
      if (settings.systemName) {
        setSystemName(settings.systemName);
      }
      if (settings.systemDescription) {
        setSystemDescription(settings.systemDescription);
      }
      if (settings.systemLogo) {
        setLogoUrl(settings.systemLogo);
      }
    } catch (error) {
      // 로그인 페이지이므로 에러가 발생해도 무시 (인증 실패일 수 있음)
      console.log('Failed to load system settings, using defaults');
    }
  };

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setSystemError(null); // Clear previous errors

    try {
      await login(values.username, values.password);
      message.success('로그인 성공');
      // Small delay to ensure store is updated before navigation
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 100);
    } catch (error: any) {
      console.error('Login error:', error);

      let errorMessage = '로그인 실패';
      let isSystemError = false;

      // Check if it's a network or server error
      if (!error.response) {
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인하거나 관리자에게 문의하세요.';
        isSystemError = true;
      } else if (error.response.status >= 500) {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.';
        isSystemError = true;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      if (isSystemError) {
        setSystemError(errorMessage);
      }

      message.error({
        content: errorMessage,
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5',
        padding: '20px',
      }}
    >
      <div style={{ maxWidth: 420, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {logoUrl ? (
            <div
              style={{
                margin: '0 auto',
                padding: '20px 32px',
                background: 'rgb(0, 140, 214)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 140, 214, 0.2)',
                overflow: 'hidden',
              }}
            >
              <img
                src={logoUrl}
                alt="System Logo"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 60,
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 60,
                height: 60,
                margin: '0 auto',
                background: 'rgb(0, 140, 214)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              P
            </div>
          )}
        </div>

        {/* System Error Alert */}
        {systemError && (
          <Alert
            message="시스템 오류"
            description={systemError}
            type="error"
            showIcon
            closable
            onClose={() => setSystemError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Login Card */}
        <Card
          style={{
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Form name="login" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="username"
              rules={[{ required: true, message: '사용자명을 입력해주세요' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#999' }} />}
                placeholder="사용자명"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '비밀번호를 입력해주세요' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#999' }} />}
                placeholder="비밀번호"
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  height: 44,
                  background: 'rgb(0, 140, 214)',
                  borderColor: 'rgb(0, 140, 214)',
                  fontWeight: 500,
                }}
              >
                로그인
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Warning Notice */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: '#fff',
            border: '1px solid #e8e8e8',
            fontSize: 12,
            lineHeight: 1.6,
            color: '#666',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <WarningOutlined style={{ fontSize: 16, color: '#faad14', marginTop: 2 }} />
            <strong style={{ fontSize: 13, color: '#000' }}>무단 접근 금지</strong>
          </div>
          <p style={{ margin: '0 0 8px 24px' }}>
            본 시스템은 승인된 사용자만 접근할 수 있습니다.
          </p>
          <p style={{ margin: '0 0 8px 24px' }}>
            무단 침입, 계정 도용 등은 법적 책임의 대상이 됩니다.
          </p>
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #f0f0f0',
              marginLeft: 24,
            }}
          >
            관리자:{' '}
            <a href="mailto:yg.kim@dztechwill.com" style={{ color: 'rgb(0, 140, 214)' }}>
              yg.kim@dztechwill.com
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            marginTop: 16,
            textAlign: 'center',
            color: '#999',
            fontSize: 12,
          }}
        >
          © {new Date().getFullYear()} {copyrightText}
        </div>
      </div>
    </div>
  );
};