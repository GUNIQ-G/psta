import React, { useState, useEffect } from 'react';
import { Typography, Card, Form, Input, Button, Upload, Space, Divider, message, Switch, Image, Popconfirm } from 'antd';
import { UploadOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { systemSettingsApi, SystemSettings } from '../api/system-settings';

const { Title, Text } = Typography;

export const GeneralSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [faviconFileList, setFaviconFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await systemSettingsApi.getSettings();

      form.setFieldsValue({
        systemName: settings.systemName || 'PSTA 시스템',
        systemDescription: settings.systemDescription || '프로젝트 일정 관리 시스템',
        adminEmail: settings.adminEmail || '',
        copyrightText: settings.copyrightText || 'PSTA System. All rights reserved.',
        frontendUrl: settings.frontendUrl || 'https://psta.dztechwill.com',
      });

      if (settings.systemLogo) {
        // Use relative path for logo URL (will be proxied by Vite)
        setLogoUrl(settings.systemLogo);
      }

      if (settings.favicon) {
        setFaviconUrl(settings.favicon);
      }
    } catch (error: any) {
      message.error('설정을 불러오는데 실패했습니다.');
      console.error('Load settings error:', error);
    }
  };

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      const settings: SystemSettings = {
        systemName: values.systemName,
        systemDescription: values.systemDescription,
        adminEmail: values.adminEmail,
        copyrightText: values.copyrightText,
        frontendUrl: values.frontendUrl,
      };

      await systemSettingsApi.updateSettings(settings);
      message.success('설정이 저장되었습니다.');
    } catch (error: any) {
      message.error('설정 저장에 실패했습니다.');
      console.error('Save settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: RcFile) => {
    try {
      const result = await systemSettingsApi.uploadLogo(file);
      // Use relative path for logo URL (will be proxied by Vite)
      setLogoUrl(result.logoUrl);
      setFileList([]);
      message.success('로고가 업로드되었습니다.');
    } catch (error: any) {
      message.error('로고 업로드에 실패했습니다.');
      console.error('Upload logo error:', error);
    }
    return false;
  };

  const handleDeleteLogo = async () => {
    try {
      await systemSettingsApi.deleteLogo();
      setLogoUrl(null);
      setFileList([]);
      message.success('로고가 삭제되었습니다.');
    } catch (error: any) {
      message.error('로고 삭제에 실패했습니다.');
      console.error('Delete logo error:', error);
    }
  };

  const handleFaviconUpload = async (file: RcFile) => {
    try {
      const result = await systemSettingsApi.uploadFavicon(file);
      setFaviconUrl(result.faviconUrl);
      setFaviconFileList([]);
      message.success('파비콘이 업로드되었습니다.');
      // Update favicon in browser
      updateFaviconInBrowser(result.faviconUrl);
    } catch (error: any) {
      message.error('파비콘 업로드에 실패했습니다.');
      console.error('Upload favicon error:', error);
    }
    return false;
  };

  const handleDeleteFavicon = async () => {
    try {
      await systemSettingsApi.deleteFavicon();
      setFaviconUrl(null);
      setFaviconFileList([]);
      message.success('파비콘이 삭제되었습니다.');
      // Reset to default favicon
      updateFaviconInBrowser('/vite.svg');
    } catch (error: any) {
      message.error('파비콘 삭제에 실패했습니다.');
      console.error('Delete favicon error:', error);
    }
  };

  const updateFaviconInBrowser = (url: string) => {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement || document.createElement('link');
    link.rel = 'icon';
    // 파일 확장자에 따라 타입 설정
    if (url.endsWith('.png')) {
      link.type = 'image/png';
    } else if (url.endsWith('.svg')) {
      link.type = 'image/svg+xml';
    } else if (url.endsWith('.gif')) {
      link.type = 'image/gif';
    } else {
      link.type = 'image/x-icon';
    }
    link.href = url;
    document.head.appendChild(link);
  };

  return (
    <div style={{ padding: 24 }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          systemName: 'PSTA 시스템',
          systemDescription: '프로젝트 일정 관리 시스템',
          enableNotifications: true,
          enableSlackIntegration: true,
          maintenanceMode: false,
        }}
        style={{ maxWidth: 800 }}
      >
        {/* 시스템 로고 */}
        <Card title="시스템 로고" style={{ marginBottom: 24 }}>
          <Form.Item
            label="로고 이미지"
            help="사이드 메뉴 상단에 표시될 로고를 업로드하세요. 권장 크기: 200x50px"
          >
            {logoUrl ? (
              <div>
                <Image
                  src={logoUrl}
                  alt="System Logo"
                  style={{ maxWidth: 200, maxHeight: 100, marginBottom: 16, display: 'block' }}
                />
                <Space>
                  <Upload
                    beforeUpload={handleLogoUpload}
                    maxCount={1}
                    accept="image/*"
                    fileList={fileList}
                    onChange={({ fileList }) => setFileList(fileList)}
                  >
                    <Button icon={<UploadOutlined />}>로고 변경</Button>
                  </Upload>
                  <Popconfirm
                    title="로고를 삭제하시겠습니까?"
                    onConfirm={handleDeleteLogo}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button icon={<DeleteOutlined />} danger>로고 삭제</Button>
                  </Popconfirm>
                </Space>
              </div>
            ) : (
              <Upload
                beforeUpload={handleLogoUpload}
                maxCount={1}
                accept="image/*"
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
              >
                <Button icon={<UploadOutlined />}>로고 업로드</Button>
              </Upload>
            )}
          </Form.Item>
        </Card>

        {/* 파비콘 */}
        <Card title="파비콘" style={{ marginBottom: 24 }}>
          <Form.Item
            label="파비콘 이미지"
            help="브라우저 탭에 표시될 아이콘을 업로드하세요. 권장 형식: ICO, PNG (16x16 or 32x32px)"
          >
            {faviconUrl ? (
              <div>
                <Image
                  src={faviconUrl}
                  alt="Favicon"
                  style={{ width: 32, height: 32, marginBottom: 16, display: 'block' }}
                />
                <Space>
                  <Upload
                    beforeUpload={handleFaviconUpload}
                    maxCount={1}
                    accept="image/*,.ico"
                    fileList={faviconFileList}
                    onChange={({ fileList }) => setFaviconFileList(fileList)}
                  >
                    <Button icon={<UploadOutlined />}>파비콘 변경</Button>
                  </Upload>
                  <Popconfirm
                    title="파비콘을 삭제하시겠습니까?"
                    onConfirm={handleDeleteFavicon}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button icon={<DeleteOutlined />} danger>파비콘 삭제</Button>
                  </Popconfirm>
                </Space>
              </div>
            ) : (
              <Upload
                beforeUpload={handleFaviconUpload}
                maxCount={1}
                accept="image/*,.ico"
                fileList={faviconFileList}
                onChange={({ fileList }) => setFaviconFileList(fileList)}
              >
                <Button icon={<UploadOutlined />}>파비콘 업로드</Button>
              </Upload>
            )}
          </Form.Item>
        </Card>

        {/* 시스템 기본 정보 */}
        <Card title="시스템 기본 정보" style={{ marginBottom: 24 }}>
          <Form.Item
            name="systemName"
            label="시스템 이름"
            rules={[{ required: true, message: '시스템 이름을 입력해주세요' }]}
          >
            <Input placeholder="PSTA 시스템" />
          </Form.Item>

          <Form.Item
            name="systemDescription"
            label="시스템 설명"
          >
            <Input.TextArea rows={3} placeholder="시스템에 대한 간단한 설명" />
          </Form.Item>

          <Form.Item
            name="adminEmail"
            label="관리자 이메일"
            rules={[{ type: 'email', message: '올바른 이메일을 입력해주세요' }]}
          >
            <Input placeholder="admin@example.com" />
          </Form.Item>

          <Form.Item
            name="copyrightText"
            label="Copyright 문구"
            help="로그인 페이지 하단에 표시될 저작권 문구입니다. 연도는 자동으로 현재 연도가 표시됩니다."
          >
            <Input placeholder="PSTA System. All rights reserved." />
          </Form.Item>

          <Form.Item
            name="frontendUrl"
            label="프론트엔드 URL"
            rules={[
              { type: 'url', message: '올바른 URL을 입력해주세요' },
              { required: true, message: 'URL을 입력해주세요' },
            ]}
            help="Slack 알림 등 외부 링크에 사용될 도메인 주소 (예: https://psta.dztechwill.com)"
          >
            <Input placeholder="https://psta.dztechwill.com" />
          </Form.Item>
        </Card>

        {/* 기능 설정 */}
        <Card title="기능 설정" style={{ marginBottom: 24 }}>
          <Form.Item
            name="enableNotifications"
            label="알림 기능"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            시스템 전체 알림 기능을 활성화/비활성화합니다.
          </Text>

          <Form.Item
            name="enableSlackIntegration"
            label="Slack 연동"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Slack 알림 연동 기능을 활성화/비활성화합니다.
          </Text>

          <Form.Item
            name="maintenanceMode"
            label="점검 모드"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            점검 모드 활성화 시 관리자를 제외한 사용자의 접근이 제한됩니다.
          </Text>
        </Card>

        {/* 데이터 관리 */}
        <Card title="데이터 관리" style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>데이터 백업</Text>
              <div style={{ marginTop: 8 }}>
                <Button type="default">백업 생성</Button>
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  마지막 백업: 2025-01-20 10:30 (기능 미구현)
                </Text>
              </div>
            </div>

            <Divider />

            <div>
              <Text strong>데이터 복원</Text>
              <div style={{ marginTop: 8 }}>
                <Upload beforeUpload={() => false}>
                  <Button type="default">백업 파일 선택</Button>
                </Upload>
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  (기능 미구현)
                </Text>
              </div>
            </div>

            <Divider />

            <div>
              <Text strong type="danger">시스템 초기화</Text>
              <div style={{ marginTop: 8 }}>
                <Button danger disabled>
                  모든 데이터 삭제 (기능 미구현)
                </Button>
              </div>
            </div>
          </Space>
        </Card>

        {/* 저장 버튼 */}
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large" loading={loading}>
              설정 저장
            </Button>
            <Button onClick={() => loadSettings()} size="large" disabled={loading}>
              초기화
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};
